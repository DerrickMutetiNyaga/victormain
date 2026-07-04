type TimingStatus = 'ON_TIME' | 'EARLY' | 'LATE' | 'OVERTIME'

export interface ShiftTimingAnalysis {
  openStatus: TimingStatus
  closeStatus: TimingStatus
  openDiffMs: number
  closeDiffMs: number
  timeSinceStartMs: number | null
  overtimeByMs: number | null
}

const MINUTE_MS = 60_000
const DEFAULT_NOISE_THRESHOLD_MINUTES = 2

function floorToMinute(ms: number): number {
  return Math.max(0, Math.floor(ms / MINUTE_MS) * MINUTE_MS)
}

export function formatDurationCompact(ms: number): string {
  const rounded = floorToMinute(ms)
  const totalMinutes = Math.round(rounded / MINUTE_MS)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export function formatSignedTiming(ms: number): string {
  if (ms === 0) return '0m'
  return `${ms > 0 ? '+' : '-'}${formatDurationCompact(Math.abs(ms))}`
}

export function formatSignedTimingForSms(ms: number, options?: { capMinutesAfterHours?: number }): string {
  if (ms === 0) return '0m'
  const absMs = Math.abs(ms)
  const totalMinutes = Math.round(absMs / MINUTE_MS)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const capAfterHours = options?.capMinutesAfterHours ?? 10
  const sign = ms > 0 ? '+' : '-'
  if (hours >= capAfterHours) {
    return `${sign}${hours}h`
  }
  if (hours > 0 && minutes > 0) return `${sign}${hours}h ${minutes}m`
  if (hours > 0) return `${sign}${hours}h`
  return `${sign}${minutes}m`
}

export function analyzeShiftTiming(params: {
  scheduledStartTime?: Date | string | null
  scheduledEndTime?: Date | string | null
  actualStartTime?: Date | string | null
  actualEndTime?: Date | string | null
  now?: Date
  active?: boolean
  noiseThresholdMinutes?: number
}): ShiftTimingAnalysis {
  const {
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    active,
    now = new Date(),
    noiseThresholdMinutes = DEFAULT_NOISE_THRESHOLD_MINUTES,
  } = params

  const scheduledStart = scheduledStartTime ? new Date(scheduledStartTime) : null
  const scheduledEnd = scheduledEndTime ? new Date(scheduledEndTime) : null
  const actualStart = actualStartTime ? new Date(actualStartTime) : null
  const actualEnd = actualEndTime ? new Date(actualEndTime) : null
  const thresholdMs = Math.max(0, noiseThresholdMinutes) * MINUTE_MS

  const openDiffRawMs =
    scheduledStart && actualStart ? actualStart.getTime() - scheduledStart.getTime() : 0
  const closeDiffRawMs =
    scheduledEnd && actualEnd ? actualEnd.getTime() - scheduledEnd.getTime() : 0

  const openDiffMs = Math.abs(openDiffRawMs) < thresholdMs ? 0 : openDiffRawMs
  const closeDiffMs = Math.abs(closeDiffRawMs) < thresholdMs ? 0 : closeDiffRawMs

  const openStatus: TimingStatus =
    openDiffMs === 0 ? 'ON_TIME' : openDiffMs > 0 ? 'LATE' : 'EARLY'
  const closeStatus: TimingStatus =
    closeDiffMs === 0 ? 'ON_TIME' : closeDiffMs > 0 ? 'LATE' : 'EARLY'

  let timeSinceStartMs: number | null = null
  let overtimeByMs: number | null = null
  if (active && actualStart) {
    timeSinceStartMs = Math.max(0, now.getTime() - actualStart.getTime())
    if (scheduledEnd) {
      const overtimeRaw = now.getTime() - scheduledEnd.getTime()
      overtimeByMs = overtimeRaw >= thresholdMs ? overtimeRaw : 0
    } else {
      overtimeByMs = 0
    }
  }

  return {
    openStatus,
    closeStatus,
    openDiffMs,
    closeDiffMs,
    timeSinceStartMs,
    overtimeByMs,
  }
}
