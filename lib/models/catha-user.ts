/**
 * Catha User model (V2) - isolated from Jaba/bar_users.
 * Roles: SUPER_ADMIN | ADMIN | CASHIER | PENDING
 * Status: ACTIVE | PENDING | DISABLED
 * Permissions: CathaPermissions (structured actions per module)
 */
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { CathaPermissions, normalizePermissions } from '@/lib/catha-permissions-model'

export type CathaUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'PENDING'
export type CathaUserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED'

export interface CathaUser {
  _id?: ObjectId
  email: string
  name: string
  image?: string
  role: CathaUserRole
  status: CathaUserStatus
  permissions: CathaPermissions
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_users'

export async function getCathaUserByEmail(email: string): Promise<CathaUser | null> {
  const client = await clientPromise
  const doc = await client.db(DB_NAME).collection(COLLECTION).findOne({ email })
  if (!doc) return null
  return {
    _id: doc._id,
    email: doc.email,
    name: doc.name ?? '',
    image: doc.image,
    role: (doc.role ?? 'PENDING') as CathaUserRole,
    status: (doc.status ?? 'PENDING') as CathaUserStatus,
    permissions: normalizePermissions(doc.permissions),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    lastLogin: doc.lastLogin ? (doc.lastLogin instanceof Date ? doc.lastLogin : new Date(doc.lastLogin)) : undefined,
  }
}

export async function createCathaUser(data: {
  email: string
  name: string
  image?: string
  role?: CathaUserRole
  status?: CathaUserStatus
  permissions?: CathaPermissions
}): Promise<CathaUser> {
  const client = await clientPromise
  const now = new Date()
  const permissions = normalizePermissions(data.permissions)
  const doc = {
    email: data.email,
    name: data.name ?? '',
    image: data.image ?? null,
    role: data.role ?? 'PENDING',
    status: data.status ?? 'PENDING',
    permissions,
    createdAt: now,
    updatedAt: now,
  }
  const res = await client.db(DB_NAME).collection(COLLECTION).insertOne(doc)
  return {
    _id: res.insertedId,
    ...doc,
    permissions: doc.permissions,
  } as CathaUser
}

export async function updateCathaUser(
  email: string,
  updates: Partial<Pick<CathaUser, 'role' | 'status' | 'permissions' | 'name' | 'image'>>
): Promise<CathaUser | null> {
  const client = await clientPromise
  const $set: Record<string, unknown> = { ...updates, updatedAt: new Date() }
  const doc = await client.db(DB_NAME).collection(COLLECTION).findOneAndUpdate(
    { email },
    { $set },
    { returnDocument: 'after' }
  )
  if (!doc) return null
  return {
    _id: doc._id,
    email: doc.email,
    name: doc.name ?? '',
    image: doc.image,
    role: (doc.role ?? 'PENDING') as CathaUserRole,
    status: (doc.status ?? 'PENDING') as CathaUserStatus,
    permissions: normalizePermissions(doc.permissions),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    lastLogin: doc.lastLogin ? (doc.lastLogin instanceof Date ? doc.lastLogin : new Date(doc.lastLogin)) : undefined,
  }
}

export async function updateCathaUserLastLogin(email: string): Promise<void> {
  const client = await clientPromise
  await client.db(DB_NAME).collection(COLLECTION).updateOne(
    { email },
    { $set: { lastLogin: new Date(), updatedAt: new Date() } }
  )
}

export async function getAllCathaUsers(): Promise<CathaUser[]> {
  const client = await clientPromise
  const cursor = client.db(DB_NAME).collection(COLLECTION).find({}).sort({ createdAt: -1 })
  const list = await cursor.toArray()
  return list.map((doc) => ({
    _id: doc._id,
    email: doc.email,
    name: doc.name ?? '',
    image: doc.image,
    role: (doc.role ?? 'PENDING') as CathaUserRole,
    status: (doc.status ?? 'PENDING') as CathaUserStatus,
    permissions: normalizePermissions(doc.permissions),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    lastLogin: doc.lastLogin ? (doc.lastLogin instanceof Date ? doc.lastLogin : new Date(doc.lastLogin)) : undefined,
  }))
}

export async function ensureCathaUserIndexes(): Promise<void> {
  const client = await clientPromise
  const col = client.db(DB_NAME).collection(COLLECTION)
  await col.createIndex({ email: 1 }, { unique: true })
}
