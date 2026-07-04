import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import {
  canApproveManualMpesaVerifications,
  normalizePermissions,
} from '@/lib/catha-permissions-model'
import { rejectManualMpesaVerification } from '@/lib/catha-manual-mpesa-verification'
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
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const verificationId = String(id || '').trim()
    if (!verificationId) {
      return NextResponse.json({ error: 'Verification ID is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const rejectionReason =
      body?.reason != null ? String(body.reason) : body?.rejectionReason != null ? String(body.rejectionReason) : null

    const reviewedBy = (session.user as any).name || session.user.email || 'System'
    const db = await getDatabase('infusion_jaba')
    const result = await rejectManualMpesaVerification(
      db,
      verificationId,
      reviewedBy,
      rejectionReason,
      userId
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'MANUAL_MPESA_REJECT',
      status: 'SUCCESS',
      userId,
      role: role ?? null,
      endpoint: '/api/catha/orders/manual-mpesa/reject',
      payloadSummary: {
        verificationId,
        orderId: result.verification.orderId,
        transactionCode: result.verification.transactionCode,
        reason: rejectionReason ? rejectionReason.slice(0, 200) : null,
        ip: clientIp,
      },
    })

    const res = NextResponse.json({ success: true, verification: result.verification })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Manual M-Pesa Reject] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reject manual M-Pesa verification', message: error.message },
      { status: 500 }
    )
  }
}
