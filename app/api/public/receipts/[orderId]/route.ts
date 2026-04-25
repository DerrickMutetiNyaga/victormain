import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { summarizeCathaOrderPayments } from "@/lib/catha-order-payments"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit-simple"

function isValidOrderId(orderId: string): boolean {
  const trimmed = orderId.trim()
  if (!trimmed) return false
  return /^[A-Za-z0-9_-]{6,64}$/.test(trimmed)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`public-receipt:${ip}`, 80, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { orderId } = await params
  if (!isValidOrderId(orderId)) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
  }

  try {
    const db = await getDatabase("infusion_jaba")
    const order = await db.collection("orders").findOne(
      { id: orderId },
      {
        projection: {
          _id: 0,
          id: 1,
          timestamp: 1,
          items: 1,
          subtotal: 1,
          vat: 1,
          total: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          status: 1,
          mpesaReceiptNumber: 1,
          receiptCode: 1,
        },
      }
    )

    if (!order) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const summary = summarizeCathaOrderPayments(order as any)
    const isSettled =
      String(order.status || "").toLowerCase() === "completed" &&
      (summary.paymentStatus === "PAID" || summary.paymentStatus === "OVERPAID")

    // Never expose pending/unsettled orders on public receipt route.
    if (!isSettled) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const payload = {
      businessName: "Catha Lodge",
      orderId: order.id,
      timestamp: order.timestamp,
      paymentMethod: order.paymentMethod || null,
      paymentStatus: summary.paymentStatus,
      receiptNumber: order.mpesaReceiptNumber || (order as any).receiptCode || null,
      subtotal: Number(order.subtotal || 0),
      vat: Number(order.vat || 0),
      total: Number(order.total || 0),
      items: Array.isArray(order.items)
        ? order.items.map((item: any) => ({
            name: String(item?.name || "Item"),
            quantity: Number(item?.quantity || 0),
            price: Number(item?.price || 0),
          }))
        : [],
    }

    const res = NextResponse.json(payload)
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120, max-age=30")
    res.headers.set("X-Robots-Tag", "noindex, nofollow")
    return res
  } catch {
    return NextResponse.json({ error: "Receipt unavailable" }, { status: 500 })
  }
}
