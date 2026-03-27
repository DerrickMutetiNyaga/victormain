/**
 * Shop session auth - cookie contains ONLY opaque sessionId (no phone).
 * Phone and userId are stored in DB (shop_sessions collection).
 */

import { cookies } from 'next/headers'
import { getShopSession } from '@/lib/models/shop-session'

const COOKIE_NAME = 'shop_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 365 // 1 year

export function getShopSessionCookieName(): string {
  return COOKIE_NAME
}

export function getShopSessionMaxAge(): number {
  return MAX_AGE_SEC
}

/** Production-safe cookie options: httpOnly, secure (HTTPS), sameSite, path */
export function getShopSessionCookieOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  maxAge: number
  path: string
} {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXTAUTH_URL?.startsWith('https://')

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: MAX_AGE_SEC,
    path: '/',
  }
}

/** Get session data from cookie - looks up sessionId in DB, returns phone & userId (never exposes raw phone in cookie) */
export async function getShopSessionFromCookie(): Promise<{
  phone: string
  userId: string
} | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(getShopSessionCookieName())?.value
  if (!sessionId) return null
  const session = await getShopSession(sessionId)
  if (!session) return null
  return { phone: session.phone, userId: session.userId }
}
