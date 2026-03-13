import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'distributor_requests'

export interface DistributorRequestDoc {
  _id?: ObjectId
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address?: string
  products: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: Date
  reviewedAt?: Date
  notes?: string
}

export async function getAllDistributorRequests(): Promise<DistributorRequestDoc[]> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const requests = await db
    .collection<DistributorRequestDoc>(COLLECTION)
    .find({})
    .sort({ submittedAt: -1 })
    .toArray()
  return requests.map((r) => ({
    ...r,
    submittedAt: r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt),
    reviewedAt: r.reviewedAt ? (r.reviewedAt instanceof Date ? r.reviewedAt : new Date(r.reviewedAt)) : undefined,
  }))
}

export async function createDistributorRequest(data: Omit<DistributorRequestDoc, '_id'>): Promise<DistributorRequestDoc> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const doc = {
    ...data,
    submittedAt: data.submittedAt instanceof Date ? data.submittedAt : new Date(data.submittedAt),
    reviewedAt: data.reviewedAt ? (data.reviewedAt instanceof Date ? data.reviewedAt : new Date(data.reviewedAt)) : undefined,
  }
  const result = await db.collection<DistributorRequestDoc>(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateDistributorRequest(id: string, updates: Partial<DistributorRequestDoc>): Promise<DistributorRequestDoc | null> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const set: any = { ...updates }
  if (updates.reviewedAt) set.reviewedAt = updates.reviewedAt instanceof Date ? updates.reviewedAt : new Date(updates.reviewedAt)
  const result = await db.collection<DistributorRequestDoc>(COLLECTION).findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' })
  return result
}

export async function deleteDistributorRequest(id: string): Promise<boolean> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const result = await db.collection<DistributorRequestDoc>(COLLECTION).deleteOne({ id })
  return result.deletedCount === 1
}

export async function seedDefaultDistributorRequests(defaults: DistributorRequestDoc[]): Promise<void> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const count = await db.collection<DistributorRequestDoc>(COLLECTION).countDocuments()
  if (count === 0 && defaults.length > 0) {
    const toInsert = defaults.map((r) => ({
      ...r,
      submittedAt: r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt),
      reviewedAt: r.reviewedAt ? (r.reviewedAt instanceof Date ? r.reviewedAt : new Date(r.reviewedAt)) : undefined,
    }))
    await db.collection<DistributorRequestDoc>(COLLECTION).insertMany(toInsert)
  }
}
