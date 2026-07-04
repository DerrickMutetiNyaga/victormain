import { describe, expect, it } from 'vitest'
import {
  computeNextOpeningInstant,
  evaluateEcommerceOpeningHours,
  getNairobiWallParts,
  nairobiLocalToUtcDate,
  parseHHmmToMinutes,
  validateEcommerceOpeningHoursPayload,
} from './ecommerce-opening-hours'

describe('parseHHmmToMinutes', () => {
  it('parses 24h times', () => {
    expect(parseHHmmToMinutes('08:00')).toBe(8 * 60)
    expect(parseHHmmToMinutes('9:30')).toBe(9 * 60 + 30)
    expect(parseHHmmToMinutes('invalid')).toBeNull()
  })
})

describe('nairobiLocalToUtcDate', () => {
  it('maps Nairobi wall time to UTC (EAT = UTC+3)', () => {
    const d = nairobiLocalToUtcDate('2026-04-13', '09:00')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-04-13T06:00:00.000Z')
  })
})

describe('evaluateEcommerceOpeningHours', () => {
  const cfg = {
    enabled: true,
    openingTime: '09:00',
    closingTime: '18:00',
    openDays: [1, 2, 3, 4, 5],
    customNotice: '',
    blockCheckoutWhenClosed: false,
  }

  /** Monday 13 Apr 2026, 10:30 Nairobi (EAT) */
  const monOpen = new Date(Date.UTC(2026, 3, 13, 7, 30, 0))

  it('reports open during weekday window', () => {
    const ev = evaluateEcommerceOpeningHours(cfg, monOpen)
    expect(ev.isOpen).toBe(true)
    expect(ev.isClosed).toBe(false)
    expect(ev.message).toBe('')
  })

  /** Monday 13 Apr 2026, 08:00 Nairobi — before opening */
  const monBefore = new Date(Date.UTC(2026, 3, 13, 5, 0, 0))

  it('reports closed before opening with next opening same calendar day', () => {
    const ev = evaluateEcommerceOpeningHours(cfg, monBefore)
    expect(ev.isClosed).toBe(true)
    expect(ev.nextOpeningAt).toBe('2026-04-13T06:00:00.000Z')
    expect(ev.message).toContain('today')
    expect(ev.message).toMatch(/reopen/i)
  })

  /** Monday 13 Apr 2026, 18:00 Nairobi — closed at closing boundary */
  const monAtClose = new Date(Date.UTC(2026, 3, 13, 15, 0, 0))

  it('is closed at exact closing time', () => {
    const ev = evaluateEcommerceOpeningHours(cfg, monAtClose)
    expect(ev.isClosed).toBe(true)
  })

  /** Monday 13 Apr 2026, 09:00 Nairobi — open at opening boundary */
  const monAtOpen = new Date(Date.UTC(2026, 3, 13, 6, 0, 0))

  it('is open at exact opening time', () => {
    const ev = evaluateEcommerceOpeningHours(cfg, monAtOpen)
    expect(ev.isOpen).toBe(true)
  })

  /** Saturday 18 Apr 2026, 12:00 Nairobi — weekend closed */
  const sat = new Date(Date.UTC(2026, 3, 18, 9, 0, 0))

  it('skips closed days to next Monday', () => {
    const ev = evaluateEcommerceOpeningHours(cfg, sat)
    expect(ev.isClosed).toBe(true)
    expect(ev.nextOpeningAt).toBe('2026-04-20T06:00:00.000Z')
    expect(ev.message.toLowerCase()).toContain('monday')
  })

  it('uses custom notice when closed', () => {
    const ev = evaluateEcommerceOpeningHours(
      { ...cfg, customNotice: 'Custom closed text.' },
      sat
    )
    expect(ev.message).toBe('Custom closed text.')
  })

  it('fails open when disabled', () => {
    const ev = evaluateEcommerceOpeningHours({ ...cfg, enabled: false }, sat)
    expect(ev.isOpen).toBe(true)
    expect(ev.message).toBe('')
  })

  it('fails open when config invalid (overnight)', () => {
    const ev = evaluateEcommerceOpeningHours(
      { ...cfg, openingTime: '18:00', closingTime: '09:00' },
      monOpen
    )
    expect(ev.isOpen).toBe(true)
  })
})

describe('validateEcommerceOpeningHoursPayload', () => {
  it('rejects overnight hours', () => {
    const r = validateEcommerceOpeningHoursPayload({
      enabled: true,
      openingTime: '22:00',
      closingTime: '06:00',
      openDays: [1],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.toLowerCase()).toContain('overnight')
  })

  it('requires at least one open day when enabled', () => {
    const r = validateEcommerceOpeningHoursPayload({
      enabled: true,
      openingTime: '09:00',
      closingTime: '18:00',
      openDays: [],
    })
    expect(r.ok).toBe(false)
  })
})

describe('computeNextOpeningInstant', () => {
  it('returns null when currently open', () => {
    const cfg = {
      enabled: true,
      openingTime: '09:00',
      closingTime: '18:00',
      openDays: [1, 2, 3, 4, 5],
      customNotice: '',
      blockCheckoutWhenClosed: false,
    }
    const monOpen = new Date(Date.UTC(2026, 3, 13, 7, 30, 0))
    expect(computeNextOpeningInstant(cfg, monOpen)).toBeNull()
  })
})

describe('getNairobiWallParts', () => {
  it('reads Nairobi calendar from a UTC instant', () => {
    const monOpen = new Date(Date.UTC(2026, 3, 13, 7, 30, 0))
    const p = getNairobiWallParts(monOpen)
    expect(p.ymd).toBe('2026-04-13')
    expect(p.dow).toBe(1)
    expect(p.minutesSinceMidnight).toBe(10 * 60 + 30)
  })
})
