import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export type ShiftBreakType = 'TEA' | 'LUNCH' | 'EMERGENCY'

export interface ShiftBreak {
  _id?: ObjectId
  shiftId: string
  staffUserId: string
  breakType: ShiftBreakType
  startedAt: Date
  endedAt?: Date | null
  durationMinutes: number
  createdAt: Date
  updatedAt: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_breaks'

export async function ensureShiftBreakIndexes() {
  const client = await clientPromise
  const col = client.db(DB_NAME).collection(COLLECTION)
  await col.createIndex({ shiftId: 1, startedAt: -1 }, { name: 'shift_breaks_shift_idx' })
  await col.createIndex(
    { shiftId: 1, endedAt: 1 },
    { name: 'shift_break_single_open_idx', unique: true, partialFilterExpression: { endedAt: null } }
  )
}

export async function startShiftBreak(
  payload: Omit<ShiftBreak, '_id' | 'createdAt' | 'updatedAt' | 'endedAt' | 'durationMinutes'>
) {
  const client = await clientPromise
  const now = new Date()
  const doc: ShiftBreak = { ...payload, durationMinutes: 0, endedAt: null, createdAt: now, updatedAt: now }
  const res = await client.db(DB_NAME).collection<ShiftBreak>(COLLECTION).insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function getOpenBreak(shiftId: string) {
  const client = await clientPromise
  return client.db(DB_NAME).collection<ShiftBreak>(COLLECTION).findOne({ shiftId, endedAt: null })
}

export async function closeShiftBreak(shiftId: string, endedAt: Date) {
  const client = await clientPromise
  const open = await getOpenBreak(shiftId)
  if (!open) return null
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - open.startedAt.getTime()) / 60000))
  return client
    .db(DB_NAME)
    .collection<ShiftBreak>(COLLECTION)
    .findOneAndUpdate(
      { _id: open._id },
      { $set: { endedAt, durationMinutes, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
}

export async function getShiftBreakMinutes(shiftId: string): Promise<number> {
  const client = await clientPromise
  const rows = await client.db(DB_NAME).collection<ShiftBreak>(COLLECTION).find({ shiftId }).toArray()
  return rows.reduce((sum, row) => sum + (row.durationMinutes ?? 0), 0)
}
