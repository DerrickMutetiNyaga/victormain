import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireSuperAdminApi } from '@/lib/catha-auth'

// One-time endpoint to make a user super_admin by email. SUPER_ADMIN only.
export async function POST(request: NextRequest) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const usersCollection = db.collection('bar_users')

    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() })

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User with email ${email} not found in bar_users collection` },
        { status: 404 }
      )
    }

    // Update user to super_admin
    const result = await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          role: 'super_admin',
          approved: true
        }
      }
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'User was already super_admin',
        user: {
          _id: user._id?.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          approved: user.approved,
        }
      })
    }

    // Get updated user
    const updatedUser = await usersCollection.findOne({ _id: user._id })

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${user.email} to super_admin`,
      user: {
        _id: updatedUser?._id?.toString(),
        name: updatedUser?.name,
        email: updatedUser?.email,
        role: updatedUser?.role,
        approved: updatedUser?.approved,
      }
    })
  } catch (error) {
    console.error('[API] Error making user super admin:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update user', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

