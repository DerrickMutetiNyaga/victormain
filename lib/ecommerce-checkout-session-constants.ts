export const ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION = 'ecommerce_checkout_sessions'

/** Prefix for M-Pesa accountReference (distinct from paid order ids `ECO…`). */
export function newCheckoutSessionId(): string {
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `ECS${Date.now().toString().slice(-8)}${rand}`
}

export type EcommerceCheckoutSessionStatus =
  | 'pending_payment'
  | 'converted'
  | 'failed'
  | 'abandoned'
  | 'expired'
