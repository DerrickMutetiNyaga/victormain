import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface ShiftUserSmsLog {
  _id?: ObjectId
  userId: string
  phone: string
  message: string
  status: 'sent' | 'failed'
  eventType: 'SHIFT_OPENED' | 'SHIFT_CLOSED' | 'SHIFT_AUTO_CLOSED'
  shiftId?: string
  error?: string
  createdAt: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_user_sms_log'

export async function createShiftUserSmsLog(payload: Omit<ShiftUserSmsLog, '_id' | 'createdAt'>): Promise<void> {
  const client = await clientPromise
  await client.db(DB_NAME).collection<ShiftUserSmsLog>(COLLECTION).insertOne({
    ...payload,
    createdAt: new Date(),
  })
}

