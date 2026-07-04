import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import {
  canManuallyAddMpesaTransaction,
  normalizePermissions,
} from '@/lib/catha-permissions-model'
import { lookupMpesaTransactionCode } from '@/lib/catha-manual-mpesa-payment'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role as string | undefined
    const perms = normalizePermissions((session.user as any).permissions)
    if (!canManuallyAddMpesaTransaction(perms, role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const code = normalizeMpesaReceiptCode(searchParams.get('code'))
    const orderId = String(searchParams.get('orderId') || '').trim()

    if (!code || code.length < 3) {
      return NextResponse.json({ status: 'invalid', transactionCode: code || '' })
    }

    const db = await getDatabase('infusion_jaba')
    const result = await lookupMpesaTransactionCode(db, code, orderId || null)

    const res = NextResponse.json(result)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Manual M-Pesa Lookup] Error:', error)
    return NextResponse.json(
      { error: 'Failed to look up transaction code', message: error.message },
      { status: 500 }
    )
  }
}
