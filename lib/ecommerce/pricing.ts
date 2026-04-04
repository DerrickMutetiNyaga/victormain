/**
 * E-commerce pricing utilities
 *
 * NOTE: Product prices in this app are treated as **tax-inclusive**.
 * Do not add VAT on top of line totals.
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
 * Calculate cart totals.
 * subtotal = sum(unitPrice * qty)
 * vat = 0 (prices already include VAT)
 * total = subtotal
 */
export function calculateCartTotals(items: CartItemForPricing[]): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const vat = 0
  const total = subtotal
  return { subtotal, vat, total }
}

