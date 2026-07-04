import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import {
  POS_BUNDLE_PROMOTIONS_COLLECTION,
  ensureBundleIndexes,
  serializeBundlePromotion,
  mapBundleRow,
  isBundleEffectivelyActive,
} from '@/lib/pos-bundle-promotions'
import {
  logPosDiscountAudit,
  normalizeEligibleCustomerIds,
  type PosDiscountStatus,
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
    await ensureBundleIndexes(db)
    const now = new Date()
    const rows = await db
      .collection(POS_BUNDLE_PROMOTIONS_COLLECTION)
      .find({})
      .sort({ priority: -1, updatedAt: -1 })
      .toArray()

    const bundles = rows.map((row) => {
      const mapped = mapBundleRow(row)
      return {
        ...serializeBundlePromotion(row),
        effectivelyActive: isBundleEffectivelyActive(mapped, now),
      }
    })

    return NextResponse.json({ success: true, bundles })
  } catch (error: unknown) {
    console.error('[Bundles API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 })
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
    if (!name) return NextResponse.json({ error: 'Bundle name required' }, { status: 400 })

    const productIds = Array.isArray(body?.productIds)
      ? body.productIds.map(String).filter(Boolean)
      : []
    if (productIds.length < 2) {
      return NextResponse.json({ error: 'Select at least 2 products' }, { status: 400 })
    }

    const bundlePrice = Number(body?.bundlePrice ?? 0)
    if (!Number.isFinite(bundlePrice) || bundlePrice <= 0) {
      return NextResponse.json({ error: 'Invalid bundle price' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureBundleIndexes(db)

    const status = (body?.status as PosDiscountStatus) || 'inactive'
    const doc = {
      name,
      status: status === 'active' ? 'active' : 'inactive',
      startAt: body?.startAt ? new Date(body.startAt) : null,
      endAt: body?.endAt ? new Date(body.endAt) : null,
      productIds,
      bundlePrice,
      priority: Number.isFinite(Number(body?.priority)) ? Number(body.priority) : 0,
      campaignId: body?.campaignId != null ? String(body.campaignId) : null,
      eligibilityScope: body?.eligibilityScope || 'everyone',
      eligibleCustomers: normalizeEligibleCustomerIds(body?.eligibleCustomers),
      createdBy: actor.email,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).insertOne(doc)
    await logPosDiscountAudit(db, {
      action: 'bundle_created',
      targetType: 'bundle',
      targetId: String(result.insertedId),
      targetName: name,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { productIds, bundlePrice },
    })

    const saved = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).findOne({ _id: result.insertedId })
    return NextResponse.json({ success: true, bundle: saved ? serializeBundlePromotion(saved) : null })
  } catch (error: unknown) {
    console.error('[Bundles API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid bundle id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updatedAt: now }
    if (body?.name != null) updates.name = String(body.name).trim()
    if (body?.status != null) updates.status = body.status === 'active' ? 'active' : 'inactive'
    if (body?.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null
    if (body?.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null
    if (body?.productIds != null) updates.productIds = body.productIds.map(String).filter(Boolean)
    if (body?.bundlePrice != null) updates.bundlePrice = Number(body.bundlePrice)
    if (body?.priority != null) updates.priority = Number(body.priority)
    if (body?.campaignId !== undefined) updates.campaignId = body.campaignId != null ? String(body.campaignId) : null
    if (body?.eligibilityScope != null) updates.eligibilityScope = body.eligibilityScope
    if (body?.eligibleCustomers != null) {
      updates.eligibleCustomers = normalizeEligibleCustomerIds(body.eligibleCustomers)
    }

    await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: updates })

    await logPosDiscountAudit(db, {
      action: 'bundle_updated',
      targetType: 'bundle',
      targetId: id,
      targetName: String(updates.name ?? existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
      details: updates,
    })

    const doc = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ success: true, bundle: doc ? serializeBundlePromotion(doc) : null })
  } catch (error: unknown) {
    console.error('[Bundles API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid bundle id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })

    await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).deleteOne({ _id: new ObjectId(id) })
    await logPosDiscountAudit(db, {
      action: 'bundle_deleted',
      targetType: 'bundle',
      targetId: id,
      targetName: String(existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Bundles API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 })
  }
}
