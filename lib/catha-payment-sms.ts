import type { Db } from 'mongodb'
import { normalizePhoneNumbers, sendJabaSmsStrict } from '@/lib/jaba-sms'

function buildCathaPaymentReceiptMessage(orderId: string): string {
  const receiptLink =
    process.env.CATHA_RECEIPT_LINK_BASE?.trim() ||
    `https://www.infusionjaba.co.ke/catha/orders?orderId=${encodeURIComponent(orderId)}`
  return `Payment received! Thank you for choosing Catha Lodge. Your order has been confirmed. Download your receipt here: ${receiptLink}. We appreciate your visit and look forward to serving you again.`
}

export async function maybeSendCathaPaymentReceiptSms(
  db: Db,
  orderId: string
): Promise<{ sent: boolean; reason?: string }> {
  const order = await db.collection('orders').findOne({ id: orderId })
  if (!order) return { sent: false, reason: 'order_not_found' }

  const status = String(order.status || '').toLowerCase()
  const paymentStatus = String(order.paymentStatus || '').toUpperCase()
  const isSettled = status === 'completed' && (paymentStatus === 'PAID' || paymentStatus === 'OVERPAID')
  if (!isSettled) return { sent: false, reason: 'order_not_settled' }

  const normalized = normalizePhoneNumbers(order.customerPhone ?? '')
  const targetPhone = normalized[0] || null
  if (!targetPhone) return { sent: false, reason: 'no_valid_customer_phone' }

  const claim = await db.collection('orders').updateOne(
    { id: orderId, paymentReceiptSmsSentAt: { $exists: false } },
    {
      $set: {
        paymentReceiptSmsSentAt: new Date(),
        paymentReceiptSmsPhone: targetPhone,
        paymentReceiptSmsStatus: 'SENDING',
        updatedAt: new Date(),
      },
    }
  )
  if (claim.matchedCount === 0) return { sent: false, reason: 'already_sent_or_in_progress' }

  const message = buildCathaPaymentReceiptMessage(orderId)
  try {
    await sendJabaSmsStrict(message, [targetPhone])
    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          paymentReceiptSmsStatus: 'SENT',
          paymentReceiptSmsLastError: null,
          updatedAt: new Date(),
        },
      }
    )
    return { sent: true }
  } catch (error: any) {
    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          paymentReceiptSmsStatus: 'FAILED',
          paymentReceiptSmsLastError: String(error?.message || 'sms_send_failed'),
          updatedAt: new Date(),
        },
        $unset: {
          paymentReceiptSmsSentAt: '',
        },
      }
    )
    return { sent: false, reason: 'sms_send_failed' }
  }
}

