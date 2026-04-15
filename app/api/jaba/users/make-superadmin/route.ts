import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// One-time endpoint to make all users super_admin
// This should be removed or secured after use
export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const usersCollection = db.collection('jaba_users')

    // Update all users to super_admin
    const result = await usersCollection.updateMany(
      {},
      { $set: { role: 'super_admin' } }
    )

    // Get updated users
    const updatedUsers = await usersCollection.find({}).toArray()

    return NextResponse.json({
      success: true,
      message: `Updated ${result.modifiedCount} user(s) to super_admin`,
      users: updatedUsers.map(user => ({
        _id: user._id?.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      })),
    })
  } catch (error) {
    console.error('[API] Error making users super admin:', error)
    return NextResponse.json(
      { error: 'Failed to update users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

