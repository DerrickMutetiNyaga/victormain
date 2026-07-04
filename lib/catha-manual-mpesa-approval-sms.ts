import type { Db } from 'mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { sendJabaSmsStrict } from '@/lib/jaba-sms'
import { createManualMpesaApprovalToken } from '@/lib/catha-manual-mpesa-approval-token'
import type { ManualMpesaVerificationForApi } from '@/lib/catha-manual-mpesa-verification'

function normalizeRecipients(input: unknown): string[] {
  const arr = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
  const normalized = arr
    .map((n) => normalizeKenyaPhone(String(n)))
    .filter((n): n is string => Boolean(n))
  return [...new Set(normalized)]
}

export async function maybeSendManualMpesaApprovalSms(
  db: Db,
  verification: ManualMpesaVerificationForApi
): Promise<{ sent: boolean; reason?: string; approveUrl?: string }> {
  try {
    const settings = await db.collection('catha_settings').findOne({})
    const notifications = (settings as { notifications?: Record<string, unknown> })?.notifications ?? {}
    const enabled = Boolean(notifications.manualMpesaApprovalSmsEnabled)
    if (!enabled) return { sent: false, reason: 'disabled' }

    const phones = normalizeRecipients(notifications.manualMpesaApprovalPhones ?? [])
    if (!phones.length) return { sent: false, reason: 'no_recipients' }

    const expiryMinutes = Math.max(
      15,
      Math.min(24 * 60, Math.round(Number(notifications.manualMpesaApprovalLinkExpiryMinutes) || 60))
    )

    const { approveUrl, expiresAt } = await createManualMpesaApprovalToken(
      db,
      verification.id,
      expiryMinutes
    )

    const minsLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000)
    const lines = [
      'Manual M-Pesa approval needed',
      `Code: ${verification.transactionCode}`,
      `Order: ${verification.orderId}`,
      `KES ${Number(verification.amount || 0).toFixed(2)}`,
      `By: ${verification.enteredBy}`,
    ]
    if (verification.notes) {
      lines.push(`Reason: ${verification.notes.slice(0, 80)}`)
    }
    lines.push(`Approve (expires ${minsLeft}m):`)
    lines.push(approveUrl)

    await sendJabaSmsStrict(lines.join('\n'), phones)

    return { sent: true, approveUrl }
  } catch (error) {
    console.error('[manual-mpesa-approval-sms] Failed:', error)
    return { sent: false, reason: 'sms_send_failed' }
  }
}
