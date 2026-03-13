/**
 * Jaba RBAC - Single source of truth for permissions and route mapping.
 * Used by: middleware, auth-jaba, layout navbar, page guards, API enforcement.
 */

import type { UserPermissions } from './models/user'

// ─── Permission keys (dot notation) ───
export const PERMISSION_KEYS = {
  // Production
  'production.batches': true,
  'production.addBatch': true,
  'production.packaging': true,
  'production.createSession': true,
  'production.rawMaterials': true,
  'production.addMaterial': true,
  'production.qcChecklist': true,
  'production.qcResults': true,
  // Distribution
  'distribution.main': true,
  'distribution.create': true,
  'distribution.dispatch': true,
  'distribution.suppliers': true,
  'distribution.addSupplier': true,
  'distribution.distributors': true,
  'distribution.addDistributor': true,
  // Storage
  'storage.finished': true,
  'storage.movement': true,
  // Reports
  'reports.batches': true,
  'reports.production': true,
  'reports.materials': true,
  'reports.distribution': true,
  'reports.main': true,
  // System
  'system.dashboard': true,
  'system.users': true,
  'system.settings': true,
} as const

export type PermissionKey = keyof typeof PERMISSION_KEYS

// ─── Route to permission key map ───
export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey> = {
  '/jaba': 'system.dashboard',
  '/jaba/batches': 'production.batches',
  '/jaba/batches/add': 'production.addBatch',
  '/jaba/batches/edit': 'production.addBatch', // edit uses addBatch permission (edit batch)
  '/jaba/batches/': 'production.batches',      // [id] pages
  '/jaba/packaging-output': 'production.packaging',
  '/jaba/packaging-output/add': 'production.createSession',
  '/jaba/qc/checklist': 'production.qcChecklist',
  '/jaba/qc/results': 'production.qcResults',
  '/jaba/raw-materials': 'production.rawMaterials',
  '/jaba/raw-materials/add': 'production.addMaterial',
  '/jaba/distribution': 'distribution.main',
  '/jaba/distribution/create': 'distribution.create',
  '/jaba/distribution/dispatch': 'distribution.dispatch',
  '/jaba/suppliers': 'distribution.suppliers',
  '/jaba/suppliers/add': 'distribution.addSupplier',
  '/jaba/distributors': 'distribution.distributors',
  '/jaba/distributors/add': 'distribution.addDistributor',
  '/jaba/storage/finished': 'storage.finished',
  '/jaba/storage/movement': 'storage.movement',
  '/jaba/reports': 'reports.main',
  '/jaba/reports/batches': 'reports.batches',
  '/jaba/reports/production': 'reports.production',
  '/jaba/reports/materials': 'reports.materials',
  '/jaba/reports/distribution': 'reports.distribution',
  '/jaba/users': 'system.users',
  '/jaba/settings': 'system.settings',
}

// Map page IDs to routes (for building routePermissions from UserPermissions)
export const PAGE_ID_TO_ROUTE: Record<string, string> = {
  dashboard: '/jaba',
  batches: '/jaba/batches',
  'batches-add': '/jaba/batches/add',
  packaging: '/jaba/packaging-output',
  'raw-materials': '/jaba/raw-materials',
  'raw-materials-add': '/jaba/raw-materials/add',
  'qc-checklist': '/jaba/qc/checklist',
  'qc-results': '/jaba/qc/results',
  distribution: '/jaba/distribution',
  'distribution-create': '/jaba/distribution/create',
  dispatch: '/jaba/distribution/dispatch',
  suppliers: '/jaba/suppliers',
  'suppliers-add': '/jaba/suppliers/add',
  distributors: '/jaba/distributors',
  'distributors-add': '/jaba/distributors/add',
  'storage-finished': '/jaba/storage/finished',
  'storage-movement': '/jaba/storage/movement',
  'reports-batches': '/jaba/reports/batches',
  'reports-production': '/jaba/reports/production',
  'reports-materials': '/jaba/reports/materials',
  'reports-distribution': '/jaba/reports/distribution',
  users: '/jaba/users',
  settings: '/jaba/settings',
}

