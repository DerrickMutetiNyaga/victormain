/**
 * Catha V2 server-side access helpers.
 * Use in Server Components / Route Handlers. All role/status/permission checks here.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'
import { getCathaUserByEmail } from '@/lib/models/catha-user'
import {
  canView,
  isSuperAdmin,
  matchRoutePermission,
  type CathaAccessUser,
} from '@/lib/catha-access'

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

/**
 * Enforces route-level access for (protected) Catha pages using DB permissions (same rules as /api/catha/auth/me nav).
 * Middleware sets x-catha-pathname. Deny-by-default: cashiers/managers only see modules with view=true.
 */
export async function requireCathaNavAccessForRequestPath() {
  const session = await requireCathaAuth()
  const h = await headers()
  const pathname = (h.get('x-catha-pathname') || '').trim() || '/catha'

  if (pathname.startsWith('/catha/ai-intelligence')) {
    const row = await getCathaUserByEmail(session.user!.email!)
    const accessUser: CathaAccessUser = row
      ? { role: row.role, status: row.status, permissions: row.permissions as CathaAccessUser['permissions'] }
      : { role: 'PENDING' }
    if (!isSuperAdmin(accessUser)) {
      redirect('/catha/access-denied')
    }
    return session
  }

  const key = matchRoutePermission(pathname)
  if (key === null) {
    return session
  }

  const row = await getCathaUserByEmail(session.user!.email!)
  if (!row) {
    redirect('/catha/access-denied')
  }
  const accessUser: CathaAccessUser = {
    role: row.role,
    status: row.status,
    permissions: row.permissions as CathaAccessUser['permissions'],
  }

  if (!canView(accessUser, key)) {
    redirect('/catha/access-denied')
  }
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

/** For API routes: require SUPER_ADMIN (verified from DB, not JWT alone). */
export async function requireSuperAdminApi(): Promise<
  [Awaited<ReturnType<typeof getCathaSession>>, null] | [null, NextResponse]
> {
  const session = await getCathaSession()
  if (!session?.user?.email) {
    return [null, NextResponse.json({ error: 'Unauthorized' }, { status: 401 })]
  }
  const cu = await getCathaUserByEmail(session.user.email)
  if (!cu) {
    return [null, NextResponse.json({ error: 'User not found' }, { status: 404 })]
  }
  const role = String(cu.role ?? '').toUpperCase()
  if (role !== 'SUPER_ADMIN') {
    return [null, NextResponse.json({ error: 'Forbidden' }, { status: 403 })]
  }
  return [session, null]
}
