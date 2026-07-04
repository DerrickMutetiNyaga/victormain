import { NextResponse } from 'next/server'
import {
  getDistributorRequestsByType,
  createDistributorRequest,
} from '@/lib/models/distributor-request'
import { requireJabaRolesFromDb } from '@/lib/api-jaba-permissions'

export async function GET() {
  try {
    const authz = await requireJabaRolesFromDb(['super_admin', 'manager_admin'])
    if ('response' in authz) return authz.response

    const requests = await getDistributorRequestsByType('jaba_distributor')
    const formatted = requests.map((r) => ({
      ...r,
      submittedAt: r.submittedAt?.toISOString?.() ?? r.submittedAt,
      reviewedAt: r.reviewedAt?.toISOString?.() ?? r.reviewedAt,
    }))
    return NextResponse.json({ success: true, requests: formatted })
  } catch (error) {
    console.error('[jaba/distributor-requests] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authz = await requireJabaRolesFromDb(['super_admin', 'manager_admin'])
    if ('response' in authz) return authz.response

    const body = await request.json()
    const { name, contact, email, phone, address, products, notes } = body
    if (!name || !contact || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name, contact, email, and phone are required' },
        { status: 400 }
      )
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const req = await createDistributorRequest({
      id,
      name,
      contact,
      email,
      phone,
      address,
      products: products || '',
      status: 'pending',
      submittedAt: new Date(),
      notes,
      requestType: 'jaba_distributor',
    })
    return NextResponse.json({
      success: true,
      request: {
        ...req,
        submittedAt: req.submittedAt?.toISOString?.() ?? req.submittedAt,
        reviewedAt: req.reviewedAt?.toISOString?.() ?? req.reviewedAt,
      },
    })
  } catch (error) {
    console.error('[jaba/distributor-requests] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 })
  }
}
