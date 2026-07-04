import type { Db } from 'mongodb'
import { normalizePhoneNumbers } from '@/lib/jaba-sms'

export type CathaNotificationSettings = {
  lowStockAlerts: boolean
  dailySalesSummary: boolean
  newOrderNotifications: boolean
  supplierDeliveryReminders: boolean
  securitySmsAlertsEnabled: boolean
  securityAlertNumbers: string[]
  shiftNotificationPhones: string[]
  onlineOrderSmsPhones: string[]
  securityDeniedBurstThreshold: number
  manualMpesaApprovalSmsEnabled: boolean
  manualMpesaApprovalPhones: string[]
  manualMpesaApprovalLinkExpiryMinutes: number
}

export const DEFAULT_CATHA_NOTIFICATIONS: CathaNotificationSettings = {
  lowStockAlerts: true,
  dailySalesSummary: true,
  newOrderNotifications: false,
  supplierDeliveryReminders: true,
  securitySmsAlertsEnabled: false,
  securityAlertNumbers: [],
  shiftNotificationPhones: [],
  onlineOrderSmsPhones: [],
  securityDeniedBurstThreshold: 10,
  manualMpesaApprovalSmsEnabled: false,
  manualMpesaApprovalPhones: [],
  manualMpesaApprovalLinkExpiryMinutes: 60,
}

export function normalizeCathaSmsRecipients(input: unknown): string[] {
  return normalizePhoneNumbers(input)
}

export async function getCathaNotificationSettings(db: Db): Promise<CathaNotificationSettings> {
  const settings = await db.collection('catha_settings').findOne(
    {},
    { projection: { notifications: 1 } }
  )
  const stored = (settings as { notifications?: Partial<CathaNotificationSettings> } | null)
    ?.notifications

  return {
    ...DEFAULT_CATHA_NOTIFICATIONS,
    ...(stored ?? {}),
    securityAlertNumbers: normalizeCathaSmsRecipients(stored?.securityAlertNumbers ?? []),
    shiftNotificationPhones: normalizeCathaSmsRecipients(stored?.shiftNotificationPhones ?? []),
    onlineOrderSmsPhones: normalizeCathaSmsRecipients(stored?.onlineOrderSmsPhones ?? []),
    manualMpesaApprovalPhones: normalizeCathaSmsRecipients(stored?.manualMpesaApprovalPhones ?? []),
    manualMpesaApprovalSmsEnabled: Boolean(stored?.manualMpesaApprovalSmsEnabled),
    manualMpesaApprovalLinkExpiryMinutes: Math.max(
      15,
      Math.min(
        24 * 60,
        Math.round(Number(stored?.manualMpesaApprovalLinkExpiryMinutes) || 60)
      )
    ),
  }
}
