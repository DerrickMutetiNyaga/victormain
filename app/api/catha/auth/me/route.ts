import { NextResponse } from 'next/server'
import { getCathaSession } from '@/lib/catha-auth'
import { getCathaUserByEmail } from '@/lib/models/catha-user'
import { buildAllowedRoutes, isSuperAdmin } from '@/lib/catha-access'
import { autoCloseOverdueShiftForUser, runFirstRequestBacklogSweep } from '@/lib/catha-shift-auto-close'
import { normalizePermissions } from '@/lib/catha-permissions-model'

const CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0'
const CASHIER_MY_SHIFT_MIN_PERMS = { view: true, add: false, edit: false, delete: false } as const

function hasValidMyShiftViewPermission(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return obj.view === true
}

/**
 * Returns current Catha user (V2) from session: role, status, permissions.
 * Used by sidebar to filter nav items. SUPER_ADMIN => all routes.
 */
export async function GET() {
  const headers = new Headers()
  headers.set('Cache-Control', CACHE_CONTROL)
  headers.set('Pragma', 'no-cache')

  try {
    await runFirstRequestBacklogSweep().catch((error: any) => {
      console.error('[shift-auto-close] first-request auth sweep failed', error?.message || error)
    })
    const session = await getCathaSession()
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401, headers })
    }

    const user = await getCathaUserByEmail(session.user.email)
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'deleted' }, { status: 404, headers })
    }

    const role = (user.role ?? 'PENDING').toUpperCase()
    const status = (user.status ?? 'PENDING').toUpperCase()
    const permissions = normalizePermissions(user.permissions ?? {})
    if (role === 'CASHIER' && !hasValidMyShiftViewPermission(permissions.myShift)) {
      permissions.myShift = { ...CASHIER_MY_SHIFT_MIN_PERMS }
    }
    const superAdmin = role === 'SUPER_ADMIN'
    const allowedRoutes = buildAllowedRoutes(permissions, superAdmin)

    // On auth bootstrap, enforce overdue auto-close for the current user.
    await autoCloseOverdueShiftForUser(user._id?.toString() || '')

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user._id?.toString(),
          email: user.email,
          name: user.name,
          role,
          status,
          permissions,
          allowedRoutes,
        },
      },
      { headers }
    )
  } catch (e: any) {
    console.error('[API /api/catha/auth/me] Error:', e?.message)
    return NextResponse.json(
      { ok: false, reason: 'error', error: 'Failed to fetch user' },
      { status: 500, headers }
    )
  }
}
