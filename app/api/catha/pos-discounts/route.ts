import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import {
  POS_DISCOUNTS_COLLECTION,
  ensurePosDiscountIndexes,
  serializePosDiscount,
  serializeCategoryDiscount,
  validateDiscountInput,
  buildDiscountDocFields,
  logPosDiscountAudit,
  isDiscountEffectivelyActive,
  loadPosDiscountContext,
  countEffectivelyActiveDiscounts,
  sumPosDiscountSavingsFromOrders,
  diffEligibleCustomers,
  normalizeEligibleCustomerIds,
  type DiscountInputPayload,
  type PosDiscountStatus,
} from '@/lib/pos-product-discounts'
import {
  getPromotionDashboardStats,
  serializeCampaign,
  isCampaignEffectivelyActive,
  getActiveCampaignBanners,
  ensureCampaignIndexes,
  isCampaignAllowingDiscount,
} from '@/lib/pos-discount-campaigns'
import { CONFLICT_MODE_LABELS } from '@/lib/pos-promotion-settings'
import {
  canManagePosDiscounts,
  canViewPosDiscountsForPos,
  canViewPosDiscountsAdmin,
} from '@/lib/pos-discount-permissions'
import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'

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
    targetType: 'product' | 'category'
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
      targetType: opts.targetType,
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
      targetType: opts.targetType,
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

function sessionActor(session: { user?: { email?: string | null; name?: string | null } }) {
  return {
    email: String(session.user?.email ?? '') || null,
    name: String(session.user?.name ?? '') || null,
  }
}

/** GET — list discounts, stats, or POS-active payload */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  const { searchParams } = new URL(request.url)
  const statsOnly = searchParams.get('stats') === 'true'
  const activeOnly = searchParams.get('activeOnly') === 'true'

  if (statsOnly) {
    if (!canViewPosDiscountsAdmin(role, perms)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  } else if (activeOnly) {
    if (!canViewPosDiscountsForPos(role, perms)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  } else if (!canViewPosDiscountsAdmin(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePosDiscountIndexes(db)
    await ensureCampaignIndexes(db)
    const now = new Date()

    if (statsOnly) {
      const ctx = await loadPosDiscountContext(db, now)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)

      const todayOrders = await db
        .collection('orders')
        .find({
          orderSource: { $in: ['pos', null] },
          timestamp: { $gte: todayStart, $lt: tomorrowStart },
          $or: [{ status: 'completed' }, { paymentStatus: 'PAID' }],
        })
        .project({ items: 1, timestamp: 1 })
        .toArray()

      const promotionStats = getPromotionDashboardStats(ctx, todayOrders, todayStart, tomorrowStart)

      return NextResponse.json({
        success: true,
        stats: {
          activeCount: countEffectivelyActiveDiscounts(ctx),
          productRules: ctx.productDiscounts.size,
          categoryRules: ctx.categoryDiscounts.size,
          ...promotionStats,
        },
      })
    }

    const ctx = await loadPosDiscountContext(db, now)
    const campaignNameById = new Map<string, string>()
    for (const [id, c] of ctx.campaigns) campaignNameById.set(id, c.name)

    const statusFilter = searchParams.get('status') // active | inactive | all
    const effectiveFilter = searchParams.get('effective') // active_now | scheduled | expired

    const discounts = await db
      .collection(POS_DISCOUNTS_COLLECTION)
      .find({})
      .sort({ updatedAt: -1 })
      .toArray()

    const productIds = discounts.map((d) => String(d.productId)).filter(Boolean)
    const productMap = new Map<string, Record<string, unknown>>()

    if (productIds.length > 0) {
      const oids = productIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
      if (oids.length > 0) {
        const products = await db
          .collection('bar_inventory')
          .find({ _id: { $in: oids }, type: 'bar', deleted: { $ne: true } })
          .project({ name: 1, category: 1, price: 1, image: 1, barcode: 1, size: 1, supplier: 1 })
          .toArray()
        for (const p of products) productMap.set(p._id.toString(), p)
      }
    }

    let enriched = discounts.map((d) => {
      const product = productMap.get(String(d.productId))
      const catalogPrice = product ? Number(product.price ?? 0) : undefined
      const campaignId = d.campaignId != null ? String(d.campaignId) : null
      const discountActive = isDiscountEffectivelyActive(
        { status: d.status as PosDiscountStatus, startAt: d.startAt, endAt: d.endAt },
        now
      )
      const campaignOk = isCampaignAllowingDiscount(
        campaignId,
        ctx.campaigns,
        now,
        ctx.disabledCampaignIds
      )
      return {
        ...serializePosDiscount(d, catalogPrice),
        campaignId,
        campaignName: campaignId ? campaignNameById.get(campaignId) ?? null : null,
        effectivelyActive: discountActive && campaignOk,
        product: product
          ? {
              id: String(product._id),
              name: String(product.name ?? ''),
              category: String(product.category ?? ''),
              price: Number(product.price ?? 0),
              image: String(product.image ?? '/placeholder.svg'),
              barcode: String(product.barcode ?? ''),
              supplier: String(product.supplier ?? ''),
              size: String(product.size ?? ''),
            }
          : null,
      }
    })

    const customerIds = enriched.flatMap((d) =>
      d.eligibilityScope === 'selected_customers' ? d.eligibleCustomers ?? [] : []
    )
    const customerNameMap = await resolveCustomerDisplayNames(db, [...new Set(customerIds)])
    enriched = enriched.map((d) => ({
      ...d,
      eligibleCustomerDetails:
        d.eligibilityScope === 'selected_customers' && (d.eligibleCustomers?.length ?? 0) > 0
          ? (d.eligibleCustomers ?? []).map((id) => ({
              id,
              name: customerNameMap.get(id) || id,
              phone: id,
            }))
          : [],
    }))

    if (statusFilter === 'active' || statusFilter === 'inactive') {
      enriched = enriched.filter((d) => d.status === statusFilter)
    }

    if (effectiveFilter === 'active_now') {
      enriched = enriched.filter((d) => d.effectivelyActive)
    } else if (effectiveFilter === 'scheduled') {
      enriched = enriched.filter((d) => d.status === 'active' && !d.effectivelyActive && d.startAt)
    } else if (effectiveFilter === 'expired') {
      enriched = enriched.filter((d) => d.endAt && new Date(d.endAt) < now)
    }

    if (activeOnly) {
      enriched = enriched.filter((d) => d.effectivelyActive)
      const disabledCampaignIds = ctx.disabledCampaignIds ?? new Set<string>()

      const categoryRows = await db.collection('pos_category_discounts').find({}).toArray()
      const categoryDiscounts = categoryRows
        .map((d) => {
          const campaignId = d.campaignId != null ? String(d.campaignId) : null
          const discountActive = isDiscountEffectivelyActive(
            { status: d.status as PosDiscountStatus, startAt: d.startAt, endAt: d.endAt },
            now
          )
          const campaignOk = isCampaignAllowingDiscount(
            campaignId,
            ctx.campaigns,
            now,
            disabledCampaignIds
          )
          return {
            ...serializeCategoryDiscount(d),
            campaignId,
            campaignName: campaignId ? campaignNameById.get(campaignId) ?? null : null,
            effectivelyActive: discountActive && campaignOk,
          }
        })
        .filter((d) => d.effectivelyActive)

      const campaigns = [...ctx.campaigns.entries()]
        .filter(([id, c]) => isCampaignEffectivelyActive(c, now) && !disabledCampaignIds.has(id))
        .map(([id, c]) =>
          serializeCampaign({ _id: id, ...c } as Record<string, unknown>, { effectivelyActive: true })
        )

      const banners = getActiveCampaignBanners(ctx)

      return NextResponse.json({
        success: true,
        discounts: enriched,
        categoryDiscounts,
        campaigns,
        banners,
        conflictMode: ctx.conflictMode ?? 'never_stack',
        conflictModeLabel: CONFLICT_MODE_LABELS[ctx.conflictMode ?? 'never_stack'],
        disabledCampaignIds: [...disabledCampaignIds],
      })
    }

    return NextResponse.json({ success: true, discounts: enriched })
  } catch (error: unknown) {
    console.error('[POS Discounts API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch POS discounts' }, { status: 500 })
  }
}

