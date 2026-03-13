/**
 * CATHA Access Control - Single source of truth.
 * Canonical roles: SUPER_ADMIN, MANAGER, CASHIER.
 * Canonical status: PENDING, ACTIVE, SUSPENDED.
 * Canonical permissions: Record<canonicalKey, PermissionEntry>.
 * DENY BY DEFAULT everywhere.
 * Super admin: ALWAYS sees all nav links (even if permissions object empty).
 */

// ─── Canonical status ───
export const CANONICAL_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number]

/** Map DB/session status to canonical. Handles disabled, active, pending, suspended, etc. */
export function normalizeStatus(status: string | undefined | null): CanonicalStatus {
  if (status === undefined || status === null || status === '') return 'PENDING'
  const s = String(status).toLowerCase().trim()
  if (s === 'disabled' || s === 'suspended' || s === 'inactive') return 'SUSPENDED'
  if (s === 'active' || s === 'approved') return 'ACTIVE'
  return 'PENDING'
}

// ─── Canonical roles (UI/API use these; DB may store cashier_admin, manager_admin, super_admin) ───
export const CANONICAL_ROLES = ['SUPER_ADMIN', 'MANAGER', 'CASHIER'] as const
export type CanonicalRole = (typeof CANONICAL_ROLES)[number]

/** Map DB/session role to canonical. Handles super_admin, SUPER_ADMIN, manager_admin, etc. */
export function normalizeRole(role: string | undefined | null): CanonicalRole | 'PENDING' | 'USER' {
  if (role === undefined || role === null || role === '') return 'USER'
  const r = String(role).toLowerCase().trim()
  if (r === 'super_admin' || r === 'superadmin' || r === 'super admin') return 'SUPER_ADMIN'
  if (r === 'manager_admin' || r === 'manager' || r === 'manager admin') return 'MANAGER'
  if (r === 'cashier_admin' || r === 'cashier' || r === 'cashier admin') return 'CASHIER'
  if (r === 'pending') return 'PENDING'
  return 'USER'
}

// ─── Canonical permission schema (DB + UI) ───
export type PermissionEntry = { view: boolean; create: boolean; edit: boolean; delete: boolean }
export type Permissions = Record<string, PermissionEntry>

/** Canonical permission keys - MUST match DB + UI. Each has { view, create, edit, delete }. */
export const CANONICAL_PERMISSION_KEYS = [
  'system.dashboard',
  'system.userManagement',
  'system.settings',
  'system.reports',
  'sales.posSales',
  'sales.orders',
  'operations.tables',
  'operations.tableQrCodes',
  'inventory.inventory',
  'inventory.suppliers',
  'inventory.stockMovement',
  'financial.mpesaTransactions',
  'financial.expenses',
  'management.clients',
  'management.distributorRequests',
] as const

export type CanonicalPermissionKey = (typeof CANONICAL_PERMISSION_KEYS)[number]

/** Human-readable labels for modal and UI */
export const CANONICAL_PERMISSION_LABELS: Record<CanonicalPermissionKey, string> = {
  'system.dashboard': 'Dashboard',
  'system.userManagement': 'User Management',
  'system.settings': 'Settings',
  'system.reports': 'Reports',
  'sales.posSales': 'POS Sales',
  'sales.orders': 'Orders',
  'operations.tables': 'Tables',
  'operations.tableQrCodes': 'Table QR Codes',
  'inventory.inventory': 'Inventory',
  'inventory.suppliers': 'Suppliers',
  'inventory.stockMovement': 'Stock Movement',
  'financial.mpesaTransactions': 'M-Pesa Transactions',
  'financial.expenses': 'Expenses',
  'management.clients': 'Clients',
  'management.distributorRequests': 'Distributor Requests',
}

/** Legacy DB pageKey -> canonical key */
export const LEGACY_PAGEKEY_TO_CANONICAL: Record<string, CanonicalPermissionKey> = {
  dashboard: 'system.dashboard',
  pos: 'sales.posSales',
  orders: 'sales.orders',
  tables: 'operations.tables',
  'qr-tables': 'operations.tableQrCodes',
  inventory: 'inventory.inventory',
  suppliers: 'inventory.suppliers',
  'stock-movement': 'inventory.stockMovement',
  'mpesa-transactions': 'financial.mpesaTransactions',
  expenses: 'financial.expenses',
  clients: 'management.clients',
  users: 'system.userManagement',
  'distributor-requests': 'management.distributorRequests',
  reports: 'system.reports',
  settings: 'system.settings',
}

