import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetShiftSettings = vi.fn()
const mockListOverdueOpenStaffShifts = vi.fn()
const mockGetActiveStaffShiftByUserId = vi.fn()
const mockGetLatestStaffShiftByUserId = vi.fn()
const mockAggregateShiftOrderStats = vi.fn()
const mockCloseShiftAndNotify = vi.fn()
const mockQueueAuditLog = vi.fn()

vi.mock('@/lib/models/shift-setting', () => ({
  getShiftSettings: mockGetShiftSettings,
}))

vi.mock('@/lib/models/staff-shift', () => ({
  listOverdueOpenStaffShifts: mockListOverdueOpenStaffShifts,
  getActiveStaffShiftByUserId: mockGetActiveStaffShiftByUserId,
  getLatestStaffShiftByUserId: mockGetLatestStaffShiftByUserId,
}))

vi.mock('@/lib/catha-shift-service', () => ({
  aggregateShiftOrderStats: mockAggregateShiftOrderStats,
}))

vi.mock('@/lib/catha-shift-lifecycle', () => ({
  closeShiftAndNotify: mockCloseShiftAndNotify,
}))

vi.mock('@/lib/catha-audit-log', () => ({
  queueCathaAuditLog: mockQueueAuditLog,
}))

function makeShift(id: string) {
  return {
    _id: { toString: () => id },
    staffUserId: `u-${id}`,
    staffName: `User ${id}`,
    role: 'CASHIER',
    status: 'ACTIVE',
    startedAt: new Date('2026-04-26T08:00:00.000Z'),
    scheduledEndAt: new Date('2026-04-26T16:00:00.000Z'),
    openingFloat: 1000,
    countedDrawerAmount: null,
    metadata: {},
  }
}

describe('auto close backlog sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShiftSettings.mockResolvedValue({
      autoCloseGraceHours: 2,
      continuePromptWindowHours: 24,
    })
    mockAggregateShiftOrderStats.mockResolvedValue({
      cashSales: 500,
      mpesaSales: 500,
      totalRevenue: 1000,
      ordersServed: 10,
      refunds: 0,
      discounts: 0,
    })
    mockCloseShiftAndNotify.mockImplementation(async ({ shift, updates }: any) => ({
      replay: false,
      shift: {
        ...shift,
        ...updates,
      },
    }))
  })

  it('processes 100 overdue shifts in batches', async () => {
    const shifts = Array.from({ length: 100 }, (_, i) => makeShift(String(i + 1)))
    mockListOverdueOpenStaffShifts.mockResolvedValueOnce(shifts).mockResolvedValueOnce([])
    const { autoCloseOverdueShifts } = await import('@/lib/catha-shift-auto-close')
    const result = await autoCloseOverdueShifts({ limit: 100, batchSize: 25 })
    expect(result.autoClosed).toHaveLength(100)
    expect(mockCloseShiftAndNotify).toHaveBeenCalledTimes(100)
  })

  it('rerun is idempotent when no overdue records remain', async () => {
    mockListOverdueOpenStaffShifts.mockResolvedValue([])
    const { autoCloseOverdueShifts } = await import('@/lib/catha-shift-auto-close')
    const first = await autoCloseOverdueShifts({ limit: 100, batchSize: 25 })
    const second = await autoCloseOverdueShifts({ limit: 100, batchSize: 25 })
    expect(first.autoClosed).toHaveLength(0)
    expect(second.autoClosed).toHaveLength(0)
    expect(mockCloseShiftAndNotify).toHaveBeenCalledTimes(0)
  })

  it('continues processing when one record fails', async () => {
    const batch = [makeShift('1'), makeShift('2'), makeShift('3')]
    mockListOverdueOpenStaffShifts.mockResolvedValueOnce(batch).mockResolvedValueOnce([])
    mockCloseShiftAndNotify.mockImplementation(async ({ shift, updates }: any) => {
      const id = shift?._id?.toString?.() ?? ''
      if (id === '2') throw new Error('boom')
      return {
        replay: false,
        shift: { ...shift, ...updates },
      }
    })
    const { autoCloseOverdueShifts } = await import('@/lib/catha-shift-auto-close')
    const result = await autoCloseOverdueShifts({ limit: 10, batchSize: 10 })
    expect(result.autoClosed).toHaveLength(2)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]?.shiftId).toBe('2')
  })
})
