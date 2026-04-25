import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'
import { hasCathaPermission, normalizePermissions } from '@/lib/catha-permissions-model'
import { runAuditRetentionSweep } from '@/lib/catha-audit-log'

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as any).role || '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'settings', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const result = await runAuditRetentionSweep({ force: true })
    return NextResponse.json({ ok: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Failed to run retention', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
