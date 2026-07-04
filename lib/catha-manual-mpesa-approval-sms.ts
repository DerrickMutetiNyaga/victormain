import type { Db } from 'mongodb'
import { sendJabaSmsStrict } from '@/lib/jaba-sms'
import { createManualMpesaApprovalToken } from '@/lib/catha-manual-mpesa-approval-token'
import type { ManualMpesaVerificationForApi } from '@/lib/catha-manual-mpesa-verification'
import { getCathaNotificationSettings } from '@/lib/catha-notification-settings'

function buildManualMpesaApprovalSmsMessage(
  verification: ManualMpesaVerificationForApi,
  approveUrl: string,
  minsLeft: number
): string {
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
  lines.push(`Approve (expires ${minsLeft}m): ${approveUrl}`)
  return lines.join('\n')
}

export async function maybeSendManualMpesaApprovalSms(
  db: Db,
  verification: ManualMpesaVerificationForApi
): Promise<{ sent: boolean; reason?: string; approveUrl?: string }> {
  try {
    const notifications = await getCathaNotificationSettings(db)

    if (!notifications.manualMpesaApprovalSmsEnabled) {
      console.log('[manual-mpesa-approval-sms] Skipped: toggle disabled')
      return { sent: false, reason: 'disabled' }
    }

    const phones = notifications.manualMpesaApprovalPhones
    if (!phones.length) {
      console.warn('[manual-mpesa-approval-sms] Skipped: no approval numbers configured')
      return { sent: false, reason: 'no_recipients' }
    }

    const expiryMinutes = notifications.manualMpesaApprovalLinkExpiryMinutes

    const { approveUrl, expiresAt } = await createManualMpesaApprovalToken(
      db,
      verification.id,
      expiryMinutes
    )

    const minsLeft = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60000))
    const message = buildManualMpesaApprovalSmsMessage(verification, approveUrl, minsLeft)

    console.log('[manual-mpesa-approval-sms] Sending', {
      verificationId: verification.id,
      orderId: verification.orderId,
      transactionCode: verification.transactionCode,
      recipientCount: phones.length,
      recipients: phones,
      messagePreview: message.slice(0, 160),
    })

    await sendJabaSmsStrict(message, phones)

    console.log('[manual-mpesa-approval-sms] Sent successfully', {
      verificationId: verification.id,
      recipientCount: phones.length,
    })

    return { sent: true, approveUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sms_send_failed'
    console.error('[manual-mpesa-approval-sms] Failed:', error)
    return { sent: false, reason: message }
  }
}
