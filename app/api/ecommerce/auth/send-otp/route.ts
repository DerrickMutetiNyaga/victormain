import { NextResponse } from 'next/server'

export async function POST(_request: Request) {
  return NextResponse.json(
    {
      success: false,
      error: 'Phone OTP sign-in is temporarily disabled. Use Google sign-in at /auth.',
    },
    { status: 410 }
  )
}
