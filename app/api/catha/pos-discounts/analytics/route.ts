import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { loadPosDiscountContext } from '@/lib/pos-product-discounts'
import { computeCampaignAnalytics, ensureCampaignIndexes } from '@/lib/pos-discount-campaigns'
import { canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
  if (!canViewPosDiscountsAdmin(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30)))

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureCampaignIndexes(db)
    const now = new Date()
    const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const rangeStart = new Date(rangeEnd)
    rangeStart.setDate(rangeStart.getDate() - days)

    const ctx = await loadPosDiscountContext(db, now)
    const campaigns = await computeCampaignAnalytics(db, ctx, rangeStart, rangeEnd)

    const totals = campaigns.reduce(
      (acc, row) => ({
        orders: acc.orders + row.orders,
        revenue: acc.revenue + row.revenue,
        discountGiven: acc.discountGiven + row.discountGiven,
      }),
      { orders: 0, revenue: 0, discountGiven: 0 }
    )

    return NextResponse.json({
      success: true,
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString(), days },
      totals,
      campaigns,
    })
  } catch (error: unknown) {
    console.error('[Promotion analytics] error:', error)
    return NextResponse.json({ error: 'Failed to load promotion analytics' }, { status: 500 })
  }
}
