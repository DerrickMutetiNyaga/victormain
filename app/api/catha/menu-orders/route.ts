import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { auth } from "@/lib/auth-catha"
import { normalizePermissions, hasCathaPermission } from "@/lib/catha-permissions-model"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = ((session.user as any).role ?? "").toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== "SUPER_ADMIN" && !hasCathaPermission(perms, "orders", "view")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }
  try {
    const db = await getDatabase("infusion_jaba")
    const orders = await db
      .collection("menu_orders")
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    const formattedOrders = orders.map((order: any) => ({
      orderId: order.orderId,
      createdAt:
        order.createdAt instanceof Date
          ? order.createdAt.getTime()
          : new Date(order.createdAt).getTime(),
      updatedAt: order.updatedAt
        ? order.updatedAt instanceof Date
          ? order.updatedAt.getTime()
          : new Date(order.updatedAt).getTime()
        : undefined,
      tableId: order.tableId,
      tableNumber: order.tableNumber ?? order.tableId,
      customerNumber: order.customerNumber ?? order.customerPart ?? null,
      guestSessionId: order.guestSessionId ?? null,
      customerPhone: order.customerPhone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? null,
      items: order.items || [],
      total: order.total,
      subtotal: order.subtotal,
      lastSentAt: order.lastSentAt
        ? order.lastSentAt instanceof Date
          ? order.lastSentAt.getTime()
          : new Date(order.lastSentAt).getTime()
        : undefined,
      receivedBy: order.receivedBy,
      cancelledReason: order.cancelledReason,
      mpesaReceiptNumber: order.mpesaReceiptNumber ?? null,
    }))

    return NextResponse.json(formattedOrders)
  } catch (error: any) {
    console.error("Error fetching menu orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch menu orders", message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = ((session.user as any).role ?? "").toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== "SUPER_ADMIN" && !hasCathaPermission(perms, "orders", "add")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }
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
    console.error("Error creating menu order:", error)
    return NextResponse.json(
      { error: "Failed to create menu order", message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = ((session.user as any).role ?? "").toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== "SUPER_ADMIN" && !hasCathaPermission(perms, "orders", "edit")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }
  try {
    const body = await request.json()
    const db = await getDatabase("infusion_jaba")
    const { orderId, mpesaReceiptNumber, ...updateData } = body
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
    console.error("Error updating menu order:", error)
    return NextResponse.json(
      { error: "Failed to update menu order", message: error.message },
      { status: 500 }
    )
  }
}
