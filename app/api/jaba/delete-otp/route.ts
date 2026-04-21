import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { requestDeleteOtp, type DeleteAction } from '@/lib/jaba-delete-otp'
import { checkRateLimit } from '@/lib/rate-limit-simple'
import { assertJabaStatefulRequestOrigin } from '@/lib/jaba-destructive-request-guard'

const ALLOWED_ACTIONS: DeleteAction[] = [
  'delete_batch',
  'delete_all_batches',
  'delete_packaging',
  'delete_delivery_note',
  'delete_raw_material',
  'delete_supplier',
  'delete_distributor',
  'delete_flavor',
  'delete_user',
  'delete_flavour_output',
]

export async function POST(request: NextRequest) {
  try {
    const originBlock = assertJabaStatefulRequestOrigin(request)
    if (originBlock) return originBlock

    const session = await auth()
    const email = session?.user?.email
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserByEmail(email)
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can request delete OTP' }, { status: 403 })
    }

    const body = await request.json()
    const action = String(body.action || '') as DeleteAction
    const targetId = String(body.targetId || '')
    if (!ALLOWED_ACTIONS.includes(action) || !targetId) {
      return NextResponse.json({ error: 'Invalid OTP request payload' }, { status: 400 })
    }

    if (action === 'delete_all_batches') {
      const rl = checkRateLimit(`jaba-delete-otp-bulk-batches:${email}`, 4, 60 * 60 * 1000)
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Too many bulk-delete OTP requests. Try again later.', retryAfterMs: rl.retryAfterMs },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
        )
      }
    }

    await requestDeleteOtp({
      action,
      targetId,
      requestedBy: email,
    })

    return NextResponse.json({ success: true, message: 'OTP sent' })
  } catch (error: any) {
    console.error('[Delete OTP API] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send delete OTP' },
      { status: 500 }
    )
  }
}
