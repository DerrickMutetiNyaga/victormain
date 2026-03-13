/**
 * Catha RBAC - Single source of truth for permissions and route mapping.
 * Used by: middleware, auth-catha, layout sidebar, API enforcement.
 */

import type { PagePermissionEntry } from './permissions'
import { PERMISSION_PAGE_ROUTES, type PermissionPageKey } from './permissions'

// ─── Route to page key map ───
export const ROUTE_PERMISSION_MAP: Record<string, PermissionPageKey> = {
  '/catha': 'dashboard',
  '/catha/pos': 'pos',
  '/catha/orders': 'orders',
  '/catha/tables': 'tables',
  '/catha/qr-tables': 'qr-tables',
  '/catha/inventory': 'inventory',
  '/catha/suppliers': 'suppliers',
  '/catha/stock-movement': 'stock-movement',
  '/catha/mpesa-transactions': 'mpesa-transactions',
  '/catha/expenses': 'expenses',
  '/catha/clients': 'clients',
  '/catha/users': 'users',
  '/catha/distributor-requests': 'distributor-requests',
  '/catha/reports': 'reports',
  '/catha/settings': 'settings',
}

export interface CathaUserForPermissions {
  role?: string
  status?: string
  approved?: boolean
  permissions?: PagePermissionEntry[]
  routePermissions?: string[]
}

export function getPageKeyForRoute(pathname: string): PermissionPageKey | null {
  const normalized = pathname.replace(/\/$/, '') || '/catha'
  const candidates = Object.entries(ROUTE_PERMISSION_MAP)
    .filter(([route]) => normalized === route || normalized.startsWith(route + '/'))
    .sort((a, b) => b[0].length - a[0].length)
  return (candidates[0]?.[1] as PermissionPageKey) ?? null
}

export function canViewCathaRoute(pageKey: PermissionPageKey | null, user: CathaUserForPermissions | null): boolean {
  if (!user || !pageKey) return false

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'disabled') return false
  if (!user.approved && role !== 'super_admin') return false

  if (role === 'super_admin') return true
  if (role === 'cashier_admin' || role === 'manager_admin') {
    const entry = user.permissions?.find((p) => p.pageKey === pageKey)
    return entry?.actions?.view === true
  }
  return false
}

export function canActionCatha(
  pageKey: PermissionPageKey | null,
  action: 'view' | 'create' | 'edit' | 'delete',
  user: CathaUserForPermissions | null
): boolean {
  if (!user || !pageKey) return false

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'disabled') return false
  if (!user.approved && role !== 'super_admin') return false

  if (role === 'super_admin') return true
  if (role === 'cashier_admin' || role === 'manager_admin') {
    const entry = user.permissions?.find((p) => p.pageKey === pageKey)
    if (!entry?.actions?.view) return false
    const actionKey = action === 'create' ? 'create' : action === 'edit' ? 'edit' : action === 'delete' ? 'delete' : 'view'
    return entry.actions[actionKey] === true
  }
  return false
}

export function buildAllowedRoutesFromPermissions(permissions: PagePermissionEntry[] | undefined): string[] {
  if (!permissions || !Array.isArray(permissions)) return []
  const routes: string[] = []
  permissions.forEach((perm) => {
    if (perm.actions?.view === true) {
      const route = PERMISSION_PAGE_ROUTES[perm.pageKey as PermissionPageKey]
      if (route) routes.push(route)
    }
  })
  return [...new Set(routes)]
}

export function getFirstAllowedRoute(user: CathaUserForPermissions | null): string {
  if (!user) return '/catha/waiting'

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'disabled') return '/catha/suspended'
  if (!user.approved && role !== 'super_admin') return '/catha/waiting'
  if (role === 'super_admin') return '/catha'

  const routePermissions = user.routePermissions ?? []
  const orderRoutes = ['/catha', '/catha/pos', '/catha/orders', '/catha/inventory', '/catha/suppliers', '/catha/reports', '/catha/settings']
  for (const route of orderRoutes) {
    const hasAccess = routePermissions.some((r) => route === r || (r !== '/' && route.startsWith(r + '/')))
    if (hasAccess) return route
  }
  if (routePermissions.length > 0) return routePermissions[0]
  return '/catha/waiting'
}
