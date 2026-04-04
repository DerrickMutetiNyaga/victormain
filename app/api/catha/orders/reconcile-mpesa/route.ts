import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { appendMpesaPaymentToOrder } from '@/lib/catha-append-mpesa-payment'

export async function POST() {
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

    const db = await getDatabase('infusion_jaba')

    const completedTx = await db
      .collection('mpesa_transactions')
      .find({ status: 'COMPLETED', account_reference: { $exists: true, $ne: null } })
      .toArray()

    if (!completedTx.length) {
      return NextResponse.json({
        success: true,
        reconciled: 0,
        alreadyPaid: 0,
        notFound: 0,
        skipped: 0,
        message: 'No completed M-Pesa transactions found to reconcile.',
      })
    }

    let reconciled = 0
    let alreadyPaid = 0
    let notFound = 0
    let skipped = 0
    const linkedBy = (session.user as any).name || session.user.email || 'Reconcile'

    for (const tx of completedTx) {
      const orderId = typeof tx.account_reference === 'string' ? tx.account_reference.trim() : ''
      if (!orderId) continue

      const order = await db.collection('orders').findOne({ id: orderId })
      if (!order) {
        notFound++
        continue
      }

      if (order.paymentStatus === 'PAID' && order.status === 'completed') {
        alreadyPaid++
        continue
      }

      const transactionId = tx._id?.toString()
      if (!transactionId) {
        skipped++
        continue
      }

      const result = await appendMpesaPaymentToOrder(db, { orderId, transactionId, linkedBy })
      if (result.ok) {
        reconciled++
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      reconciled,
      alreadyPaid,
      notFound,
      skipped,
    })
  } catch (error: any) {
    console.error('[Reconcile M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile M-Pesa payments', message: error.message },
      { status: 500 }
    )
  }
}
