import { describe, expect, it } from 'vitest'
import { calculateShiftOrderStatsFromRows } from '@/lib/catha-shift-order-stats'

describe('aggregateShiftOrderStats finance edge coverage', () => {
  it('aggregates split payments and excludes cancelled orders', async () => {
    const stats = calculateShiftOrderStatsFromRows([
      {
        total: 1000,
        cashier: 'John',
        paymentLines: [
          { method: 'cash', amount: 300 },
          { method: 'mpesa', amount: 700 },
        ],
        status: 'completed',
        refundTotal: 50,
        discountPercent: 10,
      },
      {
        total: 500,
        cashier: 'John',
        paymentMethod: 'cash',
        status: 'cancelled',
      },
    ])
    expect(stats.ordersServed).toBe(1)
    expect(stats.cashSales).toBe(300)
    expect(stats.mpesaSales).toBe(700)
    expect(stats.refunds).toBe(50)
    expect(stats.discounts).toBe(100)
  })
})