async function upsertProductDiscount(
  db: Db,
  item: DiscountInputPayload,
  staffEmail: string | null,
  actorName: string | null,
  now: Date,
  auditAction: 'created' | 'updated' | 'bulk_applied' = 'updated'
) {
  const productId = String(item.productId ?? '').trim()
  if (!productId || !ObjectId.isValid(productId)) {
    return { error: 'Invalid productId', productId }
  }

  const discountType = item.discountType
  if (discountType !== 'percentage' && discountType !== 'fixed') {
    return { error: 'Invalid discount type', productId }
  }

  const product = await db.collection('bar_inventory').findOne({
    _id: new ObjectId(productId),
    type: 'bar',
    deleted: { $ne: true },
    status: { $ne: 'archived' },
  })

  if (!product) return { error: 'Product not found', productId }

  const catalogPrice = Number(product.price ?? 0)
  const validated = validateDiscountInput(discountType, Number(item.discountValue), catalogPrice)
  if (!validated.ok) return { error: validated.error, productId }

  const existing = await db.collection(POS_DISCOUNTS_COLLECTION).findOne({ productId })
  const fields = buildDiscountDocFields(item, staffEmail, now)

  const result = await db.collection(POS_DISCOUNTS_COLLECTION).findOneAndUpdate(
    { productId },
    { $set: fields, $setOnInsert: { createdAt: now, productId } },
    { upsert: true, returnDocument: 'after' }
  )

  if (result) {
    await logEligibilityAuditIfChanged(db, {
      existing,
      nextEligible: fields.eligibleCustomers,
      promotionName: fields.promotionName,
      targetType: 'product',
      targetId: productId,
      targetName: String(product.name ?? 'Product'),
      actorEmail: staffEmail,
      actorName,
    })

    await logPosDiscountAudit(db, {
      action: existing ? auditAction : 'created',
      targetType: 'product',
      targetId: productId,
      targetName: String(product.name ?? 'Product'),
      actorEmail: staffEmail,
      actorName,
      details: {
        discountType,
        discountValue: Number(item.discountValue),
        status: fields.status,
        promotionName: fields.promotionName,
        oldValue: existing ? Number(existing.discountValue) : null,
      },
    })
    return { saved: serializePosDiscount(result, catalogPrice) }
  }

  return { error: 'Save failed', productId }
}

