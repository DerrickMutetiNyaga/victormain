/**
 * Normalize M-Pesa transaction status from API into a consistent set.
 * APIs may return SUCCESS/FAILURE, 0/1, or different casings.
 */
export type MpesaStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export function normalizeMpesaStatus(raw: unknown): MpesaStatus {
  const s = String(raw ?? '').toUpperCase().trim()
  if (s === 'COMPLETED' || s === 'SUCCESS' || s === '1' || s === 'PAID') return 'COMPLETED'
  if (s === 'FAILED' || s === 'FAILURE' || s === '0' || s === 'ERROR') return 'FAILED'
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'CANCEL') return 'CANCELLED'
  return 'PENDING'
}

