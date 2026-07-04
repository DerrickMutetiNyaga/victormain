import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { summarizeCathaOrderPayments } from "@/lib/catha-order-payments"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit-simple"
import { getOrderPayUrl } from "@/lib/pay-url"

function isValidOrderId(orderId: string): boolean {
  const trimmed = orderId.trim()
  return !!trimmed && /^[A-Za-z0-9_-]{6,64}$/.test(trimmed)
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

  try {
    const db = await getDatabase("infusion_jaba")
    const [order, settings] = await Promise.all([
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
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      items: Array.isArray(order.items)
        ? order.items.slice(0, 8).map((item: { name?: string; quantity?: number; price?: number }) => ({
            name: String(item?.name || "Item"),
            quantity: Number(item?.quantity || 0),
            price: Number(item?.price || 0),
          }))
        : [],
    }

    const res = NextResponse.json(payload)
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15, max-age=0")
    return res
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 })
  }
}
