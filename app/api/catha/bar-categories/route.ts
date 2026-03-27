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
      .collection('bar_categories')
      .find({})
      .sort({ name: 1 })
      .toArray()

    const categories = docs.map((doc: any) => ({
      id: doc.code || doc._id.toString(),
      name: doc.name || '',
      icon: doc.icon || '📦',
      color: doc.color || '#CCCCCC',
    }))

    return NextResponse.json({ success: true, categories })
  } catch (error: any) {
    console.error('[Bar Categories API] ❌ Error fetching categories:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bar categories', details: error.message || String(error) },
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
    const name = String(body.name || '').trim()
    const icon = String(body.icon || '').trim() || '📦'
    const color = String(body.color || '').trim() || '#CCCCCC'

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const code =
      String(body.code || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-') || name.toLowerCase().replace(/\s+/g, '-')

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection('bar_categories').findOne({ code })
    if (existing) {
      return NextResponse.json(
        { error: 'Category with this code already exists' },
        { status: 400 },
      )
    }

    const now = new Date()
    const doc = {
      code,
      name,
      icon,
      color,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('bar_categories').insertOne(doc)

    return NextResponse.json(
      {
        success: true,
        category: {
          id: code,
          name,
          icon,
          color,
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error('[Bar Categories API] ❌ Error creating category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create bar category', details: error.message || String(error) },
      { status: 500 },
    )
  }
}

