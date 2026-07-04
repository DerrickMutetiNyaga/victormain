import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'
import { getDatabase } from '@/lib/mongodb'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { verifyMpesaEditSession } from '@/lib/catha-mpesa-integration-security'

/** Returns full M-Pesa credentials only when a valid edit OTP session is active. */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const role = ((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'settings', 'edit')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
  }

  const token = request.headers.get('x-mpesa-edit-token') || ''
  const valid = await verifyMpesaEditSession(token, session.user.email)
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'M-Pesa edit session expired or invalid.' },
      { status: 403 }
    )
  }

  try {
    const db = await getDatabase('infusion_jaba')
    const settings = await db.collection('catha_settings').findOne({})
    const mpesa = settings?.mpesa ?? null
    return NextResponse.json({ success: true, mpesa })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load M-Pesa settings'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