// Map permission keys to legacy page IDs (used in UserPermissions object)
export const PERMISSION_KEY_TO_PAGE_ID: Record<PermissionKey, string> = {
  'production.batches': 'batches',
  'production.addBatch': 'batches-add',
  'production.packaging': 'packaging',
  'production.createSession': 'packaging-add',
  'production.rawMaterials': 'raw-materials',
  'production.addMaterial': 'raw-materials-add',
  'production.qcChecklist': 'qc-checklist',
  'production.qcResults': 'qc-results',
  'distribution.main': 'distribution',
  'distribution.create': 'distribution-create',
  'distribution.dispatch': 'dispatch',
  'distribution.suppliers': 'suppliers',
  'distribution.addSupplier': 'suppliers-add',
  'distribution.distributors': 'distributors',
  'distribution.addDistributor': 'distributors-add',
  'storage.finished': 'storage-finished',
  'storage.movement': 'storage-movement',
  'reports.batches': 'reports-batches',
  'reports.production': 'reports-production',
  'reports.materials': 'reports-materials',
  'reports.distribution': 'reports-distribution',
  'reports.main': 'reports-batches',
  'system.dashboard': 'dashboard',
  'system.users': 'users',
  'system.settings': 'settings',
}

export interface JabaUserForPermissions {
  role?: string
  status?: string
  approved?: boolean
  permissions?: UserPermissions
  routePermissions?: string[]
}

/**
 * Get permission key for a pathname.
 * Checks exact and prefix matches (more specific first).
 */
export function getPermissionKeyForRoute(pathname: string): PermissionKey | null {
  const normalized = pathname.replace(/\/$/, '') || '/jaba'
  const candidates = Object.entries(ROUTE_PERMISSION_MAP)
    .filter(([route]) => normalized === route || normalized.startsWith(route + '/'))
    .sort((a, b) => b[0].length - a[0].length)
  return (candidates[0]?.[1] as PermissionKey) ?? null
}

/**
 * Can user view this route? (page-level access)
 */
export function canView(routeKey: PermissionKey | null, user: JabaUserForPermissions | null): boolean {
  if (!user || !routeKey) return false

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'inactive') return false
  if (!user.approved && role !== 'super_admin') return false

  if (role === 'super_admin') return true
  if (role === 'cashier_admin' || role === 'manager_admin') {
    const pageId = PERMISSION_KEY_TO_PAGE_ID[routeKey]
    return user.permissions?.[pageId]?.view === true
  }
  return false
}

/**
 * Can user perform action (add/edit/delete) on this route?
 */
export function canAction(
  routeKey: PermissionKey | null,
  action: 'add' | 'edit' | 'delete',
  user: JabaUserForPermissions | null
): boolean {
  if (!user || !routeKey) return false

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'inactive') return false
  if (!user.approved && role !== 'super_admin') return false

  if (role === 'super_admin') return true
  if (role === 'cashier_admin' || role === 'manager_admin') {
    const pageId = PERMISSION_KEY_TO_PAGE_ID[routeKey]
    const perms = user.permissions?.[pageId]
    if (!perms?.view) return false
    const actionKey = action === 'add' ? 'add' : action === 'edit' ? 'edit' : 'delete'
    return perms[actionKey] === true
  }
  return false
}

/**
 * Get first allowed route for user (for redirect after approval).
 */
export function getFirstAllowedRoute(user: JabaUserForPermissions | null): string {
  if (!user) return '/jaba/waiting'

  const role = user.role?.toLowerCase()
  const status = user.status?.toLowerCase()

  if (status === 'inactive') return '/jaba/account-suspended'
  if (!user.approved && role !== 'super_admin') return '/jaba/waiting'
  if (role === 'super_admin') return '/jaba'

  const routePermissions = user.routePermissions ?? []
  const orderRoutes = ['/jaba', '/jaba/batches', '/jaba/packaging-output', '/jaba/raw-materials', '/jaba/distribution', '/jaba/reports/batches', '/jaba/settings']
  for (const route of orderRoutes) {
    const hasAccess = routePermissions.some(r => route === r || (r !== '/' && route.startsWith(r + '/')))
    if (hasAccess) return route
  }
  if (routePermissions.length > 0) return routePermissions[0]
  return '/jaba/waiting'
}

/**
 * Build route permissions array from UserPermissions (for session).
 */
export function buildRoutePermissionsFromUserPermissions(permissions: UserPermissions | undefined): string[] {
  if (!permissions) return []
  const routes: string[] = []
  for (const [pageId, perms] of Object.entries(permissions)) {
    if (perms.view) {
      const route = PAGE_ID_TO_ROUTE[pageId]
      if (route) routes.push(route)
    }
  }
  return [...new Set(routes)]
}