/** Canonical key -> legacy pageKey (for backward compat with legacy DB shape) */
export const CANONICAL_TO_LEGACY: Record<CanonicalPermissionKey, string> = {
  'system.dashboard': 'dashboard',
  'system.userManagement': 'users',
  'system.settings': 'settings',
  'system.reports': 'reports',
  'sales.posSales': 'pos',
  'sales.orders': 'orders',
  'operations.tables': 'tables',
  'operations.tableQrCodes': 'qr-tables',
  'inventory.inventory': 'inventory',
  'inventory.suppliers': 'suppliers',
  'inventory.stockMovement': 'stock-movement',
  'financial.mpesaTransactions': 'mpesa-transactions',
  'financial.expenses': 'expenses',
  'management.clients': 'clients',
  'management.distributorRequests': 'distributor-requests',
}

export interface NormalizedPermission {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

/** Raw permission entry from DB/session: supports legacy pageKey + actions or canonical key + flat shape */
export interface RawPermissionEntry {
  permissionKey?: string
  pageKey?: string
  view?: boolean
  create?: boolean
  add?: boolean
  edit?: boolean
  delete?: boolean
  actions?: {
    view?: boolean
    create?: boolean
    add?: boolean
    edit?: boolean
    delete?: boolean
  }
}

/** Normalize any permission shape to { view, create, edit, delete }. Deny by default. */
export function normalizePerm(perm: RawPermissionEntry | PermissionEntry | null | undefined): NormalizedPermission {
  if (!perm) return { view: false, create: false, edit: false, delete: false }
  const p = perm as RawPermissionEntry
  const v = (p as PermissionEntry).view ?? p.view ?? p.actions?.view ?? false
  const c = (p as PermissionEntry).create ?? p.create ?? p.add ?? p.actions?.create ?? p.actions?.add ?? false
  const e = (p as PermissionEntry).edit ?? p.edit ?? p.actions?.edit ?? false
  const d = (p as PermissionEntry).delete ?? p.delete ?? p.actions?.delete ?? false
  return { view: v === true, create: c === true, edit: e === true, delete: d === true }
}

/** Get canonical permission key from raw entry (supports legacy pageKey) */
export function getCanonicalKey(entry: RawPermissionEntry | { pageKey?: string; permissionKey?: string }): string | null {
  if (entry.permissionKey && CANONICAL_PERMISSION_KEYS.includes(entry.permissionKey as CanonicalPermissionKey))
    return entry.permissionKey
  if (entry.pageKey && LEGACY_PAGEKEY_TO_CANONICAL[entry.pageKey]) return LEGACY_PAGEKEY_TO_CANONICAL[entry.pageKey]
  return null
}

/** Convert legacy permissions array to canonical Record. One-time mapping when loading old users. */
export function legacyToCanonicalPermissions(raw: RawPermissionEntry[] | Permissions | undefined): Permissions {
  if (!raw) return {}
  if (!Array.isArray(raw)) {
    if (typeof raw === 'object' && raw !== null && !('pageKey' in raw)) return raw as Permissions
  }
  const result: Permissions = {}
  for (const p of raw as RawPermissionEntry[]) {
    const key = getCanonicalKey(p)
    if (!key || !(key in result)) {
      if (key) result[key] = normalizePerm(p)
    }
  }
  return result
}

/** Get permission entry for a canonical key from user permissions (supports both legacy array and canonical Record). */
function getEntryForKey(
  permissions: RawPermissionEntry[] | Permissions | undefined,
  permissionKey: string
): NormalizedPermission {
  if (!permissions) return { view: false, create: false, edit: false, delete: false }
  if (Array.isArray(permissions)) {
    const entry = permissions.find((p) => getCanonicalKey(p) === permissionKey)
    return normalizePerm(entry)
  }
  // Try canonical key first (e.g. system.dashboard)
  let entry = (permissions as Permissions)[permissionKey]
  // Fallback: DB may store legacy pageKey (e.g. dashboard) - map canonical -> pageKey
  if (entry === undefined && permissionKey in CANONICAL_TO_LEGACY) {
    const legacyKey = CANONICAL_TO_LEGACY[permissionKey as CanonicalPermissionKey]
    entry = (permissions as Permissions)[legacyKey]
  }
  return normalizePerm(entry)
}

// ─── Route -> canonical permission key. Public routes = null ───
export const ROUTE_PERMISSION_MAP: Record<string, CanonicalPermissionKey | null> = {
  '/catha': 'system.dashboard',
  '/catha/pos': 'sales.posSales',
  '/catha/orders': 'sales.orders',
  '/catha/tables': 'operations.tables',
  '/catha/qr-tables': 'operations.tableQrCodes',
  '/catha/inventory': 'inventory.inventory',
  '/catha/suppliers': 'inventory.suppliers',
  '/catha/stock-movement': 'inventory.stockMovement',
  '/catha/mpesa-transactions': 'financial.mpesaTransactions',
  '/catha/expenses': 'financial.expenses',
  '/catha/clients': 'management.clients',
  '/catha/users': 'system.userManagement',
  '/catha/distributor-requests': 'management.distributorRequests',
  '/catha/reports': 'system.reports',
  '/catha/settings': 'system.settings',
  '/catha/login': null,
  '/catha/signup': null,
  '/catha/waiting': null,
  '/catha/access-denied': null,
  '/catha/suspended': null,
}

/** Route for each canonical key */
export const CANONICAL_TO_ROUTE: Record<CanonicalPermissionKey, string> = {
  'system.dashboard': '/catha',
  'system.userManagement': '/catha/users',
  'system.settings': '/catha/settings',
  'system.reports': '/catha/reports',
  'sales.posSales': '/catha/pos',
  'sales.orders': '/catha/orders',
  'operations.tables': '/catha/tables',
  'operations.tableQrCodes': '/catha/qr-tables',
  'inventory.inventory': '/catha/inventory',
  'inventory.suppliers': '/catha/suppliers',
  'inventory.stockMovement': '/catha/stock-movement',
  'financial.mpesaTransactions': '/catha/mpesa-transactions',
  'financial.expenses': '/catha/expenses',
  'management.clients': '/catha/clients',
  'management.distributorRequests': '/catha/distributor-requests',
}

/** All nav routes (for super admin - always sees all). */
export const ALL_NAV_ROUTES: string[] = Object.values(CANONICAL_TO_ROUTE)

/** Match pathname to permission key. Supports nested routes (e.g. /catha/inventory/123 -> inventory.inventory). Most specific prefix wins. Returns null for public. */
export function matchRoutePermission(pathname: string): CanonicalPermissionKey | null {
  const n = (pathname || '/catha').replace(/\/$/, '') || '/catha'
  const candidates = Object.entries(ROUTE_PERMISSION_MAP)
    .filter(([route]) => n === route || (route !== '/' && n.startsWith(route + '/')))
    .sort((a, b) => b[0].length - a[0].length)
  const key = candidates[0]?.[1]
  return key ?? null
}

export interface CathaAccessUser {
  role?: string
  status?: string
  approved?: boolean
  permissions?: RawPermissionEntry[] | Permissions
  routePermissions?: string[]
}

export function isSuperAdmin(user: CathaAccessUser | null): boolean {
  if (!user) return false
  return normalizeRole(user.role) === 'SUPER_ADMIN'
}

/** User is ACTIVE (can access app). Super admin always active. Others require status ACTIVE. */
export function isActive(user: CathaAccessUser | null): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return normalizeStatus(user.status) === 'ACTIVE'
}

