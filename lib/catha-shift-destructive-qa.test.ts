import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireShiftSessionUser = vi.fn()
const mockGetActiveStaffShiftByUserId = vi.fn()
const mockGetLatestStaffShiftByUserId = vi.fn()
const mockTransitionActiveShift = vi.fn()
const mockCreateStaffShift = vi.fn()
const mockCreateShiftEvent = vi.fn()
const mockFindShiftEventByRequestId = vi.fn()
const mockGetShiftSettings = vi.fn()
const mockSendShiftNotification = vi.fn()
const mockAggregateShiftOrderStats = vi.fn()
const mockGetScheduleForNow = vi.fn()
const mockGetDeviceFingerprint = vi.fn()
const mockIsEarlyExit = vi.fn()
const mockIsOvertime = vi.fn()

vi.mock('@/lib/catha-shift-service', () => ({
  requireShiftSessionUser: mockRequireShiftSessionUser,
  aggregateShiftOrderStats: mockAggregateShiftOrderStats,
  deriveShiftStatusOnClose: ({ pendingClosure }: { pendingClosure: boolean }) =>
    pendingClosure ? 'FORGOT_CLOCK_OUT' : 'COMPLETED',
  getScheduleForNow: mockGetScheduleForNow,
  getDeviceFingerprint: mockGetDeviceFingerprint,
}))

vi.mock('@/lib/models/staff-shift', () => ({
  getActiveStaffShiftByUserId: mockGetActiveStaffShiftByUserId,
  getLatestStaffShiftByUserId: mockGetLatestStaffShiftByUserId,
  transitionActiveShift: mockTransitionActiveShift,
  createStaffShift: mockCreateStaffShift,
}))

vi.mock('@/lib/models/shift-event', () => ({
  createShiftEvent: mockCreateShiftEvent,
  findShiftEventByRequestId: mockFindShiftEventByRequestId,
}))

vi.mock('@/lib/models/shift-setting', () => ({
  getShiftSettings: mockGetShiftSettings,
}))

vi.mock('@/lib/catha-shift-sms', () => ({
  sendShiftNotification: mockSendShiftNotification,
}))

vi.mock('@/lib/catha-shift-time', async () => {
  const actual = await vi.importActual<typeof import('@/lib/catha-shift-time')>('@/lib/catha-shift-time')
  return {
    ...actual,
    isEarlyExit: mockIsEarlyExit,
    isOvertime: mockIsOvertime,
  }
})

describe('Catha shift destructive QA pack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireShiftSessionUser.mockResolvedValue({
      ok: true,
      userId: 'u1',
      name: 'John',
      role: 'CASHIER',
    })
    mockGetDeviceFingerprint.mockReturnValue('device-fp')
    mockGetShiftSettings.mockResolvedValue({ openingTime: '08:00', closingTime: '23:59' })
    mockGetScheduleForNow.mockReturnValue({
      now: new Date('2026-04-24T17:00:00.000Z'),
      scheduledStartAt: new Date('2026-04-24T05:00:00.000Z'),
      scheduledEndAt: new Date('2026-04-24T20:59:00.000Z'),
      businessDate: '2026-04-24',
      timezone: 'Africa/Nairobi',
      latenessBand: 'on_time',
    })
    mockCreateShiftEvent.mockResolvedValue({})
    mockSendShiftNotification.mockResolvedValue(undefined)
  })

  describe('Concurrency', () => {
    it('double clock-in spam returns existing active shift on duplicate key race', async () => {
      const { POST } = await import('@/app/api/catha/shifts/clock-in/route')
      const existingShift = { _id: { toString: () => 's1' }, status: 'ACTIVE' }
      mockGetActiveStaffShiftByUserId.mockResolvedValueOnce(null).mockResolvedValueOnce(existingShift)
      mockCreateStaffShift.mockRejectedValueOnce({ code: 11000 })

      const res = await POST(
        new Request('http://localhost/api/catha/shifts/clock-in', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ openingFloat: 1000 }),
        })
      )
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.shift.status).toBe('ACTIVE')
    })

    it('duplicate close replay returns prior closed shift using request id', async () => {
      const { POST } = await import('@/app/api/catha/shifts/close/route')
      mockFindShiftEventByRequestId.mockResolvedValue({ shiftId: 's-closed' })
      mockGetLatestStaffShiftByUserId.mockResolvedValue({
        _id: { toString: () => 's-closed' },
        endedAt: new Date('2026-04-24T18:00:00.000Z'),
      })

      const res = await POST(
        new Request('http://localhost/api/catha/shifts/close', {
          method: 'POST',
          headers: { 'x-idempotency-key': 'req-1' },
        })
      )
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.replay).toBe(true)
    })

    it('two tabs closing simultaneously settles on one close and one replay', async () => {
      const { POST } = await import('@/app/api/catha/shifts/close/route')
      const active = {
        _id: { toString: () => 's-active' },
        startedAt: new Date('2026-04-24T10:00:00.000Z'),
        scheduledEndAt: new Date('2026-04-24T20:00:00.000Z'),
        openingFloat: 1000,
        countedDrawerAmount: null,
        status: 'ACTIVE',
        notes: '',
      }
      mockGetActiveStaffShiftByUserId.mockResolvedValue(active)
      mockAggregateShiftOrderStats.mockResolvedValue({
        ordersServed: 10,
        cashSales: 1000,
        mpesaSales: 0,
        totalRevenue: 1000,
        refunds: 0,
        discounts: 0,
      })
      mockTransitionActiveShift
        .mockResolvedValueOnce({ ...active, endedAt: new Date('2026-04-24T18:00:00.000Z') })
        .mockResolvedValueOnce(null)
      mockGetLatestStaffShiftByUserId.mockResolvedValue({
        _id: { toString: () => 's-active' },
        endedAt: new Date('2026-04-24T18:00:00.000Z'),
      })

      const first = await POST(
        new Request('http://localhost/api/catha/shifts/close', {
          method: 'POST',
          headers: { 'x-idempotency-key': 'req-a', 'content-type': 'application/json' },
          body: JSON.stringify({ countedDrawerAmount: 2000 }),
        })
      )
      const second = await POST(
        new Request('http://localhost/api/catha/shifts/close', {
          method: 'POST',
          headers: { 'x-idempotency-key': 'req-b', 'content-type': 'application/json' },
          body: JSON.stringify({ countedDrawerAmount: 2000 }),
        })
      )

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect((await second.json()).replay).toBe(true)
    })
  })

  describe('Time and finance edge tests', () => {
    it('rejects negative drawer count to prevent finance corruption', async () => {
      const { POST } = await import('@/app/api/catha/shifts/close/route')
      mockGetActiveStaffShiftByUserId.mockResolvedValue({
        _id: { toString: () => 's1' },
        startedAt: new Date('2026-04-24T10:00:00.000Z'),
        scheduledEndAt: new Date('2026-04-24T20:00:00.000Z'),
        openingFloat: 1000,
        countedDrawerAmount: null,
        status: 'ACTIVE',
      })

      const res = await POST(
        new Request('http://localhost/api/catha/shifts/close', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ countedDrawerAmount: -1 }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('uses EAT business date around midnight boundary', async () => {
      const { getEatBusinessDate } = await import('@/lib/catha-shift-time')
      // 20:59 UTC is 23:59 EAT on same day.
      expect(getEatBusinessDate(new Date('2026-04-24T20:59:00.000Z'))).toBe('2026-04-24')
      // 21:01 UTC is 00:01 EAT next day.
      expect(getEatBusinessDate(new Date('2026-04-24T21:01:00.000Z'))).toBe('2026-04-25')
    })

  })
})
