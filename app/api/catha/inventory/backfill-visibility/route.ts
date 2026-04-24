import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const result = await db.collection('bar_inventory').updateMany(
      { type: 'bar', isVisible: { $exists: false } },
      { $set: { isVisible: true, updatedAt: new Date() } },
    )

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to backfill product visibility', details: error?.message || String(error) },
      { status: 500 },
    )
  }
}
