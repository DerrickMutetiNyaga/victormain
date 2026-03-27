import { NextResponse } from 'next/server'
import { updateCathaStaffUser, deleteCathaStaffUser } from '@/lib/models/catha-staff-user'
import { requireSuperAdminApi } from '@/lib/catha-auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string') updates.name = body.name
    if (typeof body.username === 'string') updates.username = body.username
    if (typeof body.email === 'string') updates.email = body.email
    if (['admin', 'manager', 'cashier', 'waiter'].includes(body.role)) updates.role = body.role
    if (['active', 'inactive'].includes(body.status)) updates.status = body.status
    if (body.permissions && typeof body.permissions === 'object') updates.permissions = body.permissions
    const user = await updateCathaStaffUser(id, updates)
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      user: {
        ...user,
        createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
        lastLogin: user.lastLogin?.toISOString?.() ?? user.lastLogin,
      },
    })
  } catch (error) {
    console.error('[catha/staff-users] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const { id } = await params
    const ok = await deleteCathaStaffUser(id)
    if (!ok) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[catha/staff-users] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 })
  }
}
