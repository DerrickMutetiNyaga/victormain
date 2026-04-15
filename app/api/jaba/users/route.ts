import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/models/user'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'

export async function GET(request: NextRequest) {
  try {
    const authz = await requireJabaSuperAdminDb()
    if ('response' in authz) return authz.response

    const users = await getAllUsers()
    
    // Convert ObjectId to string for JSON serialization
    const usersWithStringIds = users.map(user => ({
      ...user,
      _id: user._id?.toString(),
    }))

    return NextResponse.json(usersWithStringIds)
  } catch (error) {
    console.error('[API] Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

