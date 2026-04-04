import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This API route sets a server-side cookie to indicate jaba authentication context
export async function GET(_request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  
  // Set a cookie to indicate this is a jaba user sign-in
  // This cookie will be checked in NextAuth callbacks
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
  
  response.cookies.set('auth_context', 'jaba', {
    path: '/',
    maxAge: 3600, // 1 hour
    httpOnly: true, // Server-side only
    sameSite: 'lax',
    secure: isProduction, // Secure flag for HTTPS in production
    // Don't set domain - let browser use current domain automatically
  })
  
  return response
}

