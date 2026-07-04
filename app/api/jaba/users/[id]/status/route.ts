import { NextRequest, NextResponse } from 'next/server'
import { updateUserStatus } from '@/lib/models/user'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = await requireJabaSuperAdminDb()
    if ('response' in authz) return authz.response

    const { id } = await params
    const { status } = await request.json()
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const updatedUser = await updateUserStatus(id, status)
    
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
    console.error('[API] Error updating user status:', error)
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    )
  }
}

