import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { canManageOrderMpesaPayments, normalizePermissions } from '@/lib/catha-permissions-model'
import { requireActiveShiftForSessionUser } from '@/lib/catha-shift-service'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import {
  baseLinkedListFromOrder,
  recalculateOrderPaymentsAfterLinks,
} from '@/lib/catha-append-mpesa-payment'
import { deleteMpesaOrderAllocation, refreshMpesaTransactionLinkMetadata } from '@/lib/catha-mpesa-order-allocations'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role as string | undefined
    const perms = normalizePermissions((session.user as any).permissions)
    if (!canManageOrderMpesaPayments(perms, role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
      allowSuperAdmin: true,
      allowedStatuses: ['ACTIVE'],
    })
    if (!shiftGuard.ok) {
      logOrderSecurityEvent({
        route: '/api/catha/orders/unlink-mpesa',
        action: 'POST',
        userId: (session.user as any)?.userId ?? session.user.email ?? null,
        role: role ?? null,
        rejected: true,
        reason: 'denied_no_active_shift',
        requestSummary: { message: shiftGuard.error },
      })
      queueCathaAuditLog({
        type: 'SECURITY',
        action: 'UNLINK_MPESA_PAYMENT',
        status: 'DENIED',
        reason: 'denied_no_active_shift',
        userId: (session.user as any)?.userId ?? session.user.email ?? null,
        role: role ?? null,
        endpoint: '/api/catha/orders/unlink-mpesa',
        payloadSummary: { message: shiftGuard.error },
      })
      return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const transactionId = String(body?.transactionId || '').trim()
    if (!orderId || !transactionId || !ObjectId.isValid(transactionId)) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const order = await db.collection('orders').findOne({ id: orderId })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const before = baseLinkedListFromOrder(order)
    if (!before.some((p) => p.transactionId === transactionId)) {
      return NextResponse.json({ error: 'Transaction is not linked to this order' }, { status: 400 })
    }

    const list = before.filter((p) => p.transactionId !== transactionId)
    const now = new Date()
    const last = list[list.length - 1]

    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          linkedPayments: list,
          mpesaTransactionId: last ? last.transactionId : null,
          mpesaReceiptNumber: last ? last.receiptNumber : null,
          linkedAt: last ? last.linkedAt : null,
          linkedBy: last ? last.linkedBy : null,
          updatedAt: now,
        },
      }
    )

    await deleteMpesaOrderAllocation(db, orderId, transactionId)
    await refreshMpesaTransactionLinkMetadata(db, transactionId)

    await recalculateOrderPaymentsAfterLinks(db, orderId)

    const res = NextResponse.json({ success: true, orderId })
    res.headers.set('Cache-Control', 'no-store')
    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'UNLINK_MPESA_PAYMENT',
      status: 'SUCCESS',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role: role ?? null,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/orders/unlink-mpesa',
      payloadSummary: { orderId, transactionId },
    })
    return res
  } catch (error: any) {
    console.error('[Orders Unlink M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to unlink M-Pesa transaction', message: error.message },
      { status: 500 }
    )
  }
}