/** DENY BY DEFAULT. SUPER_ADMIN always returns true (even if permissions empty). */
export function canView(user: CathaAccessUser | null, permissionKey: CanonicalPermissionKey | string | null): boolean {
  if (!user || !permissionKey) return false
  if (isSuperAdmin(user)) return true
  if (!isActive(user)) return false
  const role = normalizeRole(user.role)
  if (role !== 'CASHIER' && role !== 'MANAGER') return false
  const entry = getEntryForKey(user.permissions, permissionKey)
  return entry.view === true
}

/** DENY BY DEFAULT. SUPER_ADMIN always returns true. */
export function canAction(
  user: CathaAccessUser | null,
  permissionKey: CanonicalPermissionKey | string | null,
  action: 'view' | 'create' | 'edit' | 'delete'
): boolean {
  if (!user || !permissionKey) return false
  if (isSuperAdmin(user)) return true
  if (!isActive(user)) return false
  const role = normalizeRole(user.role)
  if (role !== 'CASHIER' && role !== 'MANAGER') return false
  const entry = getEntryForKey(user.permissions, permissionKey)
  if (!entry.view) return false
  if (action === 'view') return true
  if (action === 'create') return entry.create === true
  if (action === 'edit') return entry.edit === true
  if (action === 'delete') return entry.delete === true
  return false
}

/** Build allowed routes from permissions. Super admin => all nav routes. Manager/Cashier => only view=true. DENY BY DEFAULT. */
export function buildAllowedRoutes(
  permissions: RawPermissionEntry[] | Permissions | undefined,
  isSuperAdminUser?: boolean
): string[] {
  if (isSuperAdminUser === true) return [...ALL_NAV_ROUTES]
  if (!permissions) return []
  const routes: string[] = []
  for (const key of CANONICAL_PERMISSION_KEYS) {
    const entry = getEntryForKey(permissions, key)
    if (entry?.view === true) {
      const route = CANONICAL_TO_ROUTE[key]
      if (route) routes.push(route)
    }
  }
  return [...new Set(routes)]
}

