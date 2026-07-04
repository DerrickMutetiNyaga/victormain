import { NextResponse } from 'next/server'
import { requireCathaPermission } from '@/lib/auth-catha'
import { getAllCathaUsers } from '@/lib/models/catha-user'

/** GET /api/catha/cashiers - List active cashiers. Requires POS sales view (or super admin). */
export async function GET() {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'view')
  if (!allowed) return response
  try {
    const users = await getAllCathaUsers()
    const cashiers = users.filter((u) => u.role === 'CASHIER' && u.status === 'ACTIVE')
    const items = cashiers.map((u) => ({
      id: u._id?.toString(),
      name: u.name,
      email: u.email,
    }))
    return NextResponse.json({ ok: true, cashiers: items })
  } catch (error) {
    console.error('[catha/cashiers] Error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to fetch cashiers' }, { status: 500 })
  }
}
