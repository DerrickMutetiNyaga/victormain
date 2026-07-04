/**
 * Sanitize OAuth/post-login callback paths. Never trust query params alone — blocks open redirects
 * and cross-app paths (e.g. pointing Jaba sign-in at /catha or external URLs).
 */

function stripQueryHash(path: string): string {
  let s = path
  const q = s.indexOf('?')
  const h = s.indexOf('#')
  if (q >= 0) s = s.slice(0, q)
  if (h >= 0 && (q < 0 || h < q)) s = s.slice(0, h)
  return s || '/'
}

export function safeJabaCallbackUrl(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return '/jaba'
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//') || t.includes('\\')) return '/jaba'
  const path = stripQueryHash(t)
  if (!path.startsWith('/jaba')) return '/jaba'
  return path
}

export function safeCathaCallbackUrl(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return '/catha/entry'
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//') || t.includes('\\')) return '/catha/entry'
  const path = stripQueryHash(t)
  if (!path.startsWith('/catha')) return '/catha/entry'
  return path
}
