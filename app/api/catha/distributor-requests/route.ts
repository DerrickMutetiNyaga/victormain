import { NextResponse } from 'next/server'
import {
  getAllDistributorRequests,
  createDistributorRequest,
  seedDefaultDistributorRequests,
} from '@/lib/models/distributor-request'
import { requireCathaPermission } from '@/lib/auth-catha'

const DEFAULT_REQUESTS = [
  { id: '1', name: 'Premium Spirits Ltd', contact: 'John Mwangi', email: 'sales@premiumspirits.co.ke', phone: '0722 111 333', address: 'Westlands, Nairobi', products: 'Whisky, Vodka, Gin', status: 'pending' as const, submittedAt: new Date('2024-12-15'), notes: 'Specializes in premium imported spirits' },
  { id: '2', name: 'Craft Beer Co.', contact: 'Sarah Wanjiku', email: 'info@craftbeer.co.ke', phone: '0700 222 444', address: 'Kilimani, Nairobi', products: 'Craft Beer, Local Brews', status: 'approved' as const, submittedAt: new Date('2024-12-10'), reviewedAt: new Date('2024-12-12'), notes: 'Local craft brewery with excellent quality' },
  { id: '3', name: 'Soft Drinks Distributors', contact: 'Peter Ochieng', email: 'support@softdrinks.co.ke', phone: '0799 555 777', address: 'Industrial Area, Nairobi', products: 'Mixers, Energy Drinks, Juices', status: 'rejected' as const, submittedAt: new Date('2024-12-05'), reviewedAt: new Date('2024-12-07'), notes: 'Does not meet quality standards' },
  { id: '4', name: 'Wine Importers Kenya', contact: 'Mary Kamau', email: 'contact@wineimporters.co.ke', phone: '0711 888 999', address: 'Karen, Nairobi', products: 'Premium Wines, Champagne', status: 'pending' as const, submittedAt: new Date('2024-12-18'), notes: 'Exclusive wine distributor' },
  { id: '5', name: 'Bar Supplies Pro', contact: 'David Kipchoge', email: 'sales@barsupplies.co.ke', phone: '0723 444 555', address: 'Parklands, Nairobi', products: 'Bar Equipment, Glassware, Accessories', status: 'pending' as const, submittedAt: new Date('2024-12-20'), notes: 'Complete bar supply solutions' },
]

export async function GET() {
  const { allowed, response } = await requireCathaPermission('management.distributorRequests', 'view')
  if (!allowed && response) return response
  try {
    await seedDefaultDistributorRequests(DEFAULT_REQUESTS as any)
    const requests = await getAllDistributorRequests()
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