function hasRoute(pathname: string, routePermissions: string[]): boolean {
  const n = (pathname || '').replace(/\/$/, '') || pathname
  return routePermissions.some((r) => {
    const q = (r || '').replace(/\/$/, '') || r
    if (q === '/catha') return n === '/catha'
    return n === q || n.startsWith(q + '/')
  })
}

export function getFirstAllowedRoute(user: CathaAccessUser | null): string {
  if (!user) return '/catha/waiting'
  const status = normalizeStatus(user.status)
  if (!isActive(user)) return status === 'SUSPENDED' ? '/catha/suspended' : '/catha/waiting'
  if (isSuperAdmin(user)) return '/catha'
  const routes = user.routePermissions ?? buildAllowedRoutes(user.permissions)
  const order: string[] = ['/catha', '/catha/pos', '/catha/orders', '/catha/inventory', '/catha/suppliers', '/catha/reports', '/catha/settings']
  for (const r of order) {
    if (hasRoute(r, routes)) return r
  }
  if (routes.length > 0) return routes[0]
  return '/catha/waiting'
}

/** Permission groups for modal (canonical keys) */
export const CANONICAL_PERMISSION_GROUPS: Record<string, CanonicalPermissionKey[]> = {
  System: ['system.dashboard', 'system.userManagement', 'system.settings', 'system.reports'],
  Sales: ['sales.posSales', 'sales.orders'],
  Operations: ['operations.tables', 'operations.tableQrCodes'],
  Inventory: ['inventory.inventory', 'inventory.suppliers', 'inventory.stockMovement'],
  Financial: ['financial.mpesaTransactions', 'financial.expenses'],
  Management: ['management.clients', 'management.distributorRequests'],
}

/** Legacy PagePermissionEntry shape (for UI modal - internal state) */
export interface LegacyPermissionEntry {
  pageKey: string
  actions: { view: boolean; create: boolean; edit: boolean; delete: boolean }
}

/** Ensure permissions array has an entry for this canonical key (legacy pageKey). Returns new array. */
export function ensurePermissionEntry(
  permissions: LegacyPermissionEntry[],
  canonicalKey: CanonicalPermissionKey
): LegacyPermissionEntry[] {
  const pageKey = CANONICAL_TO_LEGACY[canonicalKey]
  const exists = permissions.some((p) => p.pageKey === pageKey)
  if (exists) return permissions
  return [...permissions, { pageKey, actions: { view: false, create: false, edit: false, delete: false } }]
}

/** Get entry for canonical key from raw permissions (supports legacy array and canonical Record). */
export function getEntryForCanonicalKey(
  permissions: RawPermissionEntry[] | LegacyPermissionEntry[] | Permissions,
  canonicalKey: CanonicalPermissionKey
): NormalizedPermission {
  if (!Array.isArray(permissions) && typeof permissions === 'object') {
    const entry = (permissions as Permissions)[canonicalKey]
    return normalizePerm(entry)
  }
  const pageKey = CANONICAL_TO_LEGACY[canonicalKey]
  const entry = (permissions as RawPermissionEntry[]).find(
    (p) => (p as RawPermissionEntry).pageKey === pageKey || (p as RawPermissionEntry).permissionKey === canonicalKey
  )
  return normalizePerm(entry as RawPermissionEntry)
}

/** Convert legacy PagePermissionEntry[] or RawPermissionEntry[] to canonical Permissions for DB save. */
export function toCanonicalPermissions(
  raw: LegacyPermissionEntry[] | RawPermissionEntry[]
): Permissions {
  const result: Permissions = {}
  for (const p of raw) {
    const key = getCanonicalKey(p as RawPermissionEntry) ?? (p as RawPermissionEntry).permissionKey
    if (key && CANONICAL_PERMISSION_KEYS.includes(key as CanonicalPermissionKey)) {
      result[key] = normalizePerm(p)
    }
  }
  return result
}

/** Convert canonical Permissions to LegacyPermissionEntry[] for UI modal. */
export function canonicalToLegacyForUI(perms: Permissions | undefined): LegacyPermissionEntry[] {
  if (!perms || typeof perms !== 'object') return []
  const result: LegacyPermissionEntry[] = []
  for (const key of CANONICAL_PERMISSION_KEYS) {
    const entry = perms[key]
    const pageKey = CANONICAL_TO_LEGACY[key]
    result.push({
      pageKey,
      actions: entry ? normalizePerm(entry) : { view: false, create: false, edit: false, delete: false },
    })
  }
  return result
}
