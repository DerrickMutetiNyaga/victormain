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
