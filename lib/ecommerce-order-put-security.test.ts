import { describe, expect, it } from 'vitest'
import { assertPaidForStaffEcommerceCompletion } from '@/lib/ecommerce-staff-order-completion'
import {
  hasCathaPermission,
  normalizePermissions,
  ROLE_TEMPLATES,
} from '@/lib/catha-permissions-model'
import { ecommerceStaffOrderPutSchema } from '@/lib/order-request-schemas'
import { resolveEcommerceOrdersPutDenialWhenNotStaff } from '@/lib/ecommerce-orders-put-gate'

describe('ecommerceStaffOrderPutSchema', () => {
  it('accepts id + cancelled', () => {
    const r = ecommerceStaffOrderPutSchema.safeParse({ id: 'ECO62260727', status: 'cancelled' })
    expect(r.success).toBe(true)
  })

  it('accepts id + completed', () => {
    const r = ecommerceStaffOrderPutSchema.safeParse({ id: 'ECO62260727', status: 'completed' })
    expect(r.success).toBe(true)
  })

  it('rejects arbitrary status strings (customer cannot pick shipped etc.)', () => {
    const r = ecommerceStaffOrderPutSchema.safeParse({ id: 'ECO1', status: 'shipped' })
    expect(r.success).toBe(false)
  })

  it('rejects pending and other lifecycle values not in the staff enum', () => {
    expect(ecommerceStaffOrderPutSchema.safeParse({ id: 'ECO1', status: 'pending' }).success).toBe(false)
  })

  it('rejects sensitive extra fields (strict allowlist)', () => {
    const r = ecommerceStaffOrderPutSchema.safeParse({
      id: 'ECO1',
      status: 'cancelled',
      paymentStatus: 'PAID',
      total: 0,
      internalNotes: 'x',
    })
    expect(r.success).toBe(false)
  })
})

describe('assertPaidForStaffEcommerceCompletion', () => {
  it('blocks completing unpaid ecommerce orders (payment from DB only)', () => {
    const r = assertPaidForStaffEcommerceCompletion({ paymentStatus: 'PENDING' })
    expect(r.ok).toBe(false)
  })

  it('allows paid states', () => {
    expect(assertPaidForStaffEcommerceCompletion({ paymentStatus: 'PAID' }).ok).toBe(true)
    expect(assertPaidForStaffEcommerceCompletion({ paymentStatus: 'OVERPAID' }).ok).toBe(true)
    expect(assertPaidForStaffEcommerceCompletion({ paymentStatus: 'PARTIALLY_PAID' }).ok).toBe(true)
  })
})

describe('resolveEcommerceOrdersPutDenialWhenNotStaff', () => {
  it('prefers Catha denial when JWT has email even if shop_session exists (no misleading shop error)', () => {
    expect(
      resolveEcommerceOrdersPutDenialWhenNotStaff({ hasCathaUserEmail: true, hasShopPhone: true })
    ).toBe('catha_denied')
  })

  it('shop-only customer → shop_denied', () => {
    expect(
      resolveEcommerceOrdersPutDenialWhenNotStaff({ hasCathaUserEmail: false, hasShopPhone: true })
    ).toBe('shop_denied')
  })

  it('no Catha and no shop → anonymous (401)', () => {
    expect(
      resolveEcommerceOrdersPutDenialWhenNotStaff({ hasCathaUserEmail: false, hasShopPhone: false })
    ).toBe('anonymous')
  })

  it('Catha email without shop → catha_denied', () => {
    expect(
      resolveEcommerceOrdersPutDenialWhenNotStaff({ hasCathaUserEmail: true, hasShopPhone: false })
    ).toBe('catha_denied')
  })
})

describe('Catha orders.edit gate (same rule as PUT /api/ecommerce/orders)', () => {
  it('ADMIN role template includes orders edit', () => {
    const p = normalizePermissions(ROLE_TEMPLATES.ADMIN)
    expect(hasCathaPermission(p, 'orders', 'edit')).toBe(true)
  })

  it('empty permissions cannot edit orders', () => {
    const p = normalizePermissions({})
    expect(hasCathaPermission(p, 'orders', 'edit')).toBe(false)
  })
})
