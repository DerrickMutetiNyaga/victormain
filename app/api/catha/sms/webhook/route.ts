import { NextResponse } from 'next/server'
import { createShiftUserSmsLog } from '@/lib/models/shift-user-sms-log'
import {
  markShiftSmsDeliveredByProviderId,
  markShiftSmsDeliveredByQueueId,
  markShiftSmsFailedByProviderId,
  markShiftSmsFailedByQueueId,
} from '@/lib/models/shift-sms-queue'

function hasWebhookAccess(request: Request): boolean {
  const secret = String(process.env.CATHA_SMS_WEBHOOK_SECRET || '').trim()
  if (!secret) return true
  const provided = String(request.headers.get('x-sms-webhook-secret') || '').trim()
  return provided === secret
}

export async function POST(request: Request) {
  if (!hasWebhookAccess(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized webhook' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const queueId = String(body.queueId || body.queue_id || '').trim()
  const providerMessageId = String(body.providerMessageId || body.messageId || body.message_id || '').trim()
  const status = String(body.status || '').toLowerCase()
  const reason = String(body.reason || body.error || 'provider_failure').trim()

  if (!status) return NextResponse.json({ ok: false, error: 'Missing status' }, { status: 400 })

  const delivered = ['delivered', 'delivery_reported', 'success'].includes(status)
  const failed = ['failed', 'rejected', 'undeliverable', 'network_error'].includes(status)
  if (!delivered && !failed) {
    return NextResponse.json({ ok: false, error: 'Unsupported status' }, { status: 400 })
  }

  let updated = false
  if (delivered) {
    if (queueId) updated = await markShiftSmsDeliveredByQueueId(queueId, providerMessageId || null)
    if (!updated && providerMessageId) updated = await markShiftSmsDeliveredByProviderId(providerMessageId)
  } else {
    if (queueId) updated = await markShiftSmsFailedByQueueId(queueId, reason)
    if (!updated && providerMessageId) updated = await markShiftSmsFailedByProviderId(providerMessageId, reason)
  }

  await createShiftUserSmsLog({
    userId: String(body.userId || 'unknown'),
    shiftId: String(body.shiftId || ''),
    phone: String(body.phone || ''),
    message: String(body.message || ''),
    status: delivered ? 'sent' : 'failed',
    eventType: 'SHIFT_CLOSED',
    error: delivered ? undefined : reason,
  })

  return NextResponse.json({ ok: true, updated })
}

