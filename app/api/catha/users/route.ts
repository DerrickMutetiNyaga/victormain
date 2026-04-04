import { NextResponse } from 'next/server'
import { requireSuperAdminApi } from '@/lib/catha-auth'
import { getAllCathaUsers, updateCathaUser, type CathaUserRole, type CathaUserStatus } from '@/lib/models/catha-user'
import { CathaPermissions, normalizePermissions } from '@/lib/catha-permissions-model'

const VALID_ROLES: CathaUserRole[] = ['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'PENDING']
const VALID_STATUSES: CathaUserStatus[] = ['ACTIVE', 'PENDING', 'DISABLED']

function formatUser(u: Awaited<ReturnType<typeof getAllCathaUsers>>[0]) {
  return {
    id: u._id?.toString(),
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: u.role,
    status: u.status,
    permissions: u.permissions ?? {},
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
    lastLogin: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin.toISOString() : u.lastLogin) : null,
  }
}

export async function GET() {
  const [session, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const users = await getAllCathaUsers()
    return NextResponse.json({ success: true, users: users.map(formatUser) })
  } catch (e: any) {
    console.error('[catha/users] GET error:', e?.message)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const [session, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!email) return NextResponse.json({ success: false, error: 'email required' }, { status: 400 })

    const updates: Parameters<typeof updateCathaUser>[1] = {}
    if (VALID_STATUSES.includes(body.status)) updates.status = body.status
    if (VALID_ROLES.includes(body.role)) updates.role = body.role
    if (body.permissions && typeof body.permissions === 'object') {
      updates.permissions = normalizePermissions(body.permissions as CathaPermissions)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid updates (status, role, or permissions)' }, { status: 400 })
    }

    const user = await updateCathaUser(email, updates)
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user: formatUser(user) })
  } catch (e: any) {
    console.error('[catha/users] PATCH error:', e?.message)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}
