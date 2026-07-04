import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import {
  canManuallyAddMpesaTransaction,
  normalizePermissions,
} from '@/lib/catha-permissions-model'
import { submitManualMpesaVerification } from '@/lib/catha-manual-mpesa-verification'
import { maybeSendManualMpesaApprovalSms } from '@/lib/catha-manual-mpesa-approval-sms'
import { requireActiveShiftForSessionUser } from '@/lib/catha-shift-service'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'
import { getClientIp } from '@/lib/rate-limit-simple'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role as string | undefined
    const perms = normalizePermissions((session.user as any).permissions)
    const clientIp = getClientIp(request)
    const userId = (session.user as any)?.userId ?? session.user.email ?? null

    if (!canManuallyAddMpesaTransaction(perms, role)) {
      logOrderSecurityEvent({
        route: '/api/catha/orders/manual-mpesa',
        action: 'POST',
        userId,
        role: role ?? null,
        ip: clientIp,
        rejected: true,
        reason: 'denied_insufficient_permissions',
      })
      queueCathaAuditLog({
        type: 'SECURITY',
        action: 'MANUAL_MPESA_SUBMIT',
        status: 'DENIED',
        reason: 'denied_insufficient_permissions',
        userId,
        role: role ?? null,
        endpoint: '/api/catha/orders/manual-mpesa',
        payloadSummary: { ip: clientIp },
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
      allowSuperAdmin: true,
      allowedStatuses: ['ACTIVE'],
    })
    if (!shiftGuard.ok) {
      queueCathaAuditLog({
        type: 'SECURITY',
        action: 'MANUAL_MPESA_SUBMIT',
        status: 'DENIED',
        reason: 'denied_no_active_shift',
        userId,
        role: role ?? null,
        endpoint: '/api/catha/orders/manual-mpesa',
        payloadSummary: { message: shiftGuard.error, ip: clientIp },
      })
      return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const transactionCode = normalizeMpesaReceiptCode(body?.transactionCode)
    const amount = Number(body?.amount)
    const phone = body?.phone != null ? String(body.phone) : null
    const paymentDate = body?.paymentDate != null ? String(body.paymentDate) : null
    const notes = body?.notes != null ? String(body.notes) : null

    const enteredBy = (session.user as any).name || session.user.email || 'System'

    const db = await getDatabase('infusion_jaba')
    const result = await submitManualMpesaVerification(db, {
      orderId,
      transactionCode,
      amount,
      phone,
      paymentDate,
      notes,
      enteredBy,
      enteredByUserId: userId,
      clientIp,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code ?? undefined },
        { status: result.status }
      )
    }

    const smsResult = await maybeSendManualMpesaApprovalSms(db, result.verification)

    const res = NextResponse.json({
      success: true,
      pending: true,
      verification: result.verification,
      message: 'Submitted for manager approval.',
      approvalSmsSent: smsResult.sent,
    })
    res.headers.set('Cache-Control', 'no-store')

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'MANUAL_MPESA_SUBMIT',
      status: 'SUCCESS',
      userId,
      role: role ?? null,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/orders/manual-mpesa',
      payloadSummary: {
        verificationId: result.verification.id,
        orderId,
        transactionCode,
        amount,
        notes: notes ? notes.slice(0, 200) : null,
        ip: clientIp,
      },
    })

    return res
  } catch (error: any) {
    console.error('[Orders Manual M-Pesa Submit] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit manual M-Pesa verification', message: error.message },
      { status: 500 }
    )
  }
}
