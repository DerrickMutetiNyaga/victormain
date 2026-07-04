import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireShiftSessionUser = vi.fn()
const mockGetActiveStaffShiftByUserId = vi.fn()
const mockGetLatestStaffShiftByUserId = vi.fn()
const mockGetShiftById = vi.fn()
const mockTransitionActiveShift = vi.fn()
const mockCreateShiftEvent = vi.fn()
const mockSendShiftNotification = vi.fn()

vi.mock('@/lib/catha-shift-service', () => ({
  requireShiftSessionUser: mockRequireShiftSessionUser,
}))

vi.mock('@/lib/models/staff-shift', () => ({
  getActiveStaffShiftByUserId: mockGetActiveStaffShiftByUserId,
  getLatestStaffShiftByUserId: mockGetLatestStaffShiftByUserId,
  getShiftById: mockGetShiftById,
  transitionActiveShift: mockTransitionActiveShift,
}))

vi.mock('@/lib/models/shift-event', () => ({
  createShiftEvent: mockCreateShiftEvent,
}))

vi.mock('@/lib/catha-shift-sms', () => ({
  sendShiftNotification: mockSendShiftNotification,
}))

describe('continue shift route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireShiftSessionUser.mockResolvedValue({
      ok: true,
      userId: 'u1',
      name: 'Cashier',
    })
  })

  it('prevents continuing another user shift', async () => {
    const { POST } = await import('@/app/api/catha/shifts/continue/route')
    mockGetActiveStaffShiftByUserId.mockResolvedValue(null)
    mockGetShiftById.mockResolvedValue({
      _id: { toString: () => 's1' },
      staffUserId: 'u2',
      status: 'AUTO_CLOSED',
      metadata: { autoClosedBySystem: true },
    })

    const res = await POST(
      new Request('http://localhost/api/catha/shifts/continue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shiftId: '6654d1475d7968d17d6b6cb9' }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('duplicate continue request replays active shift', async () => {
    const { POST } = await import('@/app/api/catha/shifts/continue/route')
    mockGetActiveStaffShiftByUserId.mockResolvedValue({
      _id: { toString: () => 's1' },
      staffUserId: 'u1',
      status: 'ACTIVE',
    })

    const res = await POST(
      new Request('http://localhost/api/catha/shifts/continue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shiftId: '6654d1475d7968d17d6b6cb9' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.replay).toBe(true)
  })
})
