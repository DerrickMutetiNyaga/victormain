import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import {
  defaultEcommerceOpeningHours,
  evaluateEcommerceOpeningHours,
  type EcommerceOpeningHoursSettings,
} from '@/lib/ecommerce-opening-hours'

/**
 * Public: server-side Nairobi (EAT) evaluation for checkout UI.
 * Frontend should render `message` only when `showNotice` is true.
 */
export async function GET() {
  try {
    const db = await getDatabase('infusion_jaba')
    const doc = await db.collection('catha_settings').findOne({})
    const raw = (doc as { ecommerceOpeningHours?: unknown } | null)?.ecommerceOpeningHours
    const merged: EcommerceOpeningHoursSettings = {
      ...defaultEcommerceOpeningHours,
      ...(raw && typeof raw === 'object' ? (raw as object) : {}),
    }
    const ev = evaluateEcommerceOpeningHours(merged, new Date())
    const blockCheckout = Boolean(merged.blockCheckoutWhenClosed && ev.isClosed)

    return NextResponse.json({
      success: true,
      showNotice: ev.isClosed,
      message: ev.isClosed ? ev.message : null,
      nextOpeningAt: ev.nextOpeningAt,
      blockCheckout,
    })
  } catch (e: unknown) {
    console.error('[opening-hours-status]', e)
    return NextResponse.json(
      {
        success: true,
        showNotice: false,
        message: null,
        nextOpeningAt: null,
        blockCheckout: false,
      },
      { status: 200 }
    )
  }
}
