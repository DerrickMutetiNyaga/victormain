import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { analyticsDbName, trackAnalyticsEvent, type AnalyticsEventType } from '@/lib/commerce-analytics'

const EVENT_TYPES: AnalyticsEventType[] = [
  'page_view',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
  'search',
  'wishlist_add',
]

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const eventType = body?.eventType
    if (!EVENT_TYPES.includes(eventType)) {
      return NextResponse.json({ ok: false, error: 'Invalid event type' }, { status: 400 })
    }

    const db = await getDatabase(analyticsDbName())
    await trackAnalyticsEvent(db, request, {
      eventType,
      sessionId: typeof body?.sessionId === 'string' ? body.sessionId : null,
      path: typeof body?.path === 'string' ? body.path : null,
      pageName: typeof body?.pageName === 'string' ? body.pageName : null,
      productId: typeof body?.productId === 'string' ? body.productId : null,
      productName: typeof body?.productName === 'string' ? body.productName : null,
      category: typeof body?.category === 'string' ? body.category : null,
      searchQuery: typeof body?.searchQuery === 'string' ? body.searchQuery : null,
      quantity: typeof body?.quantity === 'number' ? body.quantity : null,
      value: typeof body?.value === 'number' ? body.value : null,
      orderId: typeof body?.orderId === 'string' ? body.orderId : null,
      metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[analytics/track] Failed:', error)
    return NextResponse.json({ ok: false, error: 'Failed to track event' }, { status: 500 })
  }
}
