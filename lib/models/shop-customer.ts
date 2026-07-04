import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shop_customers'

export interface ShopCustomerProfile {
  fullName?: string
  email?: string
  address?: string
  city?: string
  postalCode?: string
}

export interface ShopCustomer {
  _id?: ObjectId
  phone: string // normalized +254XXXXXXXX
  googleSub?: string
  profile?: ShopCustomerProfile
  createdAt: Date
  updatedAt?: Date
}

export async function getShopCustomerByPhone(phone: string): Promise<ShopCustomer | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const user = await db.collection<ShopCustomer>(COLLECTION).findOne({ phone })
    return user
  } catch (error) {
    console.error('[ShopCustomer] Error fetching by phone:', error)
    return null
  }
}

export async function getShopCustomerByGoogleSub(googleSub: string): Promise<ShopCustomer | null> {
  if (!googleSub) return null
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const user = await db.collection<ShopCustomer>(COLLECTION).findOne({ googleSub })
    return user
  } catch (error) {
    console.error("[ShopCustomer] Error fetching by googleSub:", error)
    return null
  }
}

export async function createShopCustomer(phone: string): Promise<ShopCustomer> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const doc: ShopCustomer = {
    phone,
    createdAt: new Date(),
  }
  const result = await db.collection<ShopCustomer>(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function findOrCreateShopCustomer(phone: string): Promise<{ customer: ShopCustomer; isNew: boolean }> {
  const existing = await getShopCustomerByPhone(phone)
  if (existing) return { customer: existing, isNew: false }
  const created = await createShopCustomer(phone)
  return { customer: created, isNew: true }
}

export async function findOrCreateShopCustomerFromGoogle(input: {
  googleSub: string
  email: string
  name?: string
}): Promise<{ customer: ShopCustomer; isNew: boolean }> {
  const { googleSub, email, name } = input
  const normalizedEmail = email.trim().toLowerCase()

  const existingBySub = await getShopCustomerByGoogleSub(googleSub)
  if (existingBySub) {
    const profile = {
      ...(existingBySub.profile ?? {}),
      email: normalizedEmail,
      fullName: name?.trim() || existingBySub.profile?.fullName || "",
    }
    const updated = await updateShopCustomerProfile(existingBySub.phone, profile)
    return { customer: updated ?? existingBySub, isNew: false }
  }

  const client = await clientPromise
  const db = client.db(DB_NAME)
  const coll = db.collection<ShopCustomer>(COLLECTION)
  const existingByEmail = await coll.findOne({ "profile.email": normalizedEmail })
  if (existingByEmail) {
    const now = new Date()
    const profile = {
      ...(existingByEmail.profile ?? {}),
      email: normalizedEmail,
      fullName: name?.trim() || existingByEmail.profile?.fullName || "",
    }
    const result = await coll.findOneAndUpdate(
      { _id: existingByEmail._id },
      { $set: { googleSub, profile, updatedAt: now } },
      { returnDocument: "after" }
    )
    return { customer: result ?? existingByEmail, isNew: false }
  }

  const now = new Date()
  const createdDoc: ShopCustomer = {
    phone: `google:${googleSub}`,
    googleSub,
    profile: {
      email: normalizedEmail,
      fullName: name?.trim() || "",
    },
    createdAt: now,
    updatedAt: now,
  }
  const created = await coll.insertOne(createdDoc)
  return { customer: { ...createdDoc, _id: created.insertedId }, isNew: true }
}

export async function updateShopCustomerProfile(phone: string, updates: Partial<ShopCustomerProfile>): Promise<ShopCustomer | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const now = new Date()
    const existing = await getShopCustomerByPhone(phone)
    const currentProfile = existing?.profile ?? {}
    const profile = { ...currentProfile, ...updates }
    const result = await db.collection<ShopCustomer>(COLLECTION).findOneAndUpdate(
      { phone },
      { $set: { profile, updatedAt: now } },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    console.error('[ShopCustomer] Error updating profile:', error)
    return null
  }
}
