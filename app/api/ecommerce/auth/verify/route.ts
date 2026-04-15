import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeShopAuthPhone, verifyAndConsumeShopAuthOtp } from '@/lib/shop-auth-otp'
import { findOrCreateShopCustomer } from '@/lib/models/shop-customer'
import { createShopSession } from '@/lib/models/shop-session'
import { getShopSessionCookieName, getShopSessionMaxAge, getShopSessionCookieOptions } from '@/lib/shop-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { logAuthSecurityEvent } from '@/lib/auth-security-audit'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const rl = checkRateLimit(`shop-auth-verify:${ip}`, 40, 60_000)
    if (!rl.ok) {
      logAuthSecurityEvent({
        route: '/api/ecommerce/auth/verify',
        action: 'POST',
        result: 'rate_limited',
        reason: 'ip_rate',
        ip,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json()
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const otp = typeof body.otp === 'string' ? body.otp : ''
    const establishSession = body.establishSession !== false

    if (!rawPhone || !otp.trim()) {
      return NextResponse.json(
        { success: false, error: 'Phone number and verification code are required' },
        { status: 400 }
      )
    }

    const phone = normalizeShopAuthPhone(rawPhone)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid Kenya number (e.g. 0712345678 or +254712345678)' },
        { status: 400 }
      )
    }

    const otpOk = await verifyAndConsumeShopAuthOtp(phone, otp)
    if (!otpOk) {
      logAuthSecurityEvent({
        route: '/api/ecommerce/auth/verify',
        action: 'POST',
        result: 'rejected',
        reason: 'invalid_otp',
        identifier: phone.replace(/\d(?=\d{4})/g, '*'),
        ip,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        { success: false, error: 'Invalid or expired code. Request a new one and try again.' },
        { status: 401 }
      )
    }

    if (!establishSession) {
      return NextResponse.json({ success: true, phone })
    }

    const { customer, isNew } = await findOrCreateShopCustomer(phone)
    const userId = (customer._id as { toString(): string }).toString()
    const session = await createShopSession(phone, userId)

    const cookieStore = await cookies()
    cookieStore.set(getShopSessionCookieName(), session.sessionId, {
      ...getShopSessionCookieOptions(),
      maxAge: getShopSessionMaxAge(),
    })

    logAuthSecurityEvent({
      route: '/api/ecommerce/auth/verify',
      action: 'POST',
      result: 'success',
      identifier: customer.phone.replace(/\d(?=\d{4})/g, '*'),
      userId,
      ip,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      phone: customer.phone,
      isNew,
    })
  } catch (error) {
    console.error('[ecommerce/auth/verify]', error)
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
