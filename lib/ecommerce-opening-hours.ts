/**
 * E-commerce operating hours — all wall-clock logic uses IANA zone Africa/Nairobi (EAT).
 * Never use the host's local timezone or naive UTC for business open/closed.
 */

export const ECOMMERCE_OPENING_HOURS_TZ = 'Africa/Nairobi' as const

export type EcommerceOpeningHoursSettings = {
  enabled: boolean
  /** HH:mm 24h, Nairobi */
  openingTime: string
  /** HH:mm 24h, Nairobi */
  closingTime: string
  /** 0 = Sunday … 6 = Saturday (same convention as JS after mapping from Nairobi weekday) */
  openDays: number[]
  customNotice?: string
  /** When true, checkout API rejects orders while closed */
  blockCheckoutWhenClosed?: boolean
}

export const defaultEcommerceOpeningHours: EcommerceOpeningHoursSettings = {
  enabled: false,
  openingTime: '09:00',
  closingTime: '18:00',
  openDays: [1, 2, 3, 4, 5],
  customNotice: '',
  blockCheckoutWhenClosed: false,
}

const WEEKDAY_SHORT_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Kenya uses UTC+3 year-round (no DST). Used only to construct absolute instants from Nairobi calendar + clock. */
const NAIROBI_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

export type EcommerceOpeningHoursEval = {
  isOpen: boolean
  isClosed: boolean
  /** ISO 8601 UTC instant of next opening, or null if unknown / currently open */
  nextOpeningAt: string | null
  /** Customer-facing notice when closed and feature enabled; empty otherwise */
  message: string
}

function partsToMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') m[p.type] = p.value
  }
  return m
}

/** Nairobi calendar YYYY-MM-DD and clock for a given instant */
export function getNairobiWallParts(iso: Date): { ymd: string; dow: number; minutesSinceMidnight: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ECOMMERCE_OPENING_HOURS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const m = partsToMap(dtf.formatToParts(iso))
  const y = m.year ?? '1970'
  const mo = m.month ?? '01'
  const d = m.day ?? '01'
  const ymd = `${y}-${mo}-${d}`
  const wd = (m.weekday ?? 'Sun').replace(/\.$/, '')
  const dow = WEEKDAY_SHORT_TO_DOW[wd.slice(0, 3)] ?? 0
  const hh = Number.parseInt(m.hour ?? '0', 10)
  const mm = Number.parseInt(m.minute ?? '0', 10)
  const minutesSinceMidnight = hh * 60 + mm
  return { ymd, dow, minutesSinceMidnight }
}

/** Parse "H:mm" or "HH:mm" → minutes since midnight, or null */
export function parseHHmmToMinutes(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const t = s.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number.parseInt(m[1], 10)
  const min = Number.parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || h < 0 || min > 59 || min < 0) return null
  return h * 60 + min
}

/**
 * Absolute UTC Date for a given Nairobi calendar date + local time (EAT = UTC+3).
 */
export function nairobiLocalToUtcDate(ymd: string, hhmm: string): Date | null {
  const mmTotal = parseHHmmToMinutes(hhmm)
  if (mmTotal === null) return null
  const [ys, ms, ds] = ymd.split('-')
  const y = Number.parseInt(ys, 10)
  const mo = Number.parseInt(ms, 10)
  const d = Number.parseInt(ds, 10)
  if (![y, mo, d].every((n) => Number.isFinite(n))) return null
  const h = Math.floor(mmTotal / 60)
  const min = mmTotal % 60
  const utcMs = Date.UTC(y, mo - 1, d, h, min, 0, 0) - NAIROBI_UTC_OFFSET_MS
  return new Date(utcMs)
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split('-').map((x) => Number.parseInt(x, 10))
  const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0, 0)
  const shifted = new Date(anchor + days * 86400000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECOMMERCE_OPENING_HOURS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted)
}

function formatTimeEat(iso: Date): string {
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: ECOMMERCE_OPENING_HOURS_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(iso)
  return `${t} EAT`
}

