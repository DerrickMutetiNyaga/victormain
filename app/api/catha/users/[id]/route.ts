import { NextResponse } from 'next/server'
import { requireSuperAdminApi } from '@/lib/catha-auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { normalizePermissions } from '@/lib/catha-permissions-model'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_users'

/** GET a single Catha user by _id (SUPER_ADMIN only). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [session, err] = await requireSuperAdminApi()
  if (err) return err
  const { id } = await params
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }
  try {
    const client = await clientPromise
    const doc = await client.db(DB_NAME).collection(COLLECTION).findOne({ _id: new ObjectId(id) })
    if (!doc) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    const user = {
      id: doc._id?.toString(),
      email: doc.email,
      name: doc.name ?? '',
      image: doc.image ?? null,
      role: doc.role ?? 'PENDING',
      status: doc.status ?? 'PENDING',
      permissions: normalizePermissions(doc.permissions),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
      lastLogin: doc.lastLogin ? (doc.lastLogin instanceof Date ? doc.lastLogin.toISOString() : doc.lastLogin) : null,
    }
    return NextResponse.json({ success: true, user })
  } catch (e: any) {
    console.error('[catha/users/[id]] GET error:', e?.message)
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 })
  }
}

/** DELETE a Catha user by _id (SUPER_ADMIN only). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [session, err] = await requireSuperAdminApi()
  if (err) return err
  const { id } = await params
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }
  try {
    const client = await clientPromise
    const col = client.db(DB_NAME).collection(COLLECTION)
    const targetId = new ObjectId(id)

    const target = await col.findOne({ _id: targetId })
    if (!target) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

    // Avoid removing the currently logged-in super admin account.
    const currentEmail = session?.user?.email
    if (currentEmail && String(target.email).toLowerCase() === String(currentEmail).toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    const superAdminCount = await col.countDocuments({ role: 'SUPER_ADMIN' })
    if (String(target.role).toUpperCase() === 'SUPER_ADMIN' && superAdminCount <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the last super admin' },
        { status: 400 }
      )
    }

    const deleted = await col.deleteOne({ _id: targetId })
    if (deleted.deletedCount !== 1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[catha/users/[id]] DELETE error:', e?.message)
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 })
  }
}
