import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import {
  POS_PROMO_CODES_COLLECTION,
  ensurePromoCodeIndexes,
  serializePromoCode,
  mapPromoCodeRow,
  normalizePromoCode,
  isPromoCodeEffectivelyActive,
} from '@/lib/pos-promo-codes'
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
    await ensurePromoCodeIndexes(db)
    const now = new Date()
    const rows = await db
      .collection(POS_PROMO_CODES_COLLECTION)
      .find({})
      .sort({ updatedAt: -1 })
      .toArray()

    const coupons = rows.map((row) => {
      const mapped = mapPromoCodeRow(row)
      return {
        ...serializePromoCode(row),
        effectivelyActive: isPromoCodeEffectivelyActive(mapped, now),
      }
    })

    return NextResponse.json({ success: true, coupons })
  } catch (error: unknown) {
    console.error('[Coupons API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
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
    const code = normalizePromoCode(String(body?.code ?? ''))
    if (!code) return NextResponse.json({ error: 'Promo code required' }, { status: 400 })

    const discountType = body?.discountType as PosDiscountType
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }

    const discountValue = Number(body?.discountValue ?? 0)
    const validated = validateDiscountInput(discountType, discountValue, 10000)
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePromoCodeIndexes(db)

    const existing = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ code })
    if (existing) return NextResponse.json({ error: 'Code already exists' }, { status: 409 })

    const status = (body?.status as PosDiscountStatus) || 'inactive'
    const doc = {
      code,
      label: body?.label != null ? String(body.label).trim() || null : null,
      discountType,
      discountValue,
      status: status === 'active' ? 'active' : 'inactive',
      startAt: body?.startAt ? new Date(body.startAt) : null,
      endAt: body?.endAt ? new Date(body.endAt) : null,
      minSpend: body?.minSpend != null ? Number(body.minSpend) : 0,
      maxRedemptions: body?.maxRedemptions != null ? Number(body.maxRedemptions) : null,
      redemptionCount: 0,
      singleUsePerCustomer: body?.singleUsePerCustomer === true,
      eligibilityScope: body?.eligibilityScope || 'everyone',
      eligibleCustomers: normalizeEligibleCustomerIds(body?.eligibleCustomers),
      eligibleProductIds: Array.isArray(body?.eligibleProductIds)
        ? body.eligibleProductIds.map(String)
        : [],
      eligibleCategories: Array.isArray(body?.eligibleCategories)
        ? body.eligibleCategories.map((c: string) => String(c).toLowerCase())
        : [],
      campaignId: body?.campaignId != null ? String(body.campaignId) : null,
      createdBy: actor.email,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection(POS_PROMO_CODES_COLLECTION).insertOne(doc)
    await logPosDiscountAudit(db, {
      action: 'coupon_created',
      targetType: 'coupon',
      targetId: String(result.insertedId),
      targetName: code,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { discountType, discountValue, status: doc.status },
    })

    const saved = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ _id: result.insertedId })
    return NextResponse.json({ success: true, coupon: saved ? serializePromoCode(saved) : null })
  } catch (error: unknown) {
    console.error('[Coupons API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid coupon id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updatedAt: now }
    if (body?.label != null) updates.label = String(body.label).trim() || null
    if (body?.discountType != null) updates.discountType = body.discountType
    if (body?.discountValue != null) updates.discountValue = Number(body.discountValue)
    if (body?.status != null) updates.status = body.status === 'active' ? 'active' : 'inactive'
    if (body?.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null
    if (body?.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null
    if (body?.minSpend != null) updates.minSpend = Number(body.minSpend)
    if (body?.maxRedemptions !== undefined) {
      updates.maxRedemptions = body.maxRedemptions != null ? Number(body.maxRedemptions) : null
    }
    if (body?.singleUsePerCustomer != null) {
      updates.singleUsePerCustomer = body.singleUsePerCustomer === true
    }
    if (body?.eligibilityScope != null) updates.eligibilityScope = body.eligibilityScope
    if (body?.eligibleCustomers != null) {
      updates.eligibleCustomers = normalizeEligibleCustomerIds(body.eligibleCustomers)
    }
    if (body?.eligibleProductIds != null) {
      updates.eligibleProductIds = body.eligibleProductIds.map(String)
    }
    if (body?.eligibleCategories != null) {
      updates.eligibleCategories = body.eligibleCategories.map((c: string) => String(c).toLowerCase())
    }
    if (body?.campaignId !== undefined) {
      updates.campaignId = body.campaignId != null ? String(body.campaignId) : null
    }

    await db.collection(POS_PROMO_CODES_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: updates })

    await logPosDiscountAudit(db, {
      action: 'coupon_updated',
      targetType: 'coupon',
      targetId: id,
      targetName: String(existing.code),
      actorEmail: actor.email,
      actorName: actor.name,
      details: updates,
    })

    const doc = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ success: true, coupon: doc ? serializePromoCode(doc) : null })
  } catch (error: unknown) {
    console.error('[Coupons API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid coupon id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })

    await db.collection(POS_PROMO_CODES_COLLECTION).deleteOne({ _id: new ObjectId(id) })
    await logPosDiscountAudit(db, {
      action: 'coupon_deleted',
      targetType: 'coupon',
      targetId: id,
      targetName: String(existing.code),
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Coupons API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
