import { NextResponse } from 'next/server'
import {
  getDistributorRequestsByType,
  createDistributorRequest,
} from '@/lib/models/distributor-request'
import { requireCathaPermission } from '@/lib/auth-catha'

export async function GET() {
  const { allowed, response } = await requireCathaPermission('management.distributorRequests', 'view')
  if (!allowed && response) return response
  try {
    const requests = await getDistributorRequestsByType('supplier')
    const formatted = requests.map((r) => ({
      ...r,
      submittedAt: r.submittedAt?.toISOString?.() ?? r.submittedAt,
      reviewedAt: r.reviewedAt?.toISOString?.() ?? r.reviewedAt,
    }))
    return NextResponse.json({ success: true, requests: formatted })
  } catch (error) {
    console.error('[catha/distributor-requests] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('management.distributorRequests', 'create')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const { name, contact, email, phone, address, products, notes } = body
    if (!name || !contact || !email || !phone) {
      return NextResponse.json({ success: false, error: 'Name, contact, email, and phone are required' }, { status: 400 })
    }
    const id = Date.now().toString()
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
      requestType: 'supplier',
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
    console.error('[catha/distributor-requests] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 })
  }
}
