/**
 * Catha V2 permission constants - single source for requireCathaPermission() and sidebar.
 * Use string identifiers; SUPER_ADMIN bypasses all.
 */
export const PERM_USERS_MANAGE = 'users:manage'
export const PERM_DASHBOARD = 'dashboard:view'
export const PERM_ORDERS_VIEW = 'orders:view'
export const PERM_ORDERS_MANAGE = 'orders:manage'
export const PERM_POS = 'pos:use'
export const PERM_INVENTORY_VIEW = 'inventory:view'
export const PERM_INVENTORY_MANAGE = 'inventory:manage'
export const PERM_SUPPLIERS_VIEW = 'suppliers:view'
export const PERM_SUPPLIERS_MANAGE = 'suppliers:manage'
export const PERM_STOCK_MOVEMENT = 'stock:movement'
export const PERM_MPESA_VIEW = 'mpesa:view'
export const PERM_EXPENSES_VIEW = 'expenses:view'
export const PERM_EXPENSES_MANAGE = 'expenses:manage'
export const PERM_CLIENTS_VIEW = 'clients:view'
export const PERM_CLIENTS_MANAGE = 'clients:manage'
export const PERM_TABLES_VIEW = 'tables:view'
export const PERM_TABLES_MANAGE = 'tables:manage'
export const PERM_QR_TABLES = 'qr-tables:manage'
export const PERM_DISTRIBUTOR_REQUESTS = 'distributor-requests:manage'
export const PERM_REPORTS = 'reports:view'
export const PERM_SETTINGS = 'settings:manage'

/** Route path -> required permission (for sidebar and guards). CASHIER gets POS-only. */
export const ROUTE_PERMISSION_MAP: Record<string, string | null> = {
  '/catha': PERM_DASHBOARD,
  '/catha/pos': PERM_POS,
  '/catha/orders': PERM_ORDERS_VIEW,
  '/catha/tables': PERM_TABLES_VIEW,
  '/catha/qr-tables': PERM_QR_TABLES,
  '/catha/inventory': PERM_INVENTORY_VIEW,
  '/catha/suppliers': PERM_SUPPLIERS_VIEW,
  '/catha/stock-movement': PERM_STOCK_MOVEMENT,
  '/catha/mpesa-transactions': PERM_MPESA_VIEW,
  '/catha/expenses': PERM_EXPENSES_VIEW,
  '/catha/clients': PERM_CLIENTS_VIEW,
  '/catha/users': PERM_USERS_MANAGE,
  '/catha/distributor-requests': PERM_DISTRIBUTOR_REQUESTS,
  '/catha/reports': PERM_REPORTS,
  '/catha/settings': PERM_SETTINGS,
}

/** Stable first-page order used by /catha/entry post-login redirect. */
export const CATHA_ROUTE_ORDER: string[] = [
  '/catha/pos',
  '/catha/orders',
  '/catha/tables',
  '/catha/inventory',
  '/catha/reports',
  '/catha/settings',
  '/catha',
]

/** Permission key -> label for UI */
export const PERMISSION_LABELS: Record<string, string> = {
  [PERM_USERS_MANAGE]: 'User Management',
  [PERM_DASHBOARD]: 'Dashboard',
  [PERM_ORDERS_VIEW]: 'Orders (view)',
  [PERM_ORDERS_MANAGE]: 'Orders (manage)',
  [PERM_POS]: 'POS Sales',
  [PERM_INVENTORY_VIEW]: 'Inventory (view)',
  [PERM_INVENTORY_MANAGE]: 'Inventory (manage)',
  [PERM_SUPPLIERS_VIEW]: 'Suppliers (view)',
  [PERM_SUPPLIERS_MANAGE]: 'Suppliers (manage)',
  [PERM_STOCK_MOVEMENT]: 'Stock Movement',
  [PERM_MPESA_VIEW]: 'M-Pesa Transactions',
  [PERM_EXPENSES_VIEW]: 'Expenses (view)',
  [PERM_EXPENSES_MANAGE]: 'Expenses (manage)',
  [PERM_CLIENTS_VIEW]: 'Clients (view)',
  [PERM_CLIENTS_MANAGE]: 'Clients (manage)',
  [PERM_TABLES_VIEW]: 'Tables (view)',
  [PERM_TABLES_MANAGE]: 'Tables (manage)',
  [PERM_QR_TABLES]: 'Table QR Codes',
  [PERM_DISTRIBUTOR_REQUESTS]: 'Distributor Requests',
  [PERM_REPORTS]: 'Reports',
  [PERM_SETTINGS]: 'Settings',
}

// Dev-only: ensure every nav route is in ROUTE_PERMISSION_MAP (single source of truth)
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    const { CATHA_NAV_ITEMS, CATHA_NAV_SECTIONS } = require('./catha-navigation')
    const navHrefs = new Set<string>()
    CATHA_NAV_ITEMS.forEach((item) => navHrefs.add(item.href))
    CATHA_NAV_SECTIONS.forEach((s) => s.items.forEach((item) => navHrefs.add(item.href)))
    const missing = [...navHrefs].filter((href) => !(href in ROUTE_PERMISSION_MAP))
    if (missing.length > 0) {
      console.warn('[catha-permissions] Nav routes not in ROUTE_PERMISSION_MAP (route may be unprotected):', missing)
    }
  } catch {
    // ignore if nav not loadable (e.g. build)
  }
}

/** All permission keys for multi-select in user management */
export const ALL_PERMISSION_KEYS = [
  PERM_USERS_MANAGE,
  PERM_DASHBOARD,
  PERM_ORDERS_VIEW,
  PERM_ORDERS_MANAGE,
  PERM_POS,
  PERM_INVENTORY_VIEW,
  PERM_INVENTORY_MANAGE,
  PERM_SUPPLIERS_VIEW,
  PERM_SUPPLIERS_MANAGE,
  PERM_STOCK_MOVEMENT,
  PERM_MPESA_VIEW,
  PERM_EXPENSES_VIEW,
  PERM_EXPENSES_MANAGE,
  PERM_CLIENTS_VIEW,
  PERM_CLIENTS_MANAGE,
  PERM_TABLES_VIEW,
  PERM_TABLES_MANAGE,
  PERM_QR_TABLES,
  PERM_DISTRIBUTOR_REQUESTS,
  PERM_REPORTS,
  PERM_SETTINGS,
] as const
