import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import {
  consumeManualMpesaApprovalToken,
  getApprovalTokenPreview,
} from '@/lib/catha-manual-mpesa-approval-token'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'
import { getClientIp } from '@/lib/rate-limit-simple'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const db = await getDatabase('infusion_jaba')
    const preview = await getApprovalTokenPreview(db, token)
    if (!preview.ok) {
      return NextResponse.json({ error: preview.error }, { status: preview.status })
    }
    const res = NextResponse.json(preview)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to load approval link', message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'approve').toLowerCase() === 'reject' ? 'reject' : 'approve'
    const reason = body?.reason != null ? String(body.reason) : null
    const clientIp = getClientIp(request)

    const db = await getDatabase('infusion_jaba')
    const result = await consumeManualMpesaApprovalToken(db, token, action, reason)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: action === 'approve' ? 'MANUAL_MPESA_APPROVE_SMS_LINK' : 'MANUAL_MPESA_REJECT_SMS_LINK',
      status: 'SUCCESS',
      userId: 'SMS approval link',
      role: null,
      endpoint: '/api/catha/orders/manual-mpesa/approve-token',
      payloadSummary: {
        orderId: result.orderId,
        transactionCode: result.transactionCode,
        ip: clientIp,
      },
    })

    const res = NextResponse.json({
      success: true,
      action: result.action,
      orderId: result.orderId,
      transactionCode: result.transactionCode,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to process approval link', message }, { status: 500 })
  }
}
