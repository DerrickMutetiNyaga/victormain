import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { canManageOrderMpesaPayments, normalizePermissions } from '@/lib/catha-permissions-model'
import { appendMpesaPaymentToOrder } from '@/lib/catha-append-mpesa-payment'
import { requireActiveShiftForSessionUser } from '@/lib/catha-shift-service'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
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
        route: '/api/catha/orders/link-mpesa',
        action: 'POST',
        userId: (session.user as any)?.userId ?? session.user.email ?? null,
        role: role ?? null,
        rejected: true,
        reason: 'denied_no_active_shift',
        requestSummary: { message: shiftGuard.error },
      })
      queueCathaAuditLog({
        type: 'SECURITY',
        action: 'LINK_MPESA_PAYMENT',
        status: 'DENIED',
        reason: 'denied_no_active_shift',
        userId: (session.user as any)?.userId ?? session.user.email ?? null,
        role: role ?? null,
        endpoint: '/api/catha/orders/link-mpesa',
        payloadSummary: { message: shiftGuard.error },
      })
      return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const transactionId = String(body?.transactionId || '').trim()
    if (!orderId || !transactionId) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 })
    }

    const rawAlloc = body?.allocatedAmount
    const allocatedAmount =
      rawAlloc != null && rawAlloc !== '' && !Number.isNaN(Number(rawAlloc)) ? Number(rawAlloc) : null
    const notes = body?.notes != null ? String(body.notes) : null
    const linkSource = String(body?.linkSource || '').toLowerCase()
    const allocationMode =
      linkSource === 'stk' || linkSource === 'reconcile'
        ? ('full_transaction' as const)
        : body?.allocationMode === 'full_transaction'
          ? ('full_transaction' as const)
          : ('order_balance_then_tx' as const)
    const paymentLinkSource =
      linkSource === 'stk' || linkSource === 'reconcile'
        ? ('automatic' as const)
        : ('staff_link' as const)

    const db = await getDatabase('infusion_jaba')
    const linkedBy = (session.user as any).name || session.user.email || 'System'

    const result = await appendMpesaPaymentToOrder(db, {
      orderId,
      transactionId,
      linkedBy,
      allocatedAmount,
      notes,
      allocationMode,
      linkSource: paymentLinkSource,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const orderAfter = await db.collection('orders').findOne({ id: orderId })

    const res = NextResponse.json({
      success: true,
      orderId: result.orderId,
      transactionId: result.transactionId,
      mpesaReceiptNumber: result.mpesaReceiptNumber,
      linkedAt: result.linkedAt.toISOString(),
      linkedBy,
      summary: result.summary,
      linkedPayments: result.linkedPayments,
      transactionAllocation: result.transactionAllocation,
      customerPhone: orderAfter?.customerPhone ?? null,
      customerName: orderAfter?.customerName ?? null,
    })
    res.headers.set('Cache-Control', 'no-store')
    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'LINK_MPESA_PAYMENT',
      status: 'SUCCESS',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role: role ?? null,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/orders/link-mpesa',
      payloadSummary: { orderId, transactionId },
    })
    return res
  } catch (error: any) {
    console.error('[Orders Link M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to link M-Pesa transaction', message: error.message },
      { status: 500 }
    )
  }
}
