import { redirect } from 'next/navigation'
import { requireCathaAuth } from '@/lib/catha-auth'
import { getCathaUserByEmail } from '@/lib/models/catha-user'
import { normalizePermissions, hasCathaPermission, type CathaPermissions } from '@/lib/catha-permissions-model'

type RouteModule = {
  route: string
  module: keyof CathaPermissions
}

// Stable priority order for first-page selection after login.
const ROUTE_PRIORITY: RouteModule[] = [
  { route: '/catha/pos', module: 'pos' },
  { route: '/catha/orders', module: 'orders' },
  { route: '/catha/tables', module: 'tables' },
  { route: '/catha/inventory', module: 'inventory' },
  { route: '/catha/reports', module: 'reports' },
  { route: '/catha/settings', module: 'settings' },
  { route: '/catha', module: 'dashboard' },
]

function firstAllowedRoute(role: string | undefined, rawPermissions: unknown): string {
  const normalizedRole = (role ?? '').toUpperCase()

  // SUPER_ADMIN: use configured route priority directly.
  if (normalizedRole === 'SUPER_ADMIN') {
    return ROUTE_PRIORITY[0]?.route ?? '/catha'
  }

  const permissions = normalizePermissions(rawPermissions)

  for (const entry of ROUTE_PRIORITY) {
    if (hasCathaPermission(permissions, entry.module, 'view')) {
      return entry.route
    }
  }

  // If nothing matches, fall back to access denied page.
  return '/catha/access-denied'
}

export default async function CathaEntryPage() {
  const session = await requireCathaAuth()
  const email = session.user?.email
  if (!email) redirect('/catha/login')

  /** DB is source of truth for role/permissions (same as User Management + /api/catha/auth/me). */
  const row = await getCathaUserByEmail(email)
  if (!row) redirect('/catha/access-denied')

  const st = (row.status ?? 'PENDING').toUpperCase()
  if (st === 'PENDING') redirect('/catha/waiting')
  if (st === 'DISABLED') redirect('/catha/disabled')

  const route = firstAllowedRoute(row.role, row.permissions)
  redirect(route)
}


