import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

// Public-facing menu orders API used by /menu (QR + phone).
// Writes into the same `menu_orders` collection that Catha staff see via /api/catha/menu-orders.

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase("infusion_jaba")

    const order: Record<string, unknown> = {
      orderId: body.orderId,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      tableId: body.tableId,
      tableNumber: body.tableNumber ?? body.tableId,
      customerNumber: body.customerNumber ?? body.customerPart ?? null,
      guestSessionId: body.guestSessionId ?? null,
      customerPhone: body.customerPhone ?? null,
      status: body.status || "draft",
      paymentStatus: body.paymentStatus || "UNPAID",
      paymentMethod: body.paymentMethod ?? null,
      items: body.items || [],
      total: body.total,
      subtotal: body.subtotal,
      receivedBy: body.receivedBy,
      cancelledReason: body.cancelledReason,
    }

    if (body.lastSentAt) {
      order.lastSentAt = new Date(body.lastSentAt)
    }
    if (body.updatedAt) {
      order.updatedAt = new Date(body.updatedAt)
    }

    await db.collection("menu_orders").insertOne(order)
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error("[menu-orders] POST error:", error)
    return NextResponse.json(
      { error: "Failed to create menu order", message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase("infusion_jaba")
    const { orderId, mpesaReceiptNumber, ...updateData } = body
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }
    if (mpesaReceiptNumber) updateData.mpesaReceiptNumber = mpesaReceiptNumber

    const dateFields = ["createdAt", "updatedAt", "lastSentAt"]
    dateFields.forEach((f) => {
      if (updateData[f]) {
        updateData[f] =
          updateData[f] instanceof Date
            ? updateData[f]
            : new Date(updateData[f])
      }
    })

    const result = await db
      .collection("menu_orders")
      .updateOne({ orderId }, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[menu-orders] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to update menu order", message: error.message },
      { status: 500 }
    )
  }
}

