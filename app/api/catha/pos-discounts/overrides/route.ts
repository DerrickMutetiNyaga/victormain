import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import {
  createCampaignOverride,
  removeCampaignOverride,
  ensureCampaignOverrideIndexes,
  serializeCampaignOverride,
  dateKeyForNow,
  POS_CAMPAIGN_OVERRIDES_COLLECTION,
} from '@/lib/pos-campaign-overrides'
import { logPosDiscountAudit } from '@/lib/pos-product-discounts'
import { canManagePosDiscounts, canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

function sessionActor(session: { user?: { email?: string | null; name?: string | null } }) {
  return {
    email: String(session.user?.email ?? '') || null,
    name: String(session.user?.name ?? '') || null,
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
  if (!canViewPosDiscountsAdmin(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dateKey = searchParams.get('dateKey') || dateKeyForNow()
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureCampaignOverrideIndexes(db)

    const rows = await db
      .collection(POS_CAMPAIGN_OVERRIDES_COLLECTION)
      .find({ dateKey })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      dateKey,
      overrides: rows.map((r) => serializeCampaignOverride(r)),
    })
  } catch (error: unknown) {
    console.error('[Overrides API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 })
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
    const campaignId = String(body?.campaignId ?? '').trim()
    if (!campaignId) return NextResponse.json({ error: 'Campaign id required' }, { status: 400 })

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureCampaignOverrideIndexes(db)

    const doc = await createCampaignOverride(db, {
      campaignId,
      dateKey: body?.dateKey ? String(body.dateKey) : undefined,
      reason: String(body?.reason ?? 'Disabled for today'),
      createdBy: actor.email,
    })

    await logPosDiscountAudit(db, {
      action: 'campaign_override_created',
      targetType: 'campaign_override',
      targetId: campaignId,
      targetName: `Override ${doc.dateKey}`,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { dateKey: doc.dateKey, reason: doc.reason },
    })

    return NextResponse.json({ success: true, override: serializeCampaignOverride(doc as unknown as Record<string, unknown>) })
  } catch (error: unknown) {
    console.error('[Overrides API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create override' }, { status: 500 })
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
    const campaignId = searchParams.get('campaignId')
    const dateKey = searchParams.get('dateKey') || dateKeyForNow()
    if (!campaignId) return NextResponse.json({ error: 'Campaign id required' }, { status: 400 })

    const actor = sessionActor(session)
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await removeCampaignOverride(db, campaignId, dateKey)

    await logPosDiscountAudit(db, {
      action: 'campaign_override_removed',
      targetType: 'campaign_override',
      targetId: campaignId,
      targetName: `Override ${dateKey}`,
      actorEmail: actor.email,
      actorName: actor.name,
      details: { dateKey },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Overrides API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove override' }, { status: 500 })
  }
}
