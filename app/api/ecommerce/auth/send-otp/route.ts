import { NextResponse } from 'next/server'
import { normalizeShopAuthPhone, requestShopAuthOtp } from '@/lib/shop-auth-otp'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { logAuthSecurityEvent } from '@/lib/auth-security-audit'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const rl = checkRateLimit(`shop-auth-send-otp:${ip}`, 20, 60_000)
    if (!rl.ok) {
      logAuthSecurityEvent({
        route: '/api/ecommerce/auth/send-otp',
        action: 'POST',
        result: 'rate_limited',
        reason: 'ip_rate',
        ip,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json()
    const raw = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (!raw) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
    }

    const phone = normalizeShopAuthPhone(raw)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid Kenya number (e.g. 0712345678 or +254712345678)' },
        { status: 400 }
      )
    }

    await requestShopAuthOtp(phone)
    logAuthSecurityEvent({
      route: '/api/ecommerce/auth/send-otp',
      action: 'POST',
      result: 'success',
      identifier: phone.replace(/\d(?=\d{4})/g, '*'),
      ip,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    if (message.includes('Wait a moment')) {
      logAuthSecurityEvent({
        route: '/api/ecommerce/auth/send-otp',
        action: 'POST',
        result: 'rate_limited',
        reason: 'cooldown',
        ip,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json({ success: false, error: message }, { status: 429 })
    }
    console.error('[ecommerce/auth/send-otp]', error)
    return NextResponse.json(
      { success: false, error: message || 'Could not send verification code' },
      { status: 500 }
    )
  }
}
