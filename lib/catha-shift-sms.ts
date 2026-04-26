import { sendJabaSmsStrict } from '@/lib/jaba-sms'
import { createShiftNotificationLog, ShiftNotificationType } from '@/lib/models/shift-notification-log'
import { getShiftNotificationSettings } from '@/lib/models/shift-notification-settings'
import { getDatabase } from '@/lib/mongodb'
import { normalizePhoneNumbers } from '@/lib/jaba-sms'
import { findRecentSuccessfulShiftNotificationByDedupeKey } from '@/lib/models/shift-notification-log'

function shouldSend(type: ShiftNotificationType, settings: Awaited<ReturnType<typeof getShiftNotificationSettings>>) {
  if (!settings.enabled) return false
  if (type === 'CLOCK_IN') return settings.clockIn
  if (type === 'CLOCK_OUT') return settings.clockOut
  if (type === 'SUSPICIOUS') return settings.suspicious
  if (type === 'CASH_VARIANCE') return settings.cashVariance
  return false
}

export async function sendShiftNotification(
  type: ShiftNotificationType,
  message: string,
  shiftId?: string,
  options?: { dedupeKey?: string; dedupeWindowMinutes?: number }
) {
  const settings = await getShiftNotificationSettings()
  const db = await getDatabase('infusion_jaba')
  const cathaSettings = await db.collection('catha_settings').findOne(
    {},
    { projection: { 'notifications.shiftNotificationPhones': 1 } }
  )
  const settingsPhones = Array.isArray(cathaSettings?.notifications?.shiftNotificationPhones)
    ? cathaSettings.notifications.shiftNotificationPhones
    : []
  const recipients = normalizePhoneNumbers([...settings.numbers, ...settingsPhones])
  const isShiftOpenOrClose = type === 'CLOCK_IN' || type === 'CLOCK_OUT'
  const settingsPhonesOptIn = isShiftOpenOrClose && settingsPhones.length > 0
  const canSend = shouldSend(type, settings) || settingsPhonesOptIn
  if (!canSend || recipients.length === 0) {
    await createShiftNotificationLog({
      shiftId,
      type,
      dedupeKey: options?.dedupeKey,
      recipients,
      message,
      success: false,
      error: 'disabled_or_no_numbers',
    })
    return
  }
  if (options?.dedupeKey) {
    const existing = await findRecentSuccessfulShiftNotificationByDedupeKey(
      options.dedupeKey,
      options.dedupeWindowMinutes ?? 30
    )
    if (existing) {
      await createShiftNotificationLog({
        shiftId,
        type,
        dedupeKey: options.dedupeKey,
        recipients,
        message,
        success: false,
        error: 'duplicate_suppressed',
      })
      return
    }
  }
  try {
    await sendJabaSmsStrict(message, recipients)
    await createShiftNotificationLog({
      shiftId,
      type,
      dedupeKey: options?.dedupeKey,
      recipients,
      message,
      success: true,
    })
  } catch (error: any) {
    await createShiftNotificationLog({
      shiftId,
      type,
      dedupeKey: options?.dedupeKey,
      recipients,
      message,
      success: false,
      error: error?.message || 'send_failed',
    })
    return
  }
}
