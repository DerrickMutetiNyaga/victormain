import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

const DB_NAME = 'infusion_jaba'
const CLIENTS_META_COLLECTION = 'catha_clients'

export const runtime = 'nodejs'

export async function GET() {
  const { allowed, response } = await requireCathaPermission('management.clients', 'view')
  if (!allowed && response) return response

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)

    // Aggregate completed orders by customerPhone
    const ordersAgg = await db
      .collection('orders')
      .aggregate<{
        _id: string
        phone: string
        name: string | null
        visits: number
        spend: number
        lastOrderAt: Date | null
      }>([
        { $match: { status: 'completed', customerPhone: { $exists: true, $ne: null, $ne: '' } } },
        {
          $group: {
            _id: '$customerPhone',
            phone: { $first: '$customerPhone' },
            name: { $first: '$customerName' },
            visits: { $sum: 1 },
            spend: { $sum: '$total' },
            lastOrderAt: { $max: '$timestamp' },
          },
        },
        { $sort: { spend: -1 } },
      ])
      .toArray()

    const phones = ordersAgg.map((o) => o.phone)

    // Fetch meta (custom name/status/hidden) for these phones
    const metaDocs = await db
      .collection(CLIENTS_META_COLLECTION)
      .find({ phone: { $in: phones } })
      .toArray()

    const metaByPhone = new Map<string, any>()
    metaDocs.forEach((m: any) => {
      metaByPhone.set(m.phone, m)
    })

    const clients = ordersAgg
      .map((o) => {
        const meta = metaByPhone.get(o.phone) || {}
        if (meta.hidden) return null
        return {
          phone: o.phone,
          name: meta.name || o.name || o.phone,
          visits: o.visits,
          spend: o.spend,
          status: meta.status || 'Active',
          lastOrderAt: o.lastOrderAt ? (o.lastOrderAt instanceof Date ? o.lastOrderAt.toISOString() : o.lastOrderAt) : null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ success: true, clients })
  } catch (error: any) {
    console.error('[catha/clients] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { allowed, response } = await requireCathaPermission('management.clients', 'edit')
  if (!allowed && response) return response

  try {
    const body = await request.json()
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string') updates.name = body.name.trim()
    if (typeof body.status === 'string') updates.status = body.status.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid updates' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DB_NAME)

    await db.collection(CLIENTS_META_COLLECTION).updateOne(
      { phone },
      {
        $set: {
          phone,
          ...updates,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[catha/clients] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { allowed, response } = await requireCathaPermission('management.clients', 'delete')
  if (!allowed && response) return response

  try {
    const { searchParams } = new URL(request.url)
    const phone = (searchParams.get('phone') || '').trim()
    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DB_NAME)

    // Soft-delete: mark hidden so it no longer appears, but keep history
    await db.collection(CLIENTS_META_COLLECTION).updateOne(
      { phone },
      {
        $set: {
          phone,
          hidden: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[catha/clients] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete client' }, { status: 500 })
  }
}

