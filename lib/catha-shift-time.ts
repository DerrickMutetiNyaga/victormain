const EAT_TIME_ZONE = 'Africa/Nairobi'

function getEatParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: EAT_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return map
}

export function getEatBusinessDate(date: Date = new Date()): string {
  const p = getEatParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

export function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map((v) => Number(v))
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 }
}

export function getScheduledEatDate(hm: string, now: Date = new Date()): Date {
  const p = getEatParts(now)
  const { hour, minute } = parseHm(hm)
  const utcApprox = new Date(
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour - 3, minute, 0, 0)
  )
  return utcApprox
}

export function evaluateLateness(scheduledStartAt: Date, actualStartAt: Date): 'on_time' | 'yellow' | 'orange' | 'red' {
  const diffMinutes = Math.max(0, Math.round((actualStartAt.getTime() - scheduledStartAt.getTime()) / 60000))
  if (diffMinutes >= 30) return 'red'
  if (diffMinutes >= 15) return 'orange'
  if (diffMinutes >= 5) return 'yellow'
  return 'on_time'
}

export function isEarlyExit(scheduledEndAt: Date, endedAt: Date): boolean {
  return endedAt.getTime() < scheduledEndAt.getTime()
}

export function isOvertime(scheduledEndAt: Date, endedAt: Date): boolean {
  return endedAt.getTime() - scheduledEndAt.getTime() >= 30 * 60000
}

export { EAT_TIME_ZONE }
