import { NextResponse } from 'next/server'

/**
 * Blocks obvious cross-site browser POSTs/DELETEs (session cookie CSRF).
 * Browsers send Sec-Fetch-Site; same-origin navigations are not cross-site.
 * Missing header (non-browser clients) is allowed so scripts/curl still work in controlled environments.
 */
export function assertJabaStatefulRequestOrigin(request: Request): NextResponse | null {
  const site = (request.headers.get('sec-fetch-site') || '').toLowerCase()
  if (site === 'cross-site') {
    return NextResponse.json(
      {
        error:
          'This request was blocked as a cross-site submission. Open the app from the same site and try again.',
        code: 'CROSS_SITE_BLOCKED',
      },
      { status: 403 }
    )
  }
  return null
}
