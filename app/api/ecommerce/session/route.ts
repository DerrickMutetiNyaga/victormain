import { NextResponse } from 'next/server'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getShopCustomerByPhone } from '@/lib/models/shop-customer'

export async function GET() {
  try {
    const session = await getShopSessionFromCookie()
    if (!session) {
      return NextResponse.json({ signedIn: false }, { status: 200 })
    }
    const customer = await getShopCustomerByPhone(session.phone)
    if (!customer) {
      return NextResponse.json({ signedIn: false }, { status: 200 })
    }
    return NextResponse.json({
      signedIn: true,
      customer: {
        id: (customer._id as any).toString(),
        phone: customer.phone,
        name: customer.profile?.fullName ?? '',
      },
    })
  } catch {
    return NextResponse.json({ signedIn: false }, { status: 200 })
  }
}
