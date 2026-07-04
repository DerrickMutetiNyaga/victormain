import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { resolveBarOrderLines } from '@/lib/secure-bar-order-lines'
import { canViewPosDiscountsForPos } from '@/lib/pos-discount-permissions'
import { cathaOrderLineInputSchema } from '@/lib/order-request-schemas'
import { z } from 'zod'

export const runtime = 'nodejs'

const previewSchema = z
  .object({
    items: z.array(cathaOrderLineInputSchema).min(1).max(200),
    customerPhone: z.union([z.string().max(40), z.null()]).optional(),
    promoCode: z.union([z.string().max(64), z.null()]).optional(),
  })
  .strict()

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
  if (!canViewPosDiscountsForPos(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const parsed = previewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid preview payload' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const body = parsed.data

    const priced = await resolveBarOrderLines(db, body.items, {
      allowCustomLines: true,
      rejectCustomLines: false,
      applyPosDiscounts: true,
      customerId: body.customerPhone ? normalizeKenyaPhone(String(body.customerPhone)) : null,
      promoCode: body.promoCode ?? null,
    })

    if (!priced.ok) {
      return NextResponse.json({ error: priced.error, code: priced.code }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      subtotal: priced.subtotal,
      total: priced.total,
      posOrderDiscount: priced.posOrderDiscount ?? 0,
      bundleDiscount: priced.bundleDiscount ?? 0,
      spendDiscount: priced.spendDiscount ?? 0,
      couponDiscount: priced.couponDiscount ?? 0,
      appliedBundles: priced.appliedBundles ?? [],
      spendPromotionName: priced.spendPromotionName ?? null,
      promoCode: priced.promoCode ?? null,
      promoCodeLabel: priced.promoCodeLabel ?? null,
    })
  } catch (error: unknown) {
    console.error('[Preview Order API] error:', error)
    return NextResponse.json({ error: 'Failed to preview order pricing' }, { status: 500 })
  }
}
