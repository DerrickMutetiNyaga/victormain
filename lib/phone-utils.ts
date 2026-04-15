/**
 * Phone number utilities for Kenyan phone numbers
 *
 * Accepted input examples (all normalize to +2547XXXXXXXX or +2541XXXXXXXX):
 * - +254796030992
 * - 254796030992
 * - 0796030992
 * - 0113794000 / 01XXXXXXXX (Safaricom-style 01…)
 * - 796030992 (9 digits after dropping leading 0)
 * - +2540113794000 / 2540113794000 (extra 0 after 254 — normalized away)
 */

const CANONICAL_KENYA = /^\+254[17]\d{8}$/

function stripPhoneInput(phone: string): string {
  return phone.replace(/[\s\-().]/g, "").trim()
}

/**
 * Check if a phone number is a valid Kenyan format (after normalization).
 */
export function isValidKenyaPhone(phone: string | null | undefined): boolean {
  const n = normalizeKenyaPhone(phone)
  return n !== null && CANONICAL_KENYA.test(n)
}

/**
 * Normalize a Kenyan phone number to +2547XXXXXXXX / +2541XXXXXXXX.
 * Returns null if the phone is invalid or empty.
 */
export function normalizeKenyaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  const cleaned = stripPhoneInput(String(phone))
  if (!cleaned) return null

  // +2547XXXXXXXX / +2541XXXXXXXX
  if (CANONICAL_KENYA.test(cleaned)) {
    return cleaned
  }

  // 2547XXXXXXXX / 2541XXXXXXXX (no +)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  // +2540… / 2540… — stray 0 after country code (e.g. +2540113794000 → +254113794000)
  const dupZeroAfter254 = cleaned.match(/^\+?2540([17]\d{8})$/)
  if (dupZeroAfter254) {
    return `+254${dupZeroAfter254[1]}`
  }

  // 07XXXXXXXX / 01XXXXXXXX
  if (/^07\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`
  }
  if (/^01\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`
  }

  // 7XXXXXXXX / 1XXXXXXXX (9 digits, national mobile without leading 0)
  if (/^7\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`
  }
  if (/^1\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`
  }

  return null
}

/**
 * Format a phone number for display
 * +2547XXXXXXXX -> +254 7XX XXX XXX
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ""
  
  const normalized = normalizeKenyaPhone(phone)
  if (!normalized) return phone
  
  // Format: +254 7XX XXX XXX
  if (normalized.startsWith("+254") && normalized.length === 13) {
    const rest = normalized.slice(4) // 7XXXXXXXX
    return `+254 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`
  }
  
  return normalized
}

/**
 * Get validation error message for phone
 */
export function getPhoneValidationError(phone: string): string | null {
  if (!phone) return null // Empty is OK (optional)

  const cleaned = stripPhoneInput(phone)
  const digitsOnly = cleaned.replace(/\D/g, "")

  if (digitsOnly.length < 9) {
    return "Phone number is too short"
  }

  if (!isValidKenyaPhone(phone)) {
    return "Use a Kenyan mobile: 0796030992, 0113794000, or +254796030992"
  }

  return null
}

