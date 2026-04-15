/**
 * Canonical public URL for links in SMS, emails, etc. (no trailing slash).
 */
export function getJabaPublicBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  return String(raw).replace(/\/$/, '')
}
