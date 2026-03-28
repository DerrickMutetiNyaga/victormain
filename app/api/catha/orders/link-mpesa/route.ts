import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { appendMpesaPaymentToOrder } from '@/lib/catha-append-mpesa-payment'

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

    const db = await getDatabase('infusion_jaba')
    const linkedBy = (session.user as any).name || session.user.email || 'System'

    const result = await appendMpesaPaymentToOrder(db, { orderId, transactionId, linkedBy })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const res = NextResponse.json({
      success: true,
      orderId: result.orderId,
      transactionId: result.transactionId,
      mpesaReceiptNumber: result.mpesaReceiptNumber,
      linkedAt: result.linkedAt.toISOString(),
      linkedBy,
      summary: result.summary,
      linkedPayments: result.linkedPayments,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Orders Link M-Pesa] Error:', error)
    return NextResponse.json(
      { error: 'Failed to link M-Pesa transaction', message: error.message },
      { status: 500 }
    )
  }
}
