import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import {
  loadPosDiscountContext,
  normalizeCustomerIdForEligibility,
} from '@/lib/pos-product-discounts'
import { listEligibleCampaignsForCustomer, ensureCampaignIndexes } from '@/lib/pos-discount-campaigns'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('management.clients', 'view')
  if (!allowed && response) return response

  const { searchParams } = new URL(request.url)
  const rawPhone = String(searchParams.get('phone') ?? '').trim()
  const customerId = normalizeCustomerIdForEligibility(normalizeKenyaPhone(rawPhone) || rawPhone)
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await ensureCampaignIndexes(db)
    const now = new Date()
    const ctx = await loadPosDiscountContext(db, now)

    const campaigns = listEligibleCampaignsForCustomer(customerId, ctx)

    return NextResponse.json({ success: true, campaigns })
  } catch (error: unknown) {
    console.error('[catha/clients/eligible-discounts] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load eligible campaigns' }, { status: 500 })
  }
}
