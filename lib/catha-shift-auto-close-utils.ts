import type { StaffShift } from '@/lib/models/staff-shift'

export function overdueThresholdMs(scheduledEndAt: Date, graceHours: number): number {
  return new Date(scheduledEndAt).getTime() + graceHours * 60 * 60 * 1000
}

export function isOverdueForAutoClose(
  shift: Pick<StaffShift, 'scheduledEndAt'>,
  graceHours: number,
  now = Date.now()
): boolean {
  if (!shift.scheduledEndAt) return false
  return now > overdueThresholdMs(shift.scheduledEndAt, graceHours)
}
