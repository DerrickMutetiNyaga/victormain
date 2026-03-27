/**
 * Catha-only permissions model (single source of truth).
 *
 * - Stored on `catha_users.permissions`
 * - Exposed on `session.user.permissions`
 * - Used by Catha helpers, API guards, nav, and UI.
 */

export type PermissionActions = {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export type CathaPermissions = {
  dashboard?: PermissionActions
  users?: PermissionActions
  pos?: PermissionActions
  orders?: PermissionActions
  inventory?: PermissionActions
  suppliers?: PermissionActions
  stockMovement?: PermissionActions
  mpesa?: PermissionActions
  expenses?: PermissionActions
  clients?: PermissionActions
  tables?: PermissionActions
  tableQrCodes?: PermissionActions
  distributorRequests?: PermissionActions
  reports?: PermissionActions
  settings?: PermissionActions
}

export type CathaModuleKey = keyof CathaPermissions
export type CathaPermissionAction = keyof PermissionActions

const MODULE_KEYS: CathaModuleKey[] = [
  'dashboard',
  'users',
  'pos',
  'orders',
  'inventory',
  'suppliers',
  'stockMovement',
  'mpesa',
  'expenses',
  'clients',
  'tables',
  'tableQrCodes',
  'distributorRequests',
  'reports',
  'settings',
]

const EMPTY_ACTIONS: PermissionActions = {
  view: false,
  add: false,
  edit: false,
  delete: false,
}

/**
 * Normalize a single PermissionActions object, enforcing invariants:
 *
 * - `view` is required before add/edit/delete.
 * - If `view` is false, add/edit/delete are forced to false.
 * - If add/edit/delete is true and view is false, view is auto-enabled.
 */
export function normalizePermissionActions(input: Partial<PermissionActions> | null | undefined): PermissionActions {
  const src = input ?? {}
  let view = src.view === true
  const add = src.add === true
  const edit = src.edit === true
  const del = src.delete === true

  if (!view && (add || edit || del)) {
    view = true
  }

  if (!view) {
    return { view: false, add: false, edit: false, delete: false }
  }

  return {
    view,
    add,
    edit,
    delete: del,
  }
}

/**
 * Normalize an arbitrary value into a well-formed CathaPermissions object.
 * Extra keys are ignored; unknown shapes are treated as empty.
 */
export function normalizePermissions(raw: unknown): CathaPermissions {
  const result: CathaPermissions = {}
  if (!raw || typeof raw !== 'object') return result

  const obj = raw as Record<string, any>
  for (const key of MODULE_KEYS) {
    const rawActions = obj[key]
    if (rawActions && typeof rawActions === 'object') {
      const normalized = normalizePermissionActions(rawActions as Partial<PermissionActions>)
      if (normalized.view || normalized.add || normalized.edit || normalized.delete) {
        ;(result as any)[key] = normalized
      }
    }
  }
  return result
}

// ─── Role templates ───

export type CathaRoleTemplateKey = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'PENDING'

const ALL_TRUE: PermissionActions = { view: true, add: true, edit: true, delete: true }

export const ROLE_TEMPLATES: Record<CathaRoleTemplateKey, CathaPermissions> = {
  SUPER_ADMIN: MODULE_KEYS.reduce<CathaPermissions>((acc, key) => {
    ;(acc as any)[key] = { ...ALL_TRUE }
    return acc
  }, {}),

  ADMIN: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    users: { view: true, add: true, edit: true, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: true, edit: true, delete: false },
    inventory: { view: true, add: true, edit: true, delete: false },
    suppliers: { view: true, add: true, edit: true, delete: false },
    stockMovement: { view: true, add: true, edit: true, delete: false },
    mpesa: { view: true, add: false, edit: false, delete: false },
    expenses: { view: true, add: true, edit: true, delete: false },
    clients: { view: true, add: true, edit: true, delete: false },
    tables: { view: true, add: true, edit: true, delete: false },
    tableQrCodes: { view: true, add: true, edit: true, delete: false },
    distributorRequests: { view: true, add: true, edit: true, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    settings: { view: true, add: true, edit: true, delete: false },
  },

  CASHIER: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: false, delete: false },
    orders: { view: true, add: true, edit: true, delete: false },
    tables: { view: true, add: true, edit: true, delete: false },
    clients: { view: true, add: true, edit: true, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
  },

  PENDING: {},
}

export function getDefaultPermissionsForRole(role: string | null | undefined): CathaPermissions {
  const key = (role ?? '').toUpperCase() as CathaRoleTemplateKey
  if (key in ROLE_TEMPLATES) {
    return normalizePermissions(ROLE_TEMPLATES[key])
  }
  return {}
}

export function hasCathaPermission(
  permissions: CathaPermissions | null | undefined,
  module: CathaModuleKey,
  action: CathaPermissionAction
): boolean {
  if (!permissions) return false
  const entry = permissions[module] ?? EMPTY_ACTIONS
  const normalized = normalizePermissionActions(entry)
  if (!normalized.view) return false
  if (action === 'view') return normalized.view
  if (action === 'add') return normalized.add
  if (action === 'edit') return normalized.edit
  if (action === 'delete') return normalized.delete
  return false
}

