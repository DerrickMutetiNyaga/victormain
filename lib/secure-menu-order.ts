import type { Db } from 'mongodb'
import { resolveBarOrderLines } from '@/lib/secure-bar-order-lines'

/**
 * Public /menu QR orders: inventory SKUs only — no custom-priced lines.
 */
export async function pricingForMenuOrderLines(db: Db, items: unknown) {
  return resolveBarOrderLines(db, items, {
    allowCustomLines: false,
    rejectCustomLines: true,
  })
}

/**
 * Block fake "paid" updates without at least a plausible M-Pesa receipt reference.
 */
export function sanitizePublicMenuPaymentFields(
  update: Record<string, unknown>,
  existing: { paymentMethod?: string | null; mpesaReceiptNumber?: string | null }
): void {
  const wantsPaid = update.paymentStatus === 'PAID'
  if (!wantsPaid) return
  const method = String(update.paymentMethod ?? existing.paymentMethod ?? '').toLowerCase()
  if (method === 'mpesa') {
    const receipt = String(update.mpesaReceiptNumber ?? existing.mpesaReceiptNumber ?? '').trim()
    if (receipt.length < 5) {
      delete update.paymentStatus
    }
  }
}
