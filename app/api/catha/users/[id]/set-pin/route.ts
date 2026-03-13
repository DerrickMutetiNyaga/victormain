import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireSuperAdminApi } from '@/lib/catha-auth'
import { getBarUserById, updateBarUserPinFields } from '@/lib/models/bar-user'

/** POST /api/catha/users/[id]/set-pin - Set or reset cashier PIN. SUPER_ADMIN only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err

  const { id } = await params
  try {
    const body = await request.json()
    const pin = body?.pin

    if (typeof pin !== 'string') {
      return NextResponse.json({ ok: false, error: 'PIN required' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    const user = await getBarUserById(id)
    if (!user) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

    if (user.role !== 'cashier_admin') {
      return NextResponse.json({ ok: false, error: 'Only cashiers can have a PIN' }, { status: 400 })
    }
    if (user.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'User must be active to set PIN' }, { status: 400 })
    }

    const hash = await bcrypt.hash(pin, 10)
    const now = new Date()

    let cashierCode = user.cashierCode
    if (!cashierCode) {
      const client = await (await import('@/lib/mongodb')).default
      const db = client.db('infusion_jaba')
      const maxCode = await db
        .collection('bar_users')
        .aggregate<{ maxNum: number }>([
          { $match: { cashierCode: { $regex: /^CSH-\d+$/ } } },
          { $project: { num: { $toInt: { $arrayElemAt: [{ $split: ['$cashierCode', '-'] }, 1] } } } },
          { $group: { _id: null, maxNum: { $max: '$num' } } },
        ])
        .toArray()
      const nextNum = (maxCode[0]?.maxNum ?? 0) + 1
      cashierCode = `CSH-${String(nextNum).padStart(4, '0')}`
    }

    await updateBarUserPinFields(id, {
      cashierPinHash: hash,
      cashierPinSetAt: now,
      cashierPinFailedAttempts: 0,
      cashierPinLockedUntil: null,
      cashierCode,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[catha/users/[id]/set-pin] Error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to set PIN' }, { status: 500 })
  }
}
