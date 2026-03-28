import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import {
  baseLinkedListFromOrder,
  recalculateOrderPaymentsAfterLinks,
} from '@/lib/catha-append-mpesa-payment'

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
    const transactionId = String(body?.transactionId || '').trim()
    if (!orderId || !transactionId || !ObjectId.isValid(transactionId)) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const order = await db.collection('orders').findOne({ id: orderId })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const before = baseLinkedListFromOrder(order)
    if (!before.some((p) => p.transactionId === transactionId)) {
      return NextResponse.json({ error: 'Transaction is not linked to this order' }, { status: 400 })
    }

    const list = before.filter((p) => p.transactionId !== transactionId)
    const now = new Date()
    const last = list[list.length - 1]

    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          linkedPayments: list,
          mpesaTransactionId: last ? last.transactionId : null,
          mpesaReceiptNumber: last ? last.receiptNumber : null,
          linkedAt: last ? last.linkedAt : null,
          linkedBy: last ? last.linkedBy : null,
          updatedAt: now,
        },
      }
    )

    await db.collection('mpesa_transactions').updateOne(
      { _id: new ObjectId(transactionId) },
      { $unset: { linked_order_id: '', linked_at: '', linked_by: '' }, $set: { updatedAt: now } }
    )

    await recalculateOrderPaymentsAfterLinks(db, orderId)

    const res = NextResponse.json({ success: true, orderId })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Orders Unlink M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to unlink M-Pesa transaction', message: error.message },
      { status: 500 }
    )
  }
}
