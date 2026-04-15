import { NextResponse } from 'next/server'

/**
 * Phone sign-in now requires SMS verification.
 * Use POST /api/ecommerce/auth/send-otp then POST /api/ecommerce/auth/verify.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Verification required. Request a code via /api/ecommerce/auth/send-otp, then complete sign-in at /api/ecommerce/auth/verify.',
      code: 'OTP_REQUIRED',
    },
    { status: 400 }
  )
}
