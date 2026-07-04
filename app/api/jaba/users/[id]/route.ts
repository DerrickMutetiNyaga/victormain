import { NextRequest, NextResponse } from 'next/server'
import { deleteUser } from '@/lib/models/user'
import { requireDeleteOtp } from '@/lib/jaba-delete-otp-guard'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = await requireJabaSuperAdminDb()
    if ('response' in authz) return authz.response

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    const otpCheck = await requireDeleteOtp(request, 'delete_user', id)
    if ('response' in otpCheck) return otpCheck.response

    const deleted = await deleteUser(id)

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
