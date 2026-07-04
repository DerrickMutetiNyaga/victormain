/**
 * PUT /api/ecommerce/orders is staff-only. When the caller is not allowed as staff,
 * we must classify denials in this order:
 * 1) Any Catha-authenticated user (JWT email) → return Catha gate response (403 insufficient, 401, etc.),
 *    never the "shop session" message — staff may also have a shop_session cookie.
 * 2) Shop session only → 403 customer mutation forbidden.
 * 3) Otherwise → 401 unauthenticated.
 */
export type EcommerceOrdersPutDenialKind = 'catha_denied' | 'shop_denied' | 'anonymous'

export function resolveEcommerceOrdersPutDenialWhenNotStaff(params: {
  hasCathaUserEmail: boolean
  hasShopPhone: boolean
}): EcommerceOrdersPutDenialKind {
  if (params.hasCathaUserEmail) return 'catha_denied'
  if (params.hasShopPhone) return 'shop_denied'
  return 'anonymous'
}
