import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_staff_users'

export interface CathaStaffUserPermissions {
  [pageId: string]: { view: boolean; edit: boolean; delete: boolean }
}

export interface CathaStaffUser {
  _id?: ObjectId
  id: string
  name: string
  username: string
  email: string
  role: 'admin' | 'manager' | 'cashier' | 'waiter'
  status: 'active' | 'inactive'
  avatar?: string
  permissions: CathaStaffUserPermissions
  createdAt: Date
  lastLogin?: Date
}

export async function getAllCathaStaffUsers(): Promise<CathaStaffUser[]> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const users = await db
    .collection<CathaStaffUser>(COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .toArray()
  return users.map((u) => ({
    ...u,
    createdAt: u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt),
    lastLogin: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin : new Date(u.lastLogin)) : undefined,
  }))
}

export async function createCathaStaffUser(data: Omit<CathaStaffUser, '_id' | 'createdAt'>): Promise<CathaStaffUser> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const doc = { ...data, createdAt: new Date() }
  const result = await db.collection<CathaStaffUser>(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateCathaStaffUser(id: string, updates: Partial<CathaStaffUser>): Promise<CathaStaffUser | null> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const result = await db.collection<CathaStaffUser>(COLLECTION).findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: 'after' }
  )
  return result
}

export async function deleteCathaStaffUser(id: string): Promise<boolean> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const result = await db.collection<CathaStaffUser>(COLLECTION).deleteOne({ id })
  return result.deletedCount === 1
}

export async function seedDefaultCathaStaffUsers(defaults: CathaStaffUser[]): Promise<void> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const count = await db.collection<CathaStaffUser>(COLLECTION).countDocuments()
  if (count === 0 && defaults.length > 0) {
    const toInsert = defaults.map((u) => ({
      ...u,
      createdAt: u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt),
      lastLogin: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin : new Date(u.lastLogin)) : undefined,
    }))
    await db.collection<CathaStaffUser>(COLLECTION).insertMany(toInsert)
  }
}
