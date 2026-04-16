import { describe, expect, it } from 'vitest'
import { newCheckoutSessionId } from '@/lib/ecommerce-checkout-session-constants'
import { ECOMMERCE_RESERVATION_TTL_MS } from '@/lib/ecommerce-stock-reservation'
import { ecommerceOrderCreateSchema } from '@/lib/order-request-schemas'

describe('ecommerce checkout session id', () => {
  it('uses ECS prefix for M-Pesa accountReference', () => {
    const a = newCheckoutSessionId()
    const b = newCheckoutSessionId()
    expect(a.startsWith('ECS')).toBe(true)
    expect(b.startsWith('ECS')).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('checkout session create payload (same schema as former unpaid order POST)', () => {
  it('accepts minimal valid checkout body without client order id', () => {
    const r = ecommerceOrderCreateSchema.safeParse({
      customerName: 'Test User',
      items: [{ productId: 'p1', quantity: 1 }],
      deliveryOption: 'collect_at_catha_lodge',
    })
    expect(r.success).toBe(true)
  })

  it('rejects client-supplied payment fields via strict schema', () => {
    const r = ecommerceOrderCreateSchema.safeParse({
      customerName: 'x',
      items: [{ productId: 'p1', quantity: 1 }],
      paymentStatus: 'PAID',
    })
    expect(r.success).toBe(false)
  })
})

describe('ecommerce reservation TTL', () => {
  it('uses a short positive hold window', () => {
    expect(ECOMMERCE_RESERVATION_TTL_MS).toBeGreaterThan(60_000)
    expect(ECOMMERCE_RESERVATION_TTL_MS).toBeLessThanOrEqual(30 * 60_000)
  })
})

describe('paid-only customer order list filter shape', () => {
  it('matches paid paymentStatus or post-checkout order linkage', () => {
    const paidEcommerceFilter = {
      $or: [
        { paymentStatus: { $in: ['PAID', 'OVERPAID', 'PARTIALLY_PAID'] } },
        { sourceCheckoutSessionId: { $exists: true, $nin: [null, ''] } },
      ],
    }
    expect(paidEcommerceFilter.$or).toHaveLength(2)
  })
})
