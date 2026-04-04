/**
 * Phone number utilities for Kenyan phone numbers
 */

/**
 * Valid Kenyan phone number patterns:
 * - 07XXXXXXXX (Safaricom, Airtel)
 * - 01XXXXXXXX (Safaricom)
 * - +2547XXXXXXXX
 * - +2541XXXXXXXX
 * - 2547XXXXXXXX (without +)
 */

/**
 * Check if a phone number is a valid Kenyan format
 */
export function isValidKenyaPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  
  // Remove all whitespace and dashes
  const cleaned = phone.replace(/[\s-]/g, "")
  
  // Must have at least 10 digits
  const digitsOnly = cleaned.replace(/\D/g, "")
  if (digitsOnly.length < 9) return false
  
  // Valid patterns
  const patterns = [
    /^07\d{8}$/,           // 07XXXXXXXX
    /^01\d{8}$/,           // 01XXXXXXXX
    /^\+2547\d{8}$/,       // +2547XXXXXXXX
    /^\+2541\d{8}$/,       // +2541XXXXXXXX
    /^2547\d{8}$/,         // 2547XXXXXXXX (without +)
    /^2541\d{8}$/,         // 2541XXXXXXXX (without +)
  ]
  
  return patterns.some((pattern) => pattern.test(cleaned))
}

/**
 * Normalize a Kenyan phone number to +254 format
 * Returns null if the phone is invalid or empty
 */
export function normalizeKenyaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  
  // Remove all whitespace and dashes
  const cleaned = phone.replace(/[\s-]/g, "")
  
  // If empty after cleaning, return null
  if (!cleaned) return null
  
  // Already in +254 format
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return cleaned
  }
  
  // 254XXXXXXXX format (without +)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`
  }
  
  // 07XXXXXXXX format -> +2547XXXXXXXX
  if (/^07\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`
  }
  
  // 01XXXXXXXX format -> +2541XXXXXXXX
  if (/^01\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`
  }
  
  // If we get here and it looks like a partial number, try to normalize
  // This handles cases like "7XXXXXXXX" -> "+2547XXXXXXXX"
  if (/^7\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`
  }
  if (/^1\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`
  }
  
  // Can't normalize - return as-is if it has enough digits, otherwise null
  const digitsOnly = cleaned.replace(/\D/g, "")
  if (digitsOnly.length >= 9) {
    // Try to return something reasonable
    if (cleaned.startsWith("+")) return cleaned
    return cleaned
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
  
  const cleaned = phone.replace(/[\s-]/g, "")
  const digitsOnly = cleaned.replace(/\D/g, "")
  
  if (digitsOnly.length < 9) {
    return "Phone number is too short"
  }
  
  if (!isValidKenyaPhone(phone)) {
    return "Enter a valid Kenyan number (07XX or +254)"
  }
  
  return null
}

