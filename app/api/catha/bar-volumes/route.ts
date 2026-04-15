import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const docs = await db
      .collection('bar_volumes')
      .find({})
      .sort({ sortOrder: 1, value: 1 })
      .toArray()

    const volumes = docs.map((doc: any) => ({
      id: doc._id.toString(),
      value: doc.value || '',
    }))

    return NextResponse.json({ success: true, volumes })
  } catch (error: any) {
    console.error('[Bar Volumes API] ❌ Error fetching volumes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch volume options', details: error.message || String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'add')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    let value = String(body.value || '').trim()

    if (!value) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }

    // If the client passes a plain number with no unit, default to ml
    if (/^\d+(\.\d+)?$/.test(value)) {
      value = `${value}ml`
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection('bar_volumes').findOne({ value })
    if (existing) {
      return NextResponse.json(
        { error: 'Volume option already exists' },
        { status: 400 },
      )
    }

    const now = new Date()
    const doc = {
      value,
      sortOrder: Number(body.sortOrder ?? 999),
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('bar_volumes').insertOne(doc)

    return NextResponse.json(
      {
        success: true,
        volume: {
          id: result.insertedId.toString(),
          value,
        },
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error('[Bar Volumes API] ❌ Error creating volume:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create volume option', details: error.message || String(error) },
      { status: 500 },
    )
  }
}

