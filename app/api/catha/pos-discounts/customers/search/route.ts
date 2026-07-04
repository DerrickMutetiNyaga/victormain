import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { canManagePosDiscounts } from '@/lib/pos-discount-permissions'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { normalizeCustomerIdForEligibility } from '@/lib/pos-product-discounts'

export const runtime = 'nodejs'

const DB_NAME = 'infusion_jaba'
const CLIENTS_META_COLLECTION = 'catha_clients'
const MAX_RESULTS = 25

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get('q') ?? '').trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, customers: [] })
  }

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const regex = new RegExp(escapeRegex(q), 'i')
    const normalizedQueryPhone = normalizeKenyaPhone(q)

    const metaMatches = await db
      .collection(CLIENTS_META_COLLECTION)
      .find({
        hidden: { $ne: true },
        $or: [
          { name: regex },
          { phone: regex },
          { email: regex },
          { customerCode: regex },
          ...(normalizedQueryPhone ? [{ phone: normalizedQueryPhone }] : []),
        ],
      })
      .limit(MAX_RESULTS)
      .project({ phone: 1, name: 1, email: 1, customerCode: 1 })
      .toArray()

    const orderMatches = await db
      .collection('orders')
      .aggregate<{
        phone: string
        name: string | null
      }>([
        {
          $match: {
            status: { $nin: ['cancelled', 'voided', 'deleted'] },
            $or: [
              { customerName: regex },
              { customerPhone: regex },
              ...(normalizedQueryPhone ? [{ customerPhone: normalizedQueryPhone }] : []),
            ],
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
          },
        },
        { $limit: MAX_RESULTS },
        {
          $project: {
            phone: 1,
            name: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$names',
                    as: 'n',
                    cond: { $and: [{ $ne: ['$$n', null] }, { $ne: ['$$n', ''] }] },
                  },
                },
                0,
              ],
            },
          },
        },
      ])
      .toArray()

    const byId = new Map<
      string,
      { id: string; name: string; phone: string; email: string | null; customerCode: string | null }
    >()

    for (const doc of metaMatches) {
      const id = normalizeCustomerIdForEligibility(String(doc.phone))
      if (!id) continue
      byId.set(id, {
        id,
        name: String(doc.name || id),
        phone: id,
        email: doc.email != null ? String(doc.email) : null,
        customerCode: doc.customerCode != null ? String(doc.customerCode) : null,
      })
    }

    for (const row of orderMatches) {
      const id = normalizeCustomerIdForEligibility(row.phone)
      if (!id || byId.has(id)) continue
      byId.set(id, {
        id,
        name: row.name ? String(row.name) : id,
        phone: id,
        email: null,
        customerCode: null,
      })
    }

    const customers = [...byId.values()]
      .filter((c) => {
        const haystack = [c.name, c.phone, c.email, c.customerCode].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q.toLowerCase()) || regex.test(c.name) || regex.test(c.phone)
      })
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ success: true, customers })
  } catch (error: unknown) {
    console.error('[POS discount customer search] error:', error)
    return NextResponse.json({ error: 'Customer search failed' }, { status: 500 })
  }
}
