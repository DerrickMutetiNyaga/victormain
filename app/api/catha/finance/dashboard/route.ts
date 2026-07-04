import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { hasCathaPermission, normalizePermissions } from '@/lib/catha-permissions-model'
import {
  computeFinanceDashboard,
  financeDashboardToCsv,
  nairobiDayBounds,
} from '@/lib/catha-finance-dashboard'

function canViewFinanceDashboard(
  perms: ReturnType<typeof normalizePermissions>,
  role: string | undefined
): boolean {
  const r = (role ?? '').toUpperCase()
  if (r === 'SUPER_ADMIN' || r === 'ADMIN') return true
  if (hasCathaPermission(perms, 'reports', 'view')) return true
  if (hasCathaPermission(perms, 'mpesa', 'view')) return true
  return false
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as { role?: string }).role
    const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
    if (!canViewFinanceDashboard(perms, role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')?.trim() || undefined
    const format = (searchParams.get('format') || 'json').toLowerCase()

    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const snapshot = await computeFinanceDashboard(db, dateParam)

    if (format === 'csv') {
      const csv = financeDashboardToCsv(snapshot)
      const res = new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="catha-finance-${snapshot.date}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
      return res
    }

    const res = NextResponse.json({
      ...snapshot,
      timezone: 'Africa/Nairobi',
      generatedAt: new Date().toISOString(),
      bounds: nairobiDayBounds(dateParam),
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Finance Dashboard] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load finance dashboard', message },
      { status: 500 }
    )
  }
}
