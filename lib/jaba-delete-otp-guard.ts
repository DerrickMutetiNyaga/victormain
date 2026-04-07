import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { type DeleteAction, verifyDeleteOtp } from '@/lib/jaba-delete-otp'

export async function requireDeleteOtp(request: Request, action: DeleteAction, targetId: string) {
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

  const otpValid = await verifyDeleteOtp({
    action,
    targetId,
    requestedBy: userEmail,
    otp,
  })
  if (!otpValid) {
    return {
      response: NextResponse.json(
        { error: 'Invalid or expired OTP. Request a new OTP and try again.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true as const, userEmail }
}
