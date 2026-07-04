import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { auth, requireCathaPermission } from "@/lib/auth-catha"
import { requireActiveShiftForSessionUser } from "@/lib/catha-shift-service"
import { queueCathaAuditLog } from "@/lib/catha-audit-log"

const COLLECTION = "cash_payment_requests"

/** GET: List pending cash payment requests. Requires pos.view */
export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'view')
  if (!allowed && response) return response
  try {
    const { searchParams } = new URL(request.url)
    const resolved = searchParams.get("resolved") // "true" | "false" | omit for all
    const db = await getDatabase("infusion_jaba")

    const filter: Record<string, unknown> = {}
    if (resolved === "false") filter.resolved = false
    else if (resolved === "true") filter.resolved = true

    const requests = await db
      .collection(COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    const formatted = requests.map((r: any) => ({
      id: r._id?.toString(),
      orderId: r.orderId,
      tableNumber: r.tableNumber,
      amount: r.amount,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      resolved: r.resolved ?? false,
      resolvedAt: r.resolvedAt,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error("[CashPaymentRequests] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch cash payment requests", message: error.message },
      { status: 500 }
    )
  }
}

/** POST: Create a cash payment request. Requires pos.create */
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'create')
  if (!allowed && response) return response
  if (response) return response
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = String((session.user as any)?.role || '').toUpperCase()
  const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
    allowSuperAdmin: true,
    allowedStatuses: ['ACTIVE'],
  })
  if (!shiftGuard.ok) {
    queueCathaAuditLog({
      type: "SECURITY",
      action: "CREATE_CASH_PAYMENT_REQUEST",
      status: "DENIED",
      reason: "denied_no_active_shift",
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      endpoint: "/api/catha/cash-payment-requests",
      payloadSummary: { message: shiftGuard.error },
    })
    console.warn('[security-shift] REJECTED', JSON.stringify({
      route: '/api/catha/cash-payment-requests',
      action: 'POST',
      reason: 'denied_no_active_shift',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      message: shiftGuard.error,
      ts: new Date().toISOString(),
    }))
    return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
  }
  try {
    const body = await request.json()
    const db = await getDatabase("infusion_jaba")

    const doc = {
      orderId: body.orderId,
      tableNumber: String(body.tableNumber ?? body.tableId ?? "—"),
      amount: Number(body.amount) || 0,
      createdAt: new Date(),
      resolved: false,
    }

    // Upsert by orderId to avoid duplicates
    await db.collection(COLLECTION).updateOne(
      { orderId: doc.orderId },
      { $setOnInsert: doc },
      { upsert: true }
    )
    queueCathaAuditLog({
      type: "FINANCIAL",
      action: "CREATE_CASH_PAYMENT_REQUEST",
      status: "SUCCESS",
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: "/api/catha/cash-payment-requests",
      payloadSummary: { orderId: doc.orderId, amount: doc.amount },
    })
    return NextResponse.json({ success: true, id: doc.orderId }, { status: 201 })
  } catch (error: any) {
    console.error("[CashPaymentRequests] POST error:", error)
    return NextResponse.json(
      { error: "Failed to create cash payment request", message: error.message },
      { status: 500 }
    )
  }
}

/** PATCH: Mark a cash payment request as resolved. Requires pos.edit */
export async function PATCH(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'edit')
  if (!allowed && response) return response
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = String((session.user as any)?.role || '').toUpperCase()
  const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
    allowSuperAdmin: true,
    allowedStatuses: ['ACTIVE'],
  })
  if (!shiftGuard.ok) {
    queueCathaAuditLog({
      type: "SECURITY",
      action: "RESOLVE_CASH_PAYMENT_REQUEST",
      status: "DENIED",
      reason: "denied_no_active_shift",
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      endpoint: "/api/catha/cash-payment-requests",
      payloadSummary: { message: shiftGuard.error },
    })
    console.warn('[security-shift] REJECTED', JSON.stringify({
      route: '/api/catha/cash-payment-requests',
      action: 'PATCH',
      reason: 'denied_no_active_shift',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      message: shiftGuard.error,
      ts: new Date().toISOString(),
    }))
    return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
  }
  try {
    const body = await request.json()
    const orderId = body.orderId
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }
    const db = await getDatabase("infusion_jaba")
    await db.collection(COLLECTION).updateOne(
      { orderId },
      { $set: { resolved: true, resolvedAt: new Date() } }
    )
    queueCathaAuditLog({
      type: "FINANCIAL",
      action: "RESOLVE_CASH_PAYMENT_REQUEST",
      status: "SUCCESS",
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: "/api/catha/cash-payment-requests",
      payloadSummary: { orderId },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[CashPaymentRequests] PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to resolve cash payment request", message: error.message },
      { status: 500 }
    )
  }
}
