import { NextRequest, NextResponse } from 'next/server'
import { updateUserRole } from '@/lib/models/user'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = await requireJabaSuperAdminDb()
    if ('response' in authz) return authz.response

    const { id } = await params
    const { role } = await request.json()
    
    if (!role || !['pending', 'cashier_admin', 'manager_admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const updatedUser = await updateUserRole(id, role)
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...updatedUser,
      _id: updatedUser._id?.toString(),
    })
  } catch (error) {
    console.error('[API] Error updating user role:', error)
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    )
  }
}

