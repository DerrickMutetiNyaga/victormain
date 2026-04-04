import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { summarizeCathaOrderPayments } from '@/lib/catha-order-payments'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = ((session.user as any).role ?? '').toUpperCase()
    const perms = normalizePermissions((session.user as any).permissions)
    if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'orders', 'edit')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const changeNotes =
      typeof body?.changeNotes === 'string' ? body.changeNotes.trim().slice(0, 2000) : ''
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const order = await db.collection('orders').findOne({ id: orderId })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const summary = summarizeCathaOrderPayments(order as any)
    if (summary.overpaymentAmount <= 0) {
      return NextResponse.json(
        { error: 'This order has no excess amount to record change for.' },
        { status: 400 }
      )
    }

    const by = (session.user as any).name || session.user.email || 'System'
    const at = new Date()

    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          changeGiven: true,
          changeGivenAt: at,
          changeGivenBy: by,
          changeNotes: changeNotes || null,
          updatedAt: at,
        },
      }
    )

    const res = NextResponse.json({
      success: true,
      orderId,
      changeGivenAt: at.toISOString(),
      changeGivenBy: by,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Orders Mark Change Given] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update change status', message: error.message },
      { status: 500 }
    )
  }
}
