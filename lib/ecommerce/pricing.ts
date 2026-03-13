/**
 * E-commerce pricing utilities - VAT 16% (Kenya)
 */

export const VAT_RATE = 0.16

export interface CartItemForPricing {
  price: number
  quantity: number
}

export interface CartTotals {
  subtotal: number
  vat: number
  total: number
}

/**
 * Calculate cart totals with VAT 16%.
 * subtotal = sum(unitPrice * qty)
 * vat = subtotal * 0.16
 * total = subtotal + vat
 */
export function calculateCartTotals(items: CartItemForPricing[]): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100
  const total = subtotal + vat
  return { subtotal, vat, total }
}