function formatWeekdayAtTimeEat(iso: Date): string {
  const w = new Intl.DateTimeFormat('en-GB', {
    timeZone: ECOMMERCE_OPENING_HOURS_TZ,
    weekday: 'long',
  }).format(iso)
  return `${w} at ${formatTimeEat(iso)}`
}

function nairobiYmdFromDate(iso: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECOMMERCE_OPENING_HOURS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(iso)
}

const DEFAULT_CLOSED_MESSAGE =
  'We are currently closed. Orders placed now will be processed when we reopen during our next operating hours. Delivery will begin after reopening.'

function buildClosedMessage(
  nextOpening: Date | null,
  customNotice: string | undefined,
  nowRef: Date
): string {
  const custom = typeof customNotice === 'string' ? customNotice.trim() : ''
  if (custom) return custom

  if (!nextOpening) return DEFAULT_CLOSED_MESSAGE

  const nowYmd = nairobiYmdFromDate(nowRef)
  const nextYmd = nairobiYmdFromDate(nextOpening)

  if (nextYmd === nowYmd) {
    return `We are currently closed. Orders placed now will be processed when we reopen today at ${formatTimeEat(nextOpening)}. Delivery will begin after reopening.`
  }

  if (nextYmd === addDaysToYmd(nowYmd, 1)) {
    return `We are currently closed. Orders placed now will be processed when we reopen tomorrow at ${formatTimeEat(nextOpening)}. Delivery will begin after reopening.`
  }

  return `We are currently closed. Orders placed now will be processed on ${formatWeekdayAtTimeEat(nextOpening)} when we reopen. Delivery will begin after reopening.`
}

export function normalizeOpenDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null
  const out: number[] = []
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number.parseInt(String(x), 10)
    if (!Number.isFinite(n) || n < 0 || n > 6) return null
    out.push(n)
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

export type ValidateResult = { ok: true; value: EcommerceOpeningHoursSettings } | { ok: false; error: string }

/**
 * Validates admin-submitted payload (strict when enabled).
 */
export function validateEcommerceOpeningHoursPayload(body: unknown): ValidateResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid payload' }
  }
  const b = body as Record<string, unknown>
  const enabled = Boolean(b.enabled)
  const customNotice = typeof b.customNotice === 'string' ? b.customNotice : ''
  const blockCheckoutWhenClosed = Boolean(b.blockCheckoutWhenClosed)

  if (!enabled) {
    const d = normalizeOpenDays(b.openDays)
    const openDays =
      d && d.length > 0 ? d : [...defaultEcommerceOpeningHours.openDays]
    return {
      ok: true,
      value: {
        enabled: false,
        openingTime: typeof b.openingTime === 'string' ? b.openingTime : defaultEcommerceOpeningHours.openingTime,
        closingTime: typeof b.closingTime === 'string' ? b.closingTime : defaultEcommerceOpeningHours.closingTime,
        openDays,
        customNotice,
        blockCheckoutWhenClosed,
      },
    }
  }

  const openingTime = typeof b.openingTime === 'string' ? b.openingTime.trim() : ''
  const closingTime = typeof b.closingTime === 'string' ? b.closingTime.trim() : ''
  if (!openingTime || !closingTime) {
    return { ok: false, error: 'Opening and closing times are required when the notice is enabled.' }
  }
  const openM = parseHHmmToMinutes(openingTime)
  const closeM = parseHHmmToMinutes(closingTime)
  if (openM === null || closeM === null) {
    return { ok: false, error: 'Opening and closing times must be valid HH:mm (24-hour) values.' }
  }
  if (closeM <= openM) {
    return {
      ok: false,
      error:
        'Closing time must be after opening time on the same calendar day. Overnight hours (past midnight) are not supported yet.',
    }
  }
  const openDays = normalizeOpenDays(b.openDays)
  if (!openDays || openDays.length < 1) {
    return { ok: false, error: 'Select at least one open day when the notice is enabled.' }
  }

  return {
    ok: true,
    value: {
      enabled: true,
      openingTime,
      closingTime,
      openDays,
      customNotice,
      blockCheckoutWhenClosed,
    },
  }
}

