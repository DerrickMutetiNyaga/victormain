import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { MongoServerError } from 'mongodb'
import { requireSuperAdminApi } from '@/lib/catha-auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { computePinLookup } from '@/lib/catha-pin'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_users'

/** POST /api/catha/users/[id]/set-pin - Set, reset, or remove cashier PIN. SUPER_ADMIN only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err

  const { id } = await params
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: 'Invalid user id' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const rawPin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    const client = await clientPromise
    const col = client.db(DB_NAME).collection(COLLECTION)

    const user = await col.findOne({ _id: new ObjectId(id) })
    if (!user) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

    const role = String(user.role ?? '').toUpperCase()
    const status = String(user.status ?? '').toUpperCase()

    if (role !== 'CASHIER') {
      return NextResponse.json({ ok: false, error: 'Only CASHIER users can have a PIN' }, { status: 400 })
    }
    if (status !== 'ACTIVE') {
      return NextResponse.json({ ok: false, error: 'User must be ACTIVE to set PIN' }, { status: 400 })
    }

    // Remove PIN if empty string explicitly sent
    if (rawPin === '') {
      await col.updateOne(
        { _id: new ObjectId(id) },
        {
          $unset: { pinHash: '', pinLookup: '', pinFailedAttempts: '', pinLockedUntil: '' },
          $set: { updatedAt: new Date() },
        }
      )
      return NextResponse.json({ ok: true })
    }

    if (!/^\d{4}$/.test(rawPin)) {
      return NextResponse.json({ ok: false, error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    const pinHash = await bcrypt.hash(rawPin, 10)
    const pinLookup = computePinLookup(rawPin)

    try {
      await col.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            pinHash,
            pinLookup,
            pinFailedAttempts: 0,
            pinLockedUntil: null,
            updatedAt: new Date(),
          },
        }
      )
    } catch (e: any) {
      if (e instanceof MongoServerError && e.code === 11000 && e.keyPattern?.pinLookup) {
        return NextResponse.json(
          { ok: false, error: 'This PIN is already in use' },
          { status: 409 }
        )
      }
      throw e
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[catha/users/[id]/set-pin] Error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to set PIN' }, { status: 500 })
  }
}
