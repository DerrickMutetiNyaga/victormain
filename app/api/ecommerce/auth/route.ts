import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { findOrCreateShopCustomer } from '@/lib/models/shop-customer'
import { createShopSession } from '@/lib/models/shop-session'
import { getShopSessionCookieName, getShopSessionMaxAge, getShopSessionCookieOptions } from '@/lib/shop-auth'

// Kenya only: +254 followed by exactly 9 digits (e.g. +254712345678). Local form: 10 digits including 0 (0712345678).
const KENYA_FULL_REGEX = /^\+254\d{9}$/

function normalizeAndValidateKenya(phone: string): string | null {
  const normalized = normalizeKenyaPhone(phone)
  if (!normalized) return null
  if (!KENYA_FULL_REGEX.test(normalized)) return null
  return normalized
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const raw = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (!raw) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const phone = normalizeAndValidateKenya(raw)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid Kenya number (e.g. 0712345678 or +254712345678)' },
        { status: 400 }
      )
    }

    const { customer, isNew } = await findOrCreateShopCustomer(phone)
    const userId = (customer._id as any).toString()

    // Create session in DB - phone stored server-side only, never in cookie
    const session = await createShopSession(phone, userId)

    const cookieStore = await cookies()
    cookieStore.set(getShopSessionCookieName(), session.sessionId, {
      ...getShopSessionCookieOptions(),
      maxAge: getShopSessionMaxAge(),
    })

    return NextResponse.json({
      success: true,
      phone: customer.phone,
      isNew,
    })
  } catch (error) {
    console.error('[ecommerce/auth]', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