function isConfigRuntimeValid(cfg: EcommerceOpeningHoursSettings): boolean {
  if (!cfg.enabled) return true
  const openM = parseHHmmToMinutes(cfg.openingTime)
  const closeM = parseHHmmToMinutes(cfg.closingTime)
  const days = normalizeOpenDays(cfg.openDays)
  if (openM === null || closeM === null || closeM <= openM || !days || days.length < 1) return false
  return true
}

/**
 * Next opening instant strictly after `now`, or null if currently within hours or undiscoverable.
 */
export function computeNextOpeningInstant(
  cfg: EcommerceOpeningHoursSettings,
  now: Date
): Date | null {
  const openSet = new Set(cfg.openDays)
  let ymd = getNairobiWallParts(now).ymd

  for (let i = 0; i < 14; i++) {
    const noon = nairobiLocalToUtcDate(ymd, '12:00')
    if (!noon) return null
    const dow = getNairobiWallParts(noon).dow
    if (!openSet.has(dow)) {
      ymd = addDaysToYmd(ymd, 1)
      continue
    }
    const openInst = nairobiLocalToUtcDate(ymd, cfg.openingTime)
    const closeInst = nairobiLocalToUtcDate(ymd, cfg.closingTime)
    if (!openInst || !closeInst) return null

    if (openInst > now) return openInst

    if (now < closeInst) return null

    ymd = addDaysToYmd(ymd, 1)
  }
  return null
}

function mergeSettings(raw: unknown): EcommerceOpeningHoursSettings {
  if (!raw || typeof raw !== 'object') return { ...defaultEcommerceOpeningHours }
  const r = raw as Record<string, unknown>
  const openDays = normalizeOpenDays(r.openDays)
  return {
    enabled: Boolean(r.enabled),
    openingTime: typeof r.openingTime === 'string' ? r.openingTime : defaultEcommerceOpeningHours.openingTime,
    closingTime: typeof r.closingTime === 'string' ? r.closingTime : defaultEcommerceOpeningHours.closingTime,
    openDays: openDays && openDays.length ? openDays : [...defaultEcommerceOpeningHours.openDays],
    customNotice: typeof r.customNotice === 'string' ? r.customNotice : '',
    blockCheckoutWhenClosed: Boolean(r.blockCheckoutWhenClosed),
  }
}

/**
 * Core evaluation used by APIs and (for admin preview only) the client with the same module.
 */
export function evaluateEcommerceOpeningHours(
  raw: unknown,
  now: Date = new Date()
): EcommerceOpeningHoursEval {
  const cfg = mergeSettings(raw)

  if (!cfg.enabled) {
    return { isOpen: true, isClosed: false, nextOpeningAt: null, message: '' }
  }

  if (!isConfigRuntimeValid(cfg)) {
    return { isOpen: true, isClosed: false, nextOpeningAt: null, message: '' }
  }

  const openSet = new Set(cfg.openDays)
  const { ymd: todayYmd, dow } = getNairobiWallParts(now)
  const openInstToday = nairobiLocalToUtcDate(todayYmd, cfg.openingTime)
  const closeInstToday = nairobiLocalToUtcDate(todayYmd, cfg.closingTime)
  if (!openInstToday || !closeInstToday) {
    return { isOpen: true, isClosed: false, nextOpeningAt: null, message: '' }
  }

  const openNow = openSet.has(dow) && now >= openInstToday && now < closeInstToday

  if (openNow) {
    return { isOpen: true, isClosed: false, nextOpeningAt: null, message: '' }
  }

  const nextOpening = computeNextOpeningInstant(cfg, now)

  const nextIso = nextOpening && nextOpening > now ? nextOpening.toISOString() : null
  const msg = buildClosedMessage(nextOpening && nextOpening > now ? nextOpening : null, cfg.customNotice, now)

  return {
    isOpen: false,
    isClosed: true,
    nextOpeningAt: nextIso,
    message: msg,
  }
}
