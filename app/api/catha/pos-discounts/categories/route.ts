import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import {
  POS_CATEGORY_DISCOUNTS_COLLECTION,
  ensurePosDiscountIndexes,
  serializeCategoryDiscount,
  validateDiscountInput,
  buildDiscountDocFields,
  logPosDiscountAudit,
  isDiscountEffectivelyActive,
  diffEligibleCustomers,
  normalizeEligibleCustomerIds,
  type CategoryDiscountInputPayload,
  type PosDiscountStatus,
} from '@/lib/pos-product-discounts'
import { canManagePosDiscounts, canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'
import { ObjectId } from 'mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import type { Db } from 'mongodb'

const CLIENTS_META_COLLECTION = 'catha_clients'

async function resolveCustomerDisplayNames(
  db: Db,
  customerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (customerIds.length === 0) return map

  const phoneVariants = new Set<string>()
  for (const id of customerIds) {
    phoneVariants.add(id)
    const m = /^\+254(\d{9})$/.exec(id)
    if (m) phoneVariants.add(`0${m[1]}`)
    const m2 = /^0(\d{9})$/.exec(id)
    if (m2) phoneVariants.add(`+254${m2[1]}`)
  }

  const metaDocs = await db
    .collection(CLIENTS_META_COLLECTION)
    .find({ phone: { $in: [...phoneVariants] } })
    .project({ phone: 1, name: 1 })
    .toArray()

  for (const doc of metaDocs) {
    const key = normalizeKenyaPhone(String(doc.phone)) || String(doc.phone)
    if (key && doc.name) map.set(key, String(doc.name))
  }

  for (const id of customerIds) {
    if (!map.has(id)) map.set(id, id)
  }
  return map
}

async function logEligibilityAuditIfChanged(
  db: Db,
  opts: {
    existing: Record<string, unknown> | null
    nextEligible: string[]
    promotionName: string | null
    targetId: string
    targetName: string
    actorEmail: string | null
    actorName: string | null
  }
) {
  const prev = normalizeEligibleCustomerIds(
    opts.existing?.eligibleCustomers as string[] | undefined
  )
  const { added, removed } = diffEligibleCustomers(prev, opts.nextEligible)
  if (added.length === 0 && removed.length === 0) return

  const nameMap = await resolveCustomerDisplayNames(db, [...added, ...removed])
  const promotion = opts.promotionName || opts.targetName

  for (const id of added) {
    await logPosDiscountAudit(db, {
      action: 'eligibility_changed',
      targetType: 'category',
      targetId: opts.targetId,
      targetName: opts.targetName,
      actorEmail: opts.actorEmail,
      actorName: opts.actorName,
      details: {
        change: 'added',
        customerId: id,
        customerName: nameMap.get(id) || id,
        promotionName: promotion,
      },
    })
  }
  for (const id of removed) {
    await logPosDiscountAudit(db, {
      action: 'eligibility_changed',
      targetType: 'category',
      targetId: opts.targetId,
      targetName: opts.targetName,
      actorEmail: opts.actorEmail,
      actorName: opts.actorName,
      details: {
        change: 'removed',
        customerId: id,
        customerName: nameMap.get(id) || id,
        promotionName: promotion,
      },
    })
  }
}

export const runtime = 'nodejs'

const CATEGORY_LABELS: Record<string, string> = {
  whiskey: 'Whiskey',
  vodka: 'Vodka',
  rum: 'Rum',
  gin: 'Gin',
  beer: 'Beer',
  wine: 'Wine',
  cocktails: 'Cocktails',
  'soft-drinks': 'Soft Drinks',
  jaba: 'Jaba',
  other: 'Other',
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } }) {
  return {
    email: String(session.user?.email ?? '') || null,
    name: String(session.user?.name ?? '') || null,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canViewPosDiscountsAdmin(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePosDiscountIndexes(db)
    const now = new Date()

    const rows = await db
      .collection(POS_CATEGORY_DISCOUNTS_COLLECTION)
      .find({})
      .sort({ category: 1 })
      .toArray()

    const categories = await db
      .collection('bar_inventory')
      .distinct('category', { type: 'bar', deleted: { $ne: true } })

    return NextResponse.json({
      success: true,
      categories: (categories as string[])
        .filter(Boolean)
        .sort()
        .map((c) => ({ id: c, label: CATEGORY_LABELS[c] ?? c })),
      discounts: rows.map((d) => ({
        ...serializeCategoryDiscount(d),
        label: CATEGORY_LABELS[String(d.category)] ?? String(d.category),
        effectivelyActive: isDiscountEffectivelyActive(
          { status: d.status as PosDiscountStatus, startAt: d.startAt, endAt: d.endAt },
          now
        ),
      })),
    })
  } catch (error: unknown) {
    console.error('[POS Category Discounts] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch category discounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as CategoryDiscountInputPayload
    const category = String(body.category ?? '')
      .trim()
      .toLowerCase()
    if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 })

    if (body.discountType !== 'percentage' && body.discountType !== 'fixed') {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }

    // Validate against a sample product in category (or arbitrary price 1000)
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePosDiscountIndexes(db)

    const sample = await db.collection('bar_inventory').findOne({
      type: 'bar',
      category,
      deleted: { $ne: true },
      price: { $gt: 0 },
    })
    const samplePrice = sample ? Number(sample.price) : 1000
    const validated = validateDiscountInput(body.discountType, Number(body.discountValue), samplePrice)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const existing = await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).findOne({ category })
    const fields = buildDiscountDocFields(body, actor.email, now)

    const result = await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).findOneAndUpdate(
      { category },
      { $set: { ...fields, category }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: 'after' }
    )

    await logEligibilityAuditIfChanged(db, {
      existing,
      nextEligible: fields.eligibleCustomers,
      promotionName: fields.promotionName,
      targetId: category,
      targetName: CATEGORY_LABELS[category] ?? category,
      actorEmail: actor.email,
      actorName: actor.name,
    })

    await logPosDiscountAudit(db, {
      action: existing ? 'updated' : 'category_applied',
      targetType: 'category',
      targetId: category,
      targetName: CATEGORY_LABELS[category] ?? category,
      actorEmail: actor.email,
      actorName: actor.name,
      details: {
        discountType: body.discountType,
        discountValue: Number(body.discountValue),
        promotionName: fields.promotionName,
      },
    })

    return NextResponse.json({ success: true, discount: result ? serializeCategoryDiscount(result) : null })
  } catch (error: unknown) {
    console.error('[POS Category Discounts] POST error:', error)
    return NextResponse.json({ error: 'Failed to save category discount' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const category = searchParams.get('category')
    const actor = sessionActor(session)

    if (!id && !category) {
      return NextResponse.json({ error: 'id or category required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const filter: Record<string, unknown> = id
      ? ObjectId.isValid(id)
        ? { _id: new ObjectId(id) }
        : { id }
      : { category: String(category).toLowerCase() }

    const existing = await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).findOne(filter)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).deleteOne(filter)

    await logPosDiscountAudit(db, {
      action: 'deleted',
      targetType: 'category',
      targetId: String(existing.category),
      targetName: CATEGORY_LABELS[String(existing.category)] ?? String(existing.category),
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[POS Category Discounts] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const category = String(body?.category ?? '').toLowerCase()
    const status = body?.status === 'inactive' ? 'inactive' : 'active'
    const actor = sessionActor(session)
    const now = new Date()

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).findOne({ category })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).updateOne(
      { category },
      { $set: { status, updatedAt: now } }
    )

    await logPosDiscountAudit(db, {
      action: status === 'inactive' ? 'disabled' : 'enabled',
      targetType: 'category',
      targetId: category,
      targetName: CATEGORY_LABELS[category] ?? category,
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
