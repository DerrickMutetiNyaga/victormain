import { NextResponse } from 'next/server'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getShopCustomerByPhone, updateShopCustomerProfile } from '@/lib/models/shop-customer'

async function getSessionPhone(): Promise<string | null> {
  const session = await getShopSessionFromCookie()
  return session?.phone ?? null
}

export async function GET() {
  const phone = await getSessionPhone()
  if (!phone) {
    return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 })
  }
  try {
    const customer = await getShopCustomerByPhone(phone)
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
    }
    const profile = customer.profile ?? {}
    return NextResponse.json({ success: true, phone: customer.phone, profile })
  } catch (error) {
    console.error('[ecommerce/profile] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const phone = await getSessionPhone()
  if (!phone) {
    return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const profile: Record<string, string> = {}
    if (typeof body.fullName === 'string') profile.fullName = body.fullName
    if (typeof body.email === 'string') profile.email = body.email
    if (typeof body.address === 'string') profile.address = body.address
    if (typeof body.city === 'string') profile.city = body.city
    if (typeof body.postalCode === 'string') profile.postalCode = body.postalCode
    const customer = await updateShopCustomerProfile(phone, profile)
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }
    return NextResponse.json({ success: true, profile: customer.profile ?? {} })
  } catch (error) {
    console.error('[ecommerce/profile] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
  }
}
