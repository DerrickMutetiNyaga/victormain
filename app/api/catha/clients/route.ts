import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'
import { normalizeKenyaPhone } from '@/lib/phone-utils'

const DB_NAME = 'infusion_jaba'
const CLIENTS_META_COLLECTION = 'catha_clients'

export const runtime = 'nodejs'

export async function GET() {
  const { allowed, response } = await requireCathaPermission('management.clients', 'view')
  if (!allowed && response) return response

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)

    // Orders with customerPhone set at checkout (POS / Orders — STK prompt field, not M-Pesa callback payer id).
    // Visits = pending + completed (excl. cancelled); spend = completed orders only.
    const rawGroups = await db
      .collection('orders')
      .aggregate<{
        _id: string
        phone: string
        names: (string | null)[]
        visits: number
        spend: number
        lastOrderAt: Date | null
      }>([
        {
          $match: {
            status: { $nin: ['cancelled', 'voided', 'deleted'] },
            customerPhone: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $addFields: {
            trimmedPhone: { $trim: { input: { $toString: '$customerPhone' } } },
          },
        },
        { $match: { trimmedPhone: { $ne: '' } } },
        {
          $group: {
            _id: '$trimmedPhone',
            phone: { $first: '$trimmedPhone' },
            names: { $push: '$customerName' },
            visits: { $sum: 1 },
            spend: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  { $toDouble: { $ifNull: ['$total', 0] } },
                  0,
                ],
              },
            },
            lastOrderAt: { $max: '$timestamp' },
          },
        },
      ])
      .toArray()

    function pickDisplayName(names: (string | null)[]): string | null {
      const cleaned = names
        .map((n) => (typeof n === 'string' ? n.trim() : ''))
        .filter(Boolean)
      if (cleaned.length === 0) return null
      const longest = cleaned.reduce((a, b) => (b.length > a.length ? b : a), cleaned[0])
      return longest || null
    }

    const merged = new Map<
      string,
      { phone: string; name: string | null; visits: number; spend: number; lastOrderAt: Date | null }
    >()
    for (const row of rawGroups) {
      const normalizedKey = normalizeKenyaPhone(row.phone) || row.phone
      const name = pickDisplayName(row.names || [])
      const cur = merged.get(normalizedKey)
      if (!cur) {
        merged.set(normalizedKey, {
          phone: normalizedKey,
          name,
          visits: row.visits,
          spend: row.spend,
          lastOrderAt: row.lastOrderAt,
        })
      } else {
        cur.visits += row.visits
        cur.spend += row.spend
        if (!cur.name && name) cur.name = name
        else if (name && name.length > (cur.name?.length ?? 0)) cur.name = name
        const a = cur.lastOrderAt
        const b = row.lastOrderAt
        if (b && (!a || b > a)) cur.lastOrderAt = b
      }
    }

    const ordersAgg = Array.from(merged.values()).sort((a, b) => b.spend - a.spend)

    const phones = ordersAgg.map((o) => o.phone)
    const phoneQueryVariants = new Set<string>(phones)
    for (const p of phones) {
      const m = /^\+254(\d{9})$/.exec(p)
      if (m) phoneQueryVariants.add(`0${m[1]}`)
      const m2 = /^0(\d{9})$/.exec(p)
      if (m2) phoneQueryVariants.add(`+254${m2[1]}`)
    }

    const metaDocs = await db
      .collection(CLIENTS_META_COLLECTION)
      .find({ phone: { $in: [...phoneQueryVariants] } })
      .toArray()

    const metaByPhone = new Map<string, any>()
    metaDocs.forEach((m: any) => {
      const k = normalizeKenyaPhone(m.phone) || String(m.phone || '').trim()
      if (k) metaByPhone.set(k, { ...m, phone: k })
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
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const phone = normalizeKenyaPhone(rawPhone) || rawPhone
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
      { $or: [{ phone }, { phone: rawPhone }] },
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
    const raw = (searchParams.get('phone') || '').trim()
    const phone = normalizeKenyaPhone(raw) || raw
    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DB_NAME)

    // Soft-delete: mark hidden so it no longer appears, but keep history
    await db.collection(CLIENTS_META_COLLECTION).updateOne(
      { $or: [{ phone }, { phone: raw }] },
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

