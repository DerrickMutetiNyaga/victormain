import { describe, expect, it } from 'vitest'
import { isOverdueForAutoClose, overdueThresholdMs } from '@/lib/catha-shift-auto-close-utils'

describe('catha shift auto-close timing', () => {
  it('is not overdue exactly at 2h threshold', () => {
    const scheduledEndAt = new Date('2026-04-26T18:00:00.000Z')
    const atThreshold = overdueThresholdMs(scheduledEndAt, 2)
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, atThreshold)).toBe(false)
  })

  it('is overdue at 2h + 1 second', () => {
    const scheduledEndAt = new Date('2026-04-26T18:00:00.000Z')
    const afterThreshold = overdueThresholdMs(scheduledEndAt, 2) + 1000
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, afterThreshold)).toBe(true)
  })

  it('is overdue by 8 hours', () => {
    const scheduledEndAt = new Date('2026-04-26T12:00:00.000Z')
    const now = overdueThresholdMs(scheduledEndAt, 2) + 6 * 60 * 60 * 1000
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, now)).toBe(true)
  })

  it('is overdue by 2 days', () => {
    const scheduledEndAt = new Date('2026-04-24T12:00:00.000Z')
    const now = overdueThresholdMs(scheduledEndAt, 2) + 48 * 60 * 60 * 1000
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, now)).toBe(true)
  })

  it('handles overnight shifts crossing midnight', () => {
    const scheduledEndAt = new Date('2026-04-26T21:00:00.000Z') // 00:00 EAT next day
    const now = new Date('2026-04-26T23:01:00.000Z').getTime()
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, now)).toBe(true)
  })

  it('returns false when scheduled end is missing', () => {
    expect(isOverdueForAutoClose({ scheduledEndAt: undefined as any }, 2, Date.now())).toBe(false)
  })

  it('timezone-safe for DST edge (UTC math)', () => {
    const scheduledEndAt = new Date('2026-10-25T00:30:00.000Z')
    const now = overdueThresholdMs(scheduledEndAt, 2) + 1
    expect(isOverdueForAutoClose({ scheduledEndAt }, 2, now)).toBe(true)
  })
})
