import { NextResponse } from 'next/server'
import { getCathaSession } from '@/lib/catha-auth'
import { getAllCathaUsers } from '@/lib/models/catha-user'

/** GET /api/catha/cashiers - List Catha users with role CASHIER and status ACTIVE. Auth required. Catha-only (no Jaba). */
export async function GET() {
  const session = await getCathaSession()
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
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
