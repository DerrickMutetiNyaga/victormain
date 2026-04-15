/** Normalize M-Pesa receipt / transaction codes for duplicate checks (case- and spacing-insensitive). */
export function normalizeMpesaReceiptCode(raw: string | null | undefined): string {
  if (raw == null) return ''
  return String(raw).trim().toUpperCase().replace(/\s+/g, '')
}
