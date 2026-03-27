/**
 * Server-side API permission enforcement for Jaba routes.
 * Returns 401/403 response if user is not allowed to perform the action.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { canView, canAction, type PermissionKey } from '@/lib/jaba-permissions'

export type ActionType = 'view' | 'add' | 'edit' | 'delete'

export async function requireJabaAction(
  permissionKey: PermissionKey,
  action: ActionType
): Promise<{ authorized: true; userId: string } | { response: NextResponse }> {
  const session = await auth()

  if (!session?.user?.email) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = await getUserByEmail(session.user.email)
  if (!user) {
    return { response: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }

  const userForPerms = {
    role: user.role ?? 'pending',
    status: user.status ?? 'active',
    approved:
      user.role === 'super_admin' ||
      user.role === 'cashier_admin' ||
      user.role === 'manager_admin' ||
      (user.approved ?? false),
    permissions: user.permissions ?? {},
  }

  if (userForPerms.status === 'inactive') {
    return { response: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  }

  if (action === 'view') {
    if (!canView(permissionKey, userForPerms)) {
      return { response: NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 }) }
    }
  } else {
    const actionKey = action === 'add' ? 'add' : action === 'edit' ? 'edit' : 'delete'
    if (!canAction(permissionKey, actionKey, userForPerms)) {
      return { response: NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 }) }
    }
  }

  return { authorized: true, userId: user._id?.toString() ?? session.user.id ?? '' }
}