/** POST — create/update product discounts (single, bulk, or batch) */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const actor = sessionActor(session)
    const now = new Date()

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePosDiscountIndexes(db)

    // Bulk apply same discount to many products
    if (body?.bulk === true && Array.isArray(body.productIds)) {
      const productIds: string[] = body.productIds.slice(0, 100)
      const template: Omit<DiscountInputPayload, 'productId'> = {
        discountType: body.discountType,
        discountValue: Number(body.discountValue),
        status: body.status,
        startAt: body.startAt,
        endAt: body.endAt,
        promotionName: body.promotionName,
        eligibilityScope: body.eligibilityScope,
        eligibleCustomers: body.eligibleCustomers,
        campaignId: body.campaignId,
      }

      const saved = []
      const errors: { productId: string; error: string }[] = []

      for (const pid of productIds) {
        const result = await upsertProductDiscount(
          db,
          { productId: pid, ...template },
          actor.email,
          actor.name,
          now,
          'bulk_applied'
        )
        if ('saved' in result && result.saved) saved.push(result.saved)
        else if ('error' in result) errors.push({ productId: pid, error: result.error! })
      }

      return NextResponse.json({ success: errors.length === 0, saved, errors: errors.length ? errors : undefined })
    }

    const items: DiscountInputPayload[] = Array.isArray(body?.discounts)
      ? body.discounts
      : body?.productId
        ? [body as DiscountInputPayload]
        : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'No discounts provided' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Too many discounts in one request (max 100)' }, { status: 400 })
    }

    const saved = []
    const errors: { productId: string; error: string }[] = []

    for (const item of items) {
      const result = await upsertProductDiscount(db, item, actor.email, actor.name, now)
      if ('saved' in result && result.saved) saved.push(result.saved)
      else if ('error' in result) errors.push({ productId: item.productId, error: result.error! })
    }

    return NextResponse.json({
      success: errors.length === 0,
      saved,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error('[POS Discounts API] POST error:', error)
    return NextResponse.json({ error: 'Failed to save POS discounts' }, { status: 500 })
  }
}

/** DELETE — remove a POS product discount */
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const productId = searchParams.get('productId')
    const actor = sessionActor(session)

    if (!id && !productId) {
      return NextResponse.json({ error: 'id or productId required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const filter: Record<string, unknown> = id
      ? ObjectId.isValid(id)
        ? { _id: new ObjectId(id) }
        : { id }
      : { productId: String(productId) }

    const existing = await db.collection(POS_DISCOUNTS_COLLECTION).findOne(filter)
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
    }

    let targetName = String(existing.productId)
    if (ObjectId.isValid(String(existing.productId))) {
      const p = await db.collection('bar_inventory').findOne({ _id: new ObjectId(String(existing.productId)) })
      if (p?.name) targetName = String(p.name)
    }

    await db.collection(POS_DISCOUNTS_COLLECTION).deleteOne(filter)

    await logPosDiscountAudit(db, {
      action: 'deleted',
      targetType: 'product',
      targetId: String(existing.productId),
      targetName,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { discountValue: existing.discountValue, discountType: existing.discountType },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[POS Discounts API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete POS discount' }, { status: 500 })
  }
}

/** PATCH — quick disable/enable */
export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const id = String(body?.id ?? '')
    const productId = String(body?.productId ?? '')
    const status = body?.status === 'inactive' ? 'inactive' : 'active'
    const actor = sessionActor(session)
    const now = new Date()

    if (!id && !productId) {
      return NextResponse.json({ error: 'id or productId required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const filter: Record<string, unknown> = id
      ? ObjectId.isValid(id)
        ? { _id: new ObjectId(id) }
        : { id }
      : { productId }

    const existing = await db.collection(POS_DISCOUNTS_COLLECTION).findOne(filter)
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
    }

    const result = await db.collection(POS_DISCOUNTS_COLLECTION).findOneAndUpdate(
      filter,
      { $set: { status, updatedAt: now } },
      { returnDocument: 'after' }
    )

    let targetName = String(existing.productId)
    if (ObjectId.isValid(String(existing.productId))) {
      const p = await db.collection('bar_inventory').findOne({ _id: new ObjectId(String(existing.productId)) })
      if (p?.name) targetName = String(p.name)
    }

    await logPosDiscountAudit(db, {
      action: status === 'inactive' ? 'disabled' : 'enabled',
      targetType: 'product',
      targetId: String(existing.productId),
      targetName,
      actorEmail: actor.email,
      actorName: actor.name,
    })

    return NextResponse.json({ success: true, discount: result ? serializePosDiscount(result) : null })
  } catch (error: unknown) {
    console.error('[POS Discounts API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update discount status' }, { status: 500 })
  }
}
