import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'
import { updateUserPermissions } from '@/lib/models/user'
import { sanitizeJabaPermissionsPayload } from '@/lib/jaba-permissions-sanitize'
import { logAuthSecurityEvent } from '@/lib/auth-security-audit'
import { getClientIp } from '@/lib/rate-limit-simple'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = await requireJabaSuperAdminDb()
    if ('response' in authz) return authz.response

    const session = await auth()

    const { id } = await params
    const raw = await request.json().catch(() => null)
    const parsed = sanitizeJabaPermissionsPayload(raw)
    if (!parsed.ok) {
      logAuthSecurityEvent({
        route: '/api/jaba/users/[id]/permissions',
        action: 'PATCH',
        result: 'rejected',
        reason: parsed.error,
        identifier: (session.user as { id?: string }).id ?? session.user.email ?? undefined,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json({ error: 'Invalid permissions' }, { status: 400 })
    }

    const updatedUser = await updateUserPermissions(id, parsed.permissions)
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    logAuthSecurityEvent({
      route: '/api/jaba/users/[id]/permissions',
      action: 'PATCH',
      result: 'success',
      identifier: `${(session.user as { id?: string }).id ?? session.user.email ?? 'admin'}→${id}`,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      ...updatedUser,
      _id: updatedUser._id?.toString(),
    })
  } catch (error) {
    console.error('[API] Error updating user permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update user permissions' },
      { status: 500 }
    )
  }
}

