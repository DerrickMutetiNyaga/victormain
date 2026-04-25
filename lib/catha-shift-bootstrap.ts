import { ensureStaffShiftIndexes } from '@/lib/models/staff-shift'
import { ensureShiftBreakIndexes } from '@/lib/models/shift-break'
import { ensureShiftEventIndexes } from '@/lib/models/shift-event'
import { ensureShiftSettingsIndexes } from '@/lib/models/shift-setting'
import { ensureShiftNotificationLogIndexes } from '@/lib/models/shift-notification-log'

let bootstrapPromise: Promise<void> | null = null

export async function ensureCathaShiftInfrastructure() {
  if (!bootstrapPromise) {
    bootstrapPromise = Promise.all([
      ensureStaffShiftIndexes(),
      ensureShiftBreakIndexes(),
      ensureShiftEventIndexes(),
      ensureShiftSettingsIndexes(),
      ensureShiftNotificationLogIndexes(),
    ])
      .then(() => undefined)
      .catch((error: any) => {
        console.warn('[Catha Shift] Index bootstrap failed:', error?.message)
      })
  }
  return bootstrapPromise
}
