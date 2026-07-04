import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { type DeleteAction, verifyDeleteOtpResult } from '@/lib/jaba-delete-otp'

export type RequireDeleteOtpResult =
  | { authorized: true; userEmail: string }
  | { response: NextResponse; otpInvalid?: boolean }

export async function requireDeleteOtp(
  request: Request,
  action: DeleteAction,
  targetId: string
): Promise<RequireDeleteOtpResult> {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = await getUserByEmail(userEmail)
  if (!user || user.role !== 'super_admin') {
    return { response: NextResponse.json({ error: 'Only super admins can delete records' }, { status: 403 }) }
  }

  const otp = request.headers.get('x-delete-otp') || ''
  if (!otp) {
    return {
      response: NextResponse.json(
        { error: 'Delete OTP is required. Request OTP first.' },
        { status: 428 }
      ),
    }
  }

  const vr = await verifyDeleteOtpResult({
    action,
    targetId,
    requestedBy: userEmail,
    otp,
  })

  if (!vr.ok) {
    const msg =
      vr.reason === 'expired'
        ? 'OTP has expired. Request a new OTP.'
        : vr.reason === 'no_otp_doc'
          ? 'No OTP session found for this action. Request a new OTP first.'
          : 'Invalid OTP. Request a new OTP and try again.'
    return {
      response: NextResponse.json({ error: msg, code: vr.reason }, { status: 403 }),
      otpInvalid: vr.reason === 'bad_otp',
    }
  }

  return { authorized: true, userEmail }
}
