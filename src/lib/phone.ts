/**
 * Light phone / WhatsApp validation shared by sign-up and the settings pages.
 * Accepts digits, a leading +, spaces, dashes and brackets; requires 7–15 digits
 * (the E.164 range). Not a carrier lookup — it only stops "abc-not-a-number".
 */
const ALLOWED = /^[+\d][\d\s\-().]*$/

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!ALLOWED.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** Returns an error message, or null when the value is empty or valid. */
export function phoneError(value: string, label = 'Phone number'): string | null {
  if (!value.trim()) return null
  return isValidPhone(value) ? null : `${label} must be 7–15 digits (e.g. +92 300 0000000)`
}
