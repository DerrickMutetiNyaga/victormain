import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getAllUsers } from '@/lib/models/user'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super_admin can view and manage users (assign permissions, approve pending)
    if (session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

