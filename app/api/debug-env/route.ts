import { NextResponse } from 'next/server'

/**
 * Temporary debug endpoint to check environment variables
 * DELETE THIS FILE AFTER VERIFYING
 */
export async function GET() {
  // Only show in development or if explicitly enabled
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // Don't expose secrets
    hasNEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  })
}

