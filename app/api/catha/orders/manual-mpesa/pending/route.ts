import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import {
  canApproveManualMpesaVerifications,
  normalizePermissions,
} from '@/lib/catha-permissions-model'
import { listPendingManualMpesaVerifications } from '@/lib/catha-manual-mpesa-verification'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role as string | undefined
    const perms = normalizePermissions((session.user as any).permissions)
    if (!canApproveManualMpesaVerifications(perms, role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw != null ? Math.min(100, parseInt(limitRaw, 10) || 50) : 50

    const db = await getDatabase('infusion_jaba')
    const pending = await listPendingManualMpesaVerifications(db, limit)

    const res = NextResponse.json({ pending, count: pending.length })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('[Manual M-Pesa Pending] Error:', error)
    return NextResponse.json(
      { error: 'Failed to list pending verifications', message: error.message },
      { status: 500 }
    )
  }
}
