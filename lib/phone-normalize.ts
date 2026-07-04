/**
 * Client-safe phone normalization for SMS recipients.
 * Keep this module free of server-only imports (mongodb, etc.).
 */
export function normalizePhoneNumbers(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map((v) => String(v ?? ''))
    : String(input ?? '')
        .split(',')
        .map((v) => v.trim())
  const cleaned = raw
    .map((n) => n.replace(/\s+/g, ''))
    .filter(Boolean)
    .map((n) => {
      const digits = n.replace(/[^\d+]/g, '')
      const noPlus = digits.startsWith('+') ? digits.slice(1) : digits

      // Kenya local format 07XXXXXXXX / 01XXXXXXXX -> +2547XXXXXXXX / +2541XXXXXXXX
      if (/^0\d{9}$/.test(noPlus)) {
        return `+254${noPlus.slice(1)}`
      }

      // Kenya intl without plus 254XXXXXXXXX -> +254XXXXXXXXX
      if (/^254\d{9}$/.test(noPlus)) {
        return `+${noPlus}`
      }

      // Already intl +XXXXXXXX
      if (/^\+\d{8,15}$/.test(digits)) {
        return digits
      }

      // Generic intl digits without plus
      if (/^\d{8,15}$/.test(noPlus)) {
        return `+${noPlus}`
      }

      return ''
    })
    .filter(Boolean)
  return [...new Set(cleaned)]
}
