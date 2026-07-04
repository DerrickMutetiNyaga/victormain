import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { POS_DISCOUNT_AUDIT_COLLECTION, ensurePosDiscountIndexes } from '@/lib/pos-product-discounts'
import { canViewPosDiscountsAdmin } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensurePosDiscountIndexes(db)

    const entries = await db
      .collection(POS_DISCOUNT_AUDIT_COLLECTION)
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        id: String(e._id),
        action: String(e.action ?? ''),
        targetType: String(e.targetType ?? ''),
        targetId: String(e.targetId ?? ''),
        targetName: String(e.targetName ?? ''),
        actorEmail: e.actorEmail != null ? String(e.actorEmail) : null,
        actorName: e.actorName != null ? String(e.actorName) : null,
        details: e.details ?? {},
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt ?? ''),
      })),
    })
  } catch (error: unknown) {
    console.error('[POS Discount Audit] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}
