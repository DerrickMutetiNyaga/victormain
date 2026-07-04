import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import {
  POS_SPEND_PROMOTIONS_COLLECTION,
  ensureSpendPromotionIndexes,
  serializeSpendPromotion,
  mapSpendPromotionRow,
  isSpendPromotionEffectivelyActive,
} from '@/lib/pos-spend-promotions'
import {
  logPosDiscountAudit,
  normalizeEligibleCustomerIds,
  validateDiscountInput,
  type PosDiscountStatus,
  type PosDiscountType,
} from '@/lib/pos-product-discounts'
import { canManagePosDiscounts, canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

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
    await ensureSpendPromotionIndexes(db)
    const now = new Date()
    const rows = await db
      .collection(POS_SPEND_PROMOTIONS_COLLECTION)
      .find({})
      .sort({ priority: -1, updatedAt: -1 })
      .toArray()

    const spendPromotions = rows.map((row) => {
      const mapped = mapSpendPromotionRow(row)
      return {
        ...serializeSpendPromotion(row),
        effectivelyActive: isSpendPromotionEffectivelyActive(mapped, now),
      }
    })

    return NextResponse.json({ success: true, spendPromotions })
  } catch (error: unknown) {
    console.error('[Spend Promotions API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch spend promotions' }, { status: 500 })
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
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Promotion name required' }, { status: 400 })

    const threshold = Number(body?.threshold ?? 0)
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return NextResponse.json({ error: 'Invalid spend threshold' }, { status: 400 })
    }

    const discountType = body?.discountType as PosDiscountType
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }

    const discountValue = Number(body?.discountValue ?? 0)
    const validated = validateDiscountInput(discountType, discountValue, threshold)
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureSpendPromotionIndexes(db)

    const status = (body?.status as PosDiscountStatus) || 'inactive'
    const doc = {
      name,
      status: status === 'active' ? 'active' : 'inactive',
      startAt: body?.startAt ? new Date(body.startAt) : null,
      endAt: body?.endAt ? new Date(body.endAt) : null,
      threshold,
      discountType,
      discountValue,
      priority: Number.isFinite(Number(body?.priority)) ? Number(body.priority) : 0,
      campaignId: body?.campaignId != null ? String(body.campaignId) : null,
      eligibilityScope: body?.eligibilityScope || 'everyone',
      eligibleCustomers: normalizeEligibleCustomerIds(body?.eligibleCustomers),
      createdBy: actor.email,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).insertOne(doc)
    await logPosDiscountAudit(db, {
      action: 'spend_promo_created',
      targetType: 'spend_promotion',
      targetId: String(result.insertedId),
      targetName: name,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { threshold, discountType, discountValue },
    })

    const saved = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).findOne({ _id: result.insertedId })
    return NextResponse.json({
      success: true,
      spendPromotion: saved ? serializeSpendPromotion(saved) : null,
    })
  } catch (error: unknown) {
    console.error('[Spend Promotions API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create spend promotion' }, { status: 500 })
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
    const id = String(body?.id ?? '')
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Valid promotion id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Spend promotion not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updatedAt: now }
    if (body?.name != null) updates.name = String(body.name).trim()
    if (body?.status != null) updates.status = body.status === 'active' ? 'active' : 'inactive'
    if (body?.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null
    if (body?.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null
    if (body?.threshold != null) updates.threshold = Number(body.threshold)
    if (body?.discountType != null) updates.discountType = body.discountType
    if (body?.discountValue != null) updates.discountValue = Number(body.discountValue)
    if (body?.priority != null) updates.priority = Number(body.priority)
    if (body?.campaignId !== undefined) updates.campaignId = body.campaignId != null ? String(body.campaignId) : null
    if (body?.eligibilityScope != null) updates.eligibilityScope = body.eligibilityScope
    if (body?.eligibleCustomers != null) {
      updates.eligibleCustomers = normalizeEligibleCustomerIds(body.eligibleCustomers)
    }

    await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: updates })

    await logPosDiscountAudit(db, {
      action: 'spend_promo_updated',
      targetType: 'spend_promotion',
      targetId: id,
      targetName: String(updates.name ?? existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
      details: updates,
    })

    const doc = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    return NextResponse.json({
      success: true,
      spendPromotion: doc ? serializeSpendPromotion(doc) : null,
    })
  } catch (error: unknown) {
    console.error('[Spend Promotions API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update spend promotion' }, { status: 500 })
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
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Valid promotion id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Spend promotion not found' }, { status: 404 })

    await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).deleteOne({ _id: new ObjectId(id) })
    await logPosDiscountAudit(db, {
      action: 'spend_promo_deleted',
      targetType: 'spend_promotion',
      targetId: id,
      targetName: String(existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Spend Promotions API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete spend promotion' }, { status: 500 })
  }
}
