import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import {
  POS_DISCOUNTS_COLLECTION,
  POS_CATEGORY_DISCOUNTS_COLLECTION,
  logPosDiscountAudit,
  isDiscountEffectivelyActive,
} from '@/lib/pos-product-discounts'
import {
  POS_DISCOUNT_CAMPAIGNS_COLLECTION,
  ensureCampaignIndexes,
  serializeCampaign,
  mapCampaignRow,
  buildCampaignDocFields,
  isCampaignEffectivelyActive,
  type CampaignInputPayload,
  type PosCampaignStatus,
} from '@/lib/pos-discount-campaigns'
import { canManagePosDiscounts, canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

function sessionActor(session: { user?: { email?: string | null; name?: string | null } }) {
  return {
    email: String(session.user?.email ?? '') || null,
    name: String(session.user?.name ?? '') || null,
  }
}

async function countLinkedDiscounts(db: import('mongodb').Db, campaignId: string) {
  const [productCount, categoryCount] = await Promise.all([
    db.collection(POS_DISCOUNTS_COLLECTION).countDocuments({ campaignId }),
    db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).countDocuments({ campaignId }),
  ])
  return { productCount, categoryCount }
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
    await ensureCampaignIndexes(db)
    const now = new Date()

    const rows = await db
      .collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION)
      .find({})
      .sort({ priority: -1, updatedAt: -1 })
      .toArray()

    const campaigns = await Promise.all(
      rows.map(async (row) => {
        const id = String(row._id)
        const mapped = mapCampaignRow(row)
        const { productCount, categoryCount } = await countLinkedDiscounts(db, id)
        return serializeCampaign(row, {
          effectivelyActive: isCampaignEffectivelyActive(mapped, now),
          linkedProductCount: productCount,
          linkedCategoryCount: categoryCount,
        })
      })
    )

    return NextResponse.json({ success: true, campaigns })
  } catch (error: unknown) {
    console.error('[Campaigns API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
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
    const body = (await request.json()) as CampaignInputPayload
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Campaign name required' }, { status: 400 })

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureCampaignIndexes(db)

    const fields = buildCampaignDocFields(body, actor.email, now)
    const result = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).insertOne({
      ...fields,
      createdAt: now,
    })

    await logPosDiscountAudit(db, {
      action: 'campaign_created',
      targetType: 'campaign',
      targetId: String(result.insertedId),
      targetName: name,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { status: fields.status, priority: fields.priority },
    })

    const doc = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).findOne({ _id: result.insertedId })
    return NextResponse.json({
      success: true,
      campaign: doc ? serializeCampaign(doc as Record<string, unknown>) : null,
    })
  } catch (error: unknown) {
    console.error('[Campaigns API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid campaign id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const now = new Date()
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const updates = buildCampaignDocFields(body as CampaignInputPayload, actor.email, now)
    const prevStatus = existing.status as PosCampaignStatus

    await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    )

    let auditAction: 'campaign_updated' | 'campaign_activated' | 'campaign_disabled' | 'campaign_archived' =
      'campaign_updated'
    if (updates.status === 'archived' && prevStatus !== 'archived') auditAction = 'campaign_archived'
    else if (updates.status === 'active' && prevStatus !== 'active') auditAction = 'campaign_activated'
    else if (updates.status === 'inactive' && prevStatus === 'active') auditAction = 'campaign_disabled'

    await logPosDiscountAudit(db, {
      action: auditAction,
      targetType: 'campaign',
      targetId: id,
      targetName: updates.name || String(existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
      details: { status: updates.status, priority: updates.priority },
    })

    const doc = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).findOne({ _id: new ObjectId(id) })
    return NextResponse.json({
      success: true,
      campaign: doc ? serializeCampaign(doc as Record<string, unknown>) : null,
    })
  } catch (error: unknown) {
    console.error('[Campaigns API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
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
      return NextResponse.json({ error: 'Valid campaign id required' }, { status: 400 })
    }

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const existing = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).deleteOne({ _id: new ObjectId(id) })
    await db.collection(POS_DISCOUNTS_COLLECTION).updateMany({ campaignId: id }, { $set: { campaignId: null } })
    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).updateMany({ campaignId: id }, { $set: { campaignId: null } })

    await logPosDiscountAudit(db, {
      action: 'campaign_deleted',
      targetType: 'campaign',
      targetId: id,
      targetName: String(existing.name),
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Campaigns API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
