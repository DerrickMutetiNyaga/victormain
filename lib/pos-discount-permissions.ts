import { normalizePermissions, hasCathaPermission, type CathaPermissions } from '@/lib/catha-permissions-model'

/** Dedicated POS discount management permission (posDiscounts.edit = "manage") */
export function canManagePosDiscounts(
  role: string,
  perms: CathaPermissions | ReturnType<typeof normalizePermissions>
): boolean {
  const r = role.toUpperCase()
  if (r === 'SUPER_ADMIN') return true
  const normalized = normalizePermissions(perms)
  return hasCathaPermission(normalized, 'posDiscounts', 'edit')
}

export function canViewPosDiscountsAdmin(
  role: string,
  perms: CathaPermissions | ReturnType<typeof normalizePermissions>
): boolean {
  const r = role.toUpperCase()
  if (r === 'SUPER_ADMIN') return true
  const normalized = normalizePermissions(perms)
  return (
    hasCathaPermission(normalized, 'posDiscounts', 'view') ||
    hasCathaPermission(normalized, 'posDiscounts', 'edit')
  )
}

/** Cashiers + POS staff — read active discounts for selling */
export function canViewPosDiscountsForPos(
  role: string,
  perms: CathaPermissions | ReturnType<typeof normalizePermissions>
): boolean {
  const r = role.toUpperCase()
  if (r === 'SUPER_ADMIN') return true
  const normalized = normalizePermissions(perms)
  return (
    canViewPosDiscountsAdmin(r, normalized) ||
    hasCathaPermission(normalized, 'pos', 'view')
  )
}
