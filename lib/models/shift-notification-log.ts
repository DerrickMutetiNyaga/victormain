import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export type ShiftNotificationType = 'CLOCK_IN' | 'CLOCK_OUT' | 'SUSPICIOUS' | 'CASH_VARIANCE'

export interface ShiftNotificationLog {
  _id?: ObjectId
  shiftId?: string
  type: ShiftNotificationType
  dedupeKey?: string
  recipients: string[]
  message: string
  success: boolean
  error?: string
  createdAt: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_notifications_log'

export async function ensureShiftNotificationLogIndexes() {
  const client = await clientPromise
  const col = client.db(DB_NAME).collection(COLLECTION)
  await col.createIndex({ createdAt: -1 }, { name: 'shift_notification_created_idx' })
  await col.createIndex({ shiftId: 1, createdAt: -1 }, { name: 'shift_notification_shift_idx' })
  await col.createIndex({ dedupeKey: 1, createdAt: -1 }, { name: 'shift_notification_dedupe_idx' })
}

export async function createShiftNotificationLog(
  payload: Omit<ShiftNotificationLog, '_id' | 'createdAt'>
): Promise<ShiftNotificationLog> {
  const client = await clientPromise
  const doc: ShiftNotificationLog = { ...payload, createdAt: new Date() }
  const res = await client.db(DB_NAME).collection<ShiftNotificationLog>(COLLECTION).insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function findRecentSuccessfulShiftNotificationByDedupeKey(
  dedupeKey: string,
  windowMinutes: number = 30
): Promise<ShiftNotificationLog | null> {
  const client = await clientPromise
  const from = new Date(Date.now() - Math.max(1, Math.round(windowMinutes)) * 60_000)
  return client
    .db(DB_NAME)
    .collection<ShiftNotificationLog>(COLLECTION)
    .findOne({
      dedupeKey,
      success: true,
      createdAt: { $gte: from },
    })
}
