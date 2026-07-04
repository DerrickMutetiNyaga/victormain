import { NextResponse } from 'next/server'

/**
 * E-commerce auth currently supports Google sign-in only.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Use Google sign-in via /auth.',
      code: 'GOOGLE_SIGN_IN_REQUIRED',
    },
    { status: 405 }
  )
}
