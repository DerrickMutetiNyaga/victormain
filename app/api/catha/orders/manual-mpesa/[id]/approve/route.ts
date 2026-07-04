import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import {
  canApproveManualMpesaVerifications,
  normalizePermissions,
} from '@/lib/catha-permissions-model'
import { approveManualMpesaVerification } from '@/lib/catha-manual-mpesa-verification'
import { requireActiveShiftForSessionUser } from '@/lib/catha-shift-service'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'
import { getClientIp } from '@/lib/rate-limit-simple'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role as string | undefined
    const perms = normalizePermissions((session.user as any).permissions)
    const clientIp = getClientIp(request)
    const userId = (session.user as any)?.userId ?? session.user.email ?? null

    if (!canApproveManualMpesaVerifications(perms, role)) {
      queueCathaAuditLog({
        type: 'SECURITY',
        action: 'MANUAL_MPESA_APPROVE',
        status: 'DENIED',
        reason: 'denied_insufficient_permissions',
        userId,
        role: role ?? null,
        endpoint: '/api/catha/orders/manual-mpesa/[id]/approve',
        payloadSummary: { ip: clientIp },
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
      allowSuperAdmin: true,
      allowedStatuses: ['ACTIVE'],
    })
    if (!shiftGuard.ok) {
      return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
    }

    const { id } = await params
    const verificationId = String(id || '').trim()
    if (!verificationId) {
      return NextResponse.json({ error: 'Verification ID is required' }, { status: 400 })
    }

    const reviewedBy = (session.user as any).name || session.user.email || 'System'
    const db = await getDatabase('infusion_jaba')
    const result = await approveManualMpesaVerification(db, verificationId, reviewedBy, userId)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code ?? undefined },
        { status: result.status }
      )
    }

    const orderAfter = await db.collection('orders').findOne({ id: result.verification.orderId })

    const res = NextResponse.json({
      success: true,
      verification: result.verification,
      orderId: result.linkResult.orderId,
      transactionId: result.linkResult.transactionId,
      mpesaReceiptNumber: result.linkResult.mpesaReceiptNumber,
      linkedAt: result.linkResult.linkedAt.toISOString(),
      linkedBy: reviewedBy,
      summary: result.linkResult.summary,
      linkedPayments: result.linkResult.linkedPayments,
      transactionAllocation: result.linkResult.transactionAllocation,
      customerPhone: orderAfter?.customerPhone ?? null,
      customerName: orderAfter?.customerName ?? null,
    })
    res.headers.set('Cache-Control', 'no-store')

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'MANUAL_MPESA_APPROVE',
      status: 'SUCCESS',
      userId,
      role: role ?? null,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/orders/manual-mpesa/approve',
      payloadSummary: {
        verificationId,
        orderId: result.verification.orderId,
        transactionCode: result.verification.transactionCode,
        amount: result.verification.amount,
        ip: clientIp,
      },
    })

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'MANUAL_MPESA_PAYMENT',
      status: 'SUCCESS',
      userId,
      role: role ?? null,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/orders/manual-mpesa/approve',
      payloadSummary: {
        verificationId,
        orderId: result.verification.orderId,
        transactionCode: result.verification.transactionCode,
        amount: result.verification.amount,
        enteredBy: result.verification.enteredBy,
        ip: clientIp,
      },
    })

    return res
  } catch (error: any) {
    console.error('[Manual M-Pesa Approve] Error:', error)
    return NextResponse.json(
      { error: 'Failed to approve manual M-Pesa verification', message: error.message },
      { status: 500 }
    )
  }
}
