import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { summarizeCathaOrderPayments } from "@/lib/catha-order-payments"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit-simple"
import { getOrderPayUrl } from "@/lib/pay-url"
import { normalizeMpesaStatus, type MpesaStatus } from "@/lib/mpesa-status"

function isValidOrderId(orderId: string): boolean {
  const trimmed = orderId.trim()
  return !!trimmed && /^[A-Za-z0-9_-]{6,64}$/.test(trimmed)
}

function isValidCheckoutRequestId(id: string): boolean {
  const trimmed = id.trim()
  return !!trimmed && /^[A-Za-z0-9_-]{8,64}$/.test(trimmed)
}

async function resolveStkStatus(
  db: Awaited<ReturnType<typeof getDatabase>>,
  orderId: string,
  checkoutRequestId: string | null
): Promise<{
  stkStatus: MpesaStatus | null
  stkMessage: string | null
  checkoutRequestId: string | null
  mpesaReceiptNumber: string | null
}> {
  if (!checkoutRequestId) {
    return { stkStatus: null, stkMessage: null, checkoutRequestId: null, mpesaReceiptNumber: null }
  }

  const txn = await db.collection("mpesa_transactions").findOne(
    { checkout_request_id: checkoutRequestId },
    {
      projection: {
        account_reference: 1,
        status: 1,
        result_desc: 1,
        mpesa_receipt_number: 1,
        checkout_request_id: 1,
      },
    }
  )

  if (!txn || String(txn.account_reference || "") !== orderId) {
    return { stkStatus: null, stkMessage: null, checkoutRequestId, mpesaReceiptNumber: null }
  }

  const stkStatus = normalizeMpesaStatus(txn.status)
  return {
    stkStatus,
    stkMessage: txn.result_desc ? String(txn.result_desc) : null,
    checkoutRequestId,
    mpesaReceiptNumber: txn.mpesa_receipt_number ? String(txn.mpesa_receipt_number) : null,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`public-pay:${ip}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { orderId } = await params
  if (!isValidOrderId(orderId)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const checkoutRequestIdRaw = searchParams.get("checkoutRequestId")?.trim() || ""
  const checkoutRequestId = isValidCheckoutRequestId(checkoutRequestIdRaw) ? checkoutRequestIdRaw : null

  try {
    const db = await getDatabase("infusion_jaba")
    const [order, settings, stk] = await Promise.all([
      db.collection("orders").findOne(
        { id: orderId },
        {
          projection: {
            _id: 0,
            id: 1,
            timestamp: 1,
            items: 1,
            total: 1,
            subtotal: 1,
            status: 1,
            paymentStatus: 1,
            paymentMethod: 1,
            linkedPayments: 1,
            mpesaTransactionId: 1,
            mpesaReceiptNumber: 1,
            cashAmount: 1,
            type: 1,
          },
        }
      ),
      db.collection("catha_settings").findOne(
        {},
        { projection: { "receipt.tillNumber": 1, "mpesa.shortcode": 1, "businessInfo.businessName": 1 } }
      ),
      resolveStkStatus(db, orderId, checkoutRequestId),
    ])

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const summary = summarizeCathaOrderPayments(order as Record<string, unknown>)
    const isPaid = summary.paymentStatus === "PAID" || summary.paymentStatus === "OVERPAID"
    const amountDue = isPaid ? 0 : summary.balanceDue > 0 ? summary.balanceDue : summary.orderTotal

    const tillNumber = String(
      settings?.receipt?.tillNumber || settings?.mpesa?.shortcode || ""
    ).trim()

    const payload = {
      orderId: order.id,
      businessName: "catha lounge",
      tillNumber: tillNumber || null,
      payUrl: getOrderPayUrl(orderId),
      isPaid,
      paymentStatus: summary.paymentStatus,
      amountDue,
      orderTotal: summary.orderTotal,
      totalPaid: summary.totalLinkedPayments,
      mpesaReceiptNumber: order.mpesaReceiptNumber
        ? String(order.mpesaReceiptNumber)
        : stk.mpesaReceiptNumber,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      items: Array.isArray(order.items)
        ? order.items.slice(0, 8).map((item: { name?: string; quantity?: number; price?: number }) => ({
            name: String(item?.name || "Item"),
            quantity: Number(item?.quantity || 0),
            price: Number(item?.price || 0),
          }))
        : [],
      stkStatus: stk.stkStatus,
      stkMessage: stk.stkMessage,
      checkoutRequestId: stk.checkoutRequestId,
    }

    const res = NextResponse.json(payload)
    res.headers.set("Cache-Control", "no-store, max-age=0")
    return res
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 })
  }
}
