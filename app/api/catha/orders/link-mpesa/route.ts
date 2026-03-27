import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { normalizeMpesaStatus } from '@/lib/mpesa-status'

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
    if (!orderId || !transactionId) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 })
    }
    if (!ObjectId.isValid(transactionId)) {
      return NextResponse.json({ error: 'Invalid transactionId' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const order = await db.collection('orders').findOne({ id: orderId })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const tx = await db.collection('mpesa_transactions').findOne({ _id: new ObjectId(transactionId) })
    if (!tx) {
      return NextResponse.json({ error: 'M-Pesa transaction not found' }, { status: 404 })
    }

    const txStatus = normalizeMpesaStatus(tx.status)
    if (txStatus !== 'COMPLETED') {
      return NextResponse.json({ error: 'Only completed M-Pesa transactions can be linked' }, { status: 400 })
    }

    const total = Number(order.total || 0)
    const received = Number(order.cashAmount || 0)
    const dueAmount = Math.max(0, total - received)
    const txAmount = Number(tx.amount || 0)
    if (txAmount !== dueAmount) {
      return NextResponse.json(
        { error: `Amount mismatch. Order due is ${dueAmount}, transaction is ${txAmount}.` },
        { status: 400 }
      )
    }

    const existingLink = await db.collection('orders').findOne({
      id: { $ne: orderId },
      mpesaTransactionId: transactionId,
      paymentMethod: 'mpesa',
      paymentStatus: 'PAID',
    })
    if (existingLink) {
      return NextResponse.json(
        { error: `Transaction is already linked to order ${existingLink.id}.` },
        { status: 409 }
      )
    }

    const mpesaReceiptNumber = tx.mpesa_receipt_number || tx.transaction_id || tx.checkout_request_id || null
    const linkedAt = new Date()
    const linkedBy = (session.user as any).name || session.user.email || 'System'

    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          paymentMethod: 'mpesa',
          paymentStatus: 'PAID',
          status: 'completed',
          mpesaTransactionId: transactionId,
          mpesaReceiptNumber,
          linkedAt,
          linkedBy,
          updatedAt: linkedAt,
        },
      }
    )

    await db.collection('mpesa_transactions').updateOne(
      { _id: new ObjectId(transactionId) },
      {
        $set: {
          linked_order_id: orderId,
          linked_at: linkedAt,
          linked_by: linkedBy,
          updatedAt: linkedAt,
        },
      }
    )

    return NextResponse.json({
      success: true,
      orderId,
      transactionId,
      mpesaReceiptNumber,
      linkedAt: linkedAt.toISOString(),
      linkedBy,
    })
  } catch (error: any) {
    console.error('[Orders Link M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to link M-Pesa transaction', message: error.message },
      { status: 500 }
    )
  }
}
