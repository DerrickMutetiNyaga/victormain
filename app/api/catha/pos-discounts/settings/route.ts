import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import {
  loadPromotionSettings,
  savePromotionSettings,
  ensurePromotionSettingsIndexes,
  CONFLICT_MODE_LABELS,
  type PromotionConflictMode,
} from '@/lib/pos-promotion-settings'
import { canManagePosDiscounts, canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'
import { logPosDiscountAudit } from '@/lib/pos-product-discounts'

export const runtime = 'nodejs'

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
    await ensurePromotionSettingsIndexes(db)
    const conflictMode = await loadPromotionSettings(db)
    return NextResponse.json({
      success: true,
      conflictMode,
      conflictModeLabel: CONFLICT_MODE_LABELS[conflictMode],
      options: Object.entries(CONFLICT_MODE_LABELS).map(([value, label]) => ({ value, label })),
    })
  } catch (error: unknown) {
    console.error('[Promotion Settings API] GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const mode = String(body?.conflictMode ?? '') as PromotionConflictMode
    if (!CONFLICT_MODE_LABELS[mode]) {
      return NextResponse.json({ error: 'Invalid conflict mode' }, { status: 400 })
    }

    const actorEmail = String(session.user?.email ?? '') || null
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePromotionSettingsIndexes(db)
    const prev = await loadPromotionSettings(db)
    await savePromotionSettings(db, mode, actorEmail)

    await logPosDiscountAudit(db, {
      action: 'promotion_settings_updated',
      targetType: 'settings',
      targetId: 'global',
      targetName: 'Promotion conflict resolution',
      actorEmail,
      actorName: String(session.user?.name ?? '') || null,
      details: { previousMode: prev, conflictMode: mode },
    })

    return NextResponse.json({
      success: true,
      conflictMode: mode,
      conflictModeLabel: CONFLICT_MODE_LABELS[mode],
    })
  } catch (error: unknown) {
    console.error('[Promotion Settings API] PUT error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
