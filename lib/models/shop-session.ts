import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { randomBytes } from 'crypto'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shop_sessions'

export interface ShopSessionDoc {
  sessionId: string
  phone: string
  userId: string
  createdAt: Date
  lastSeenAt: Date
}

/** Generate a cryptographically secure random session ID (64-char hex) */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex')
}

/** Create a new session - phone and userId stored in DB only, never in cookie */
export async function createShopSession(phone: string, userId: string): Promise<ShopSessionDoc> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const coll = db.collection<ShopSessionDoc>(COLLECTION)
  // Ensure index for fast lookups (idempotent)
  await coll.createIndex({ sessionId: 1 }, { unique: true }).catch(() => {})
  const now = new Date()
  const sessionId = generateSessionId()
  const doc: ShopSessionDoc = {
    sessionId,
    phone,
    userId,
    createdAt: now,
    lastSeenAt: now,
  }
  await coll.insertOne(doc)
  return doc
}

/** Get session by sessionId, update lastSeenAt */
export async function getShopSession(sessionId: string): Promise<ShopSessionDoc | null> {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 64 || !/^[a-f0-9]+$/.test(sessionId)) {
    return null
  }
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const now = new Date()
    const result = await db.collection<ShopSessionDoc>(COLLECTION).findOneAndUpdate(
      { sessionId },
      { $set: { lastSeenAt: now } },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    console.error('[ShopSession] Error fetching session:', error)
    return null
  }
}

/** Delete session (for logout) */
export async function deleteShopSession(sessionId: string): Promise<void> {
  if (!sessionId) return
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    await db.collection<ShopSessionDoc>(COLLECTION).deleteOne({ sessionId })
  } catch (error) {
    console.error('[ShopSession] Error deleting session:', error)
  }
}

