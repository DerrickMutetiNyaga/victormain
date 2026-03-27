/**
 * Permission keys and page definitions for /catha access control.
 * Only super_admin can access /catha/users; admins see pages based on permissions.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export interface PagePermissionEntry {
  pageKey: string
  actions: {
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
  }
}

/** All page keys that can be permission-controlled under /catha */
export const PERMISSION_PAGE_KEYS = [
  'dashboard',
  'pos',
  'orders',
  'tables',
  'qr-tables',
  'inventory',
  'suppliers',
  'stock-movement',
  'mpesa-transactions',
  'expenses',
  'clients',
  'users',
  'distributor-requests',
  'reports',
  'settings',
] as const

export type PermissionPageKey = (typeof PERMISSION_PAGE_KEYS)[number]

/** Human-readable labels for sidebar and permissions editor */
export const PERMISSION_PAGE_LABELS: Record<PermissionPageKey, string> = {
  dashboard: 'Dashboard',
  pos: 'POS Sales',
  orders: 'Orders',
  tables: 'Tables',
  'qr-tables': 'Table QR Codes',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  'stock-movement': 'Stock Movement',
  'mpesa-transactions': 'M-Pesa Transactions',
  expenses: 'Expenses',
  clients: 'Clients',
  users: 'User Management',
  'distributor-requests': 'Distributor Requests',
  reports: 'Reports',
  settings: 'Settings',
}

/** Route path for each page key (for sidebar links) */
export const PERMISSION_PAGE_ROUTES: Record<PermissionPageKey, string> = {
  dashboard: '/catha',
  pos: '/catha/pos',
  orders: '/catha/orders',
  tables: '/catha/tables',
  'qr-tables': '/catha/qr-tables',
  inventory: '/catha/inventory',
  suppliers: '/catha/suppliers',
  'stock-movement': '/catha/stock-movement',
  'mpesa-transactions': '/catha/mpesa-transactions',
  expenses: '/catha/expenses',
  clients: '/catha/clients',
  users: '/catha/users',
  'distributor-requests': '/catha/distributor-requests',
  reports: '/catha/reports',
  settings: '/catha/settings',
}

export function createEmptyPermissions(): PagePermissionEntry[] {
  return PERMISSION_PAGE_KEYS.map((pageKey) => ({
    pageKey,
    actions: { view: false, create: false, edit: false, delete: false },
  }))
}

/** Cashier: view + create/edit on POS, orders, limited others */
export function getCashierTemplate(): PagePermissionEntry[] {
  const entries = createEmptyPermissions()
  const cashierPages: PermissionPageKey[] = ['dashboard', 'pos', 'orders', 'tables', 'qr-tables']
  entries.forEach((e) => {
    if (cashierPages.includes(e.pageKey as PermissionPageKey)) {
      e.actions.view = true
      if (['pos', 'orders', 'tables'].includes(e.pageKey)) {
        e.actions.create = true
        e.actions.edit = true
      }
    }
  })
  return entries
}

/** Manager: view + create/edit on most, no delete on users/settings */
export function getManagerTemplate(): PagePermissionEntry[] {
  const entries = createEmptyPermissions()
  const noDelete = ['users', 'settings']
  entries.forEach((e) => {
    e.actions.view = true
    e.actions.create = true
    e.actions.edit = true
    e.actions.delete = !noDelete.includes(e.pageKey)
  })
  return entries
}

/** Super Admin: all view/create/edit/delete */
export function getSuperAdminTemplate(): PagePermissionEntry[] {
  return PERMISSION_PAGE_KEYS.map((pageKey) => ({
    pageKey,
    actions: { view: true, create: true, edit: true, delete: true },
  }))
}

/** @deprecated Use getSuperAdminTemplate instead */
export function getFullAccessAdminTemplate(): PagePermissionEntry[] {
  return PERMISSION_PAGE_KEYS.map((pageKey) => ({
    pageKey,
    actions: { view: true, create: true, edit: true, delete: true },
  }))
}

export function hasPagePermission(
  permissions: PagePermissionEntry[] | undefined,
  pageKey: string,
  action: PermissionAction
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  const entry = permissions.find((p) => p.pageKey === pageKey)
  return entry?.actions?.[action] === true
}
