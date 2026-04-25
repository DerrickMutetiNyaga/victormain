import { sendJabaSms } from '@/lib/jaba-sms'
import { createShiftNotificationLog, ShiftNotificationType } from '@/lib/models/shift-notification-log'
import { getShiftNotificationSettings } from '@/lib/models/shift-notification-settings'

function shouldSend(type: ShiftNotificationType, settings: Awaited<ReturnType<typeof getShiftNotificationSettings>>) {
  if (!settings.enabled) return false
  if (type === 'CLOCK_IN') return settings.clockIn
  if (type === 'CLOCK_OUT') return settings.clockOut
  if (type === 'SUSPICIOUS') return settings.suspicious
  if (type === 'CASH_VARIANCE') return settings.cashVariance
  return false
}

export async function sendShiftNotification(type: ShiftNotificationType, message: string, shiftId?: string) {
  const settings = await getShiftNotificationSettings()
  const recipients = settings.numbers
  if (!shouldSend(type, settings) || recipients.length === 0) {
    await createShiftNotificationLog({ shiftId, type, recipients, message, success: false, error: 'disabled_or_no_numbers' })
    return
  }
  try {
    await sendJabaSms(message, recipients)
    await createShiftNotificationLog({ shiftId, type, recipients, message, success: true })
  } catch (error: any) {
    await createShiftNotificationLog({ shiftId, type, recipients, message, success: false, error: error?.message || 'send_failed' })
  }
}
