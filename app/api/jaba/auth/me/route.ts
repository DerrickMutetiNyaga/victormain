import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { buildRoutePermissionsFromUserPermissions } from '@/lib/jaba-permissions'

const CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0'

/**
 * Returns fresh user role, status, permissions from DB.
 * Single source of truth for waiting page - never trust session/JWT for approval state.
 * Response: { ok, user?, reason? } - 404 with reason "deleted" when user no longer exists.
 */
export async function GET(request: NextRequest) {
  const headers = new Headers()
  headers.set('Cache-Control', CACHE_CONTROL)
  headers.set('Pragma', 'no-cache')

  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, reason: 'unauthenticated' },
        { status: 401, headers }
      )
    }

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json(
        { ok: false, reason: 'deleted' },
        { status: 404, headers }
      )
    }

    const role = user.role ?? 'pending'
    const status = user.status ?? 'active'
    const approved =
      role === 'super_admin' ||
      role === 'cashier_admin' ||
      role === 'manager_admin' ||
      (user.approved ?? false)

    const permissions = user.permissions ?? {}
    const routePermissions =
      user.routePermissions ?? buildRoutePermissionsFromUserPermissions(permissions)

    const roleNorm = role.toLowerCase()
    let allowedRoutes: string[] = []
    if (roleNorm === 'super_admin') {
      allowedRoutes = ['/jaba']
    } else if ((roleNorm === 'cashier_admin' || roleNorm === 'manager_admin') && approved && status === 'active') {
      allowedRoutes = routePermissions
    }

    const userPayload = {
      email: user.email,
      name: user.name,
      role: roleNorm,
      status: status === 'active' ? 'ACTIVE' : status === 'inactive' ? 'SUSPENDED' : 'PENDING',
      approved,
      allowedRoutes,
    }
    return NextResponse.json(
      {
        ok: true,
        user: userPayload,
        role: roleNorm,
        status: status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : 'active',
        approved,
        permissions,
        routePermissions,
      },
      { headers }
    )
  } catch (error) {
    console.error('[API /api/jaba/auth/me] Error:', error)
    return NextResponse.json(
      { ok: false, reason: 'error', error: 'Failed to fetch user' },
      { status: 500, headers }
    )
  }
}
