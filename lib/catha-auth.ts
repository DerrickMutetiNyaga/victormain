/**
 * Catha V2 server-side access helpers.
 * Use in Server Components / Route Handlers. All role/status/permission checks here.
 */
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'

export type CathaSession = Awaited<ReturnType<typeof getCathaSession>>

/** Returns session or null. Does not redirect. */
export async function getCathaSession() {
  return auth()
}

/**
 * Redirects to /catha/login if no session.
 * Then: PENDING -> /catha/waiting, DISABLED -> /catha/disabled.
 * Otherwise returns session.
 */
export async function requireCathaAuth() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/catha/login')
  }
  const status = (session.user as any).status as string | undefined
  const s = (status ?? 'PENDING').toUpperCase()
  if (s === 'PENDING') redirect('/catha/waiting')
  if (s === 'DISABLED') redirect('/catha/disabled')
  return session
}

/** Requires auth then SUPER_ADMIN; else redirects to /catha/access-denied. */
export async function requireSuperAdmin() {
  const session = await requireCathaAuth()
  const role = (session.user as any).role as string | undefined
  if ((role ?? '').toUpperCase() !== 'SUPER_ADMIN') {
    redirect('/catha/access-denied')
  }
  return session
}

/** Requires auth then permission (or SUPER_ADMIN); else redirects to /catha/access-denied. */
export async function requireCathaPermission(permission: string) {
  const session = await requireCathaAuth()
  const role = (session.user as any).role as string | undefined
  if ((role ?? '').toUpperCase() === 'SUPER_ADMIN') return session
  const permissions = (session.user as any).permissions as string[] | undefined
  if (Array.isArray(permissions) && permissions.includes(permission)) return session
  redirect('/catha/access-denied')
}

/** For API routes: returns session or null. Does not redirect. */
export async function getCathaSessionForApi() {
  return getCathaSession()
}

/** For API routes: require SUPER_ADMIN. Returns [session, null] or [null, NextResponse]. */
export async function requireSuperAdminApi(): Promise<
  [Awaited<ReturnType<typeof getCathaSession>>, null] | [null, NextResponse]
> {
  const session = await getCathaSession()
  if (!session?.user?.email) {
    return [null, NextResponse.json({ error: 'Unauthorized' }, { status: 401 })]
  }
  const role = (session.user as any).role as string | undefined
  if ((role ?? '').toUpperCase() !== 'SUPER_ADMIN') {
    return [null, NextResponse.json({ error: 'Forbidden' }, { status: 403 })]
  }
  return [session, null]
}
