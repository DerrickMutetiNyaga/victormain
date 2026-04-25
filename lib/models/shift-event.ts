import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export type ShiftEventType =
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'CLOSE'
  | 'BREAK_START'
  | 'BREAK_END'
  | 'PENDING_CLOSURE'
  | 'FORCE_CLOSE'
  | 'EDIT'
  | 'ISSUE_REPORTED'

export interface ShiftEvent {
  _id?: ObjectId
  shiftId: string
  staffUserId: string
  eventType: ShiftEventType
  actorUserId: string
  actorName: string
  reason?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_events'

export async function ensureShiftEventIndexes() {
  const client = await clientPromise
  const col = client.db(DB_NAME).collection(COLLECTION)
  await col.createIndex({ shiftId: 1, createdAt: -1 }, { name: 'shift_events_shift_created_idx' })
  await col.createIndex({ eventType: 1, createdAt: -1 }, { name: 'shift_events_type_created_idx' })
}

export async function createShiftEvent(event: Omit<ShiftEvent, '_id' | 'createdAt'>): Promise<ShiftEvent> {
  const client = await clientPromise
  const doc: ShiftEvent = { ...event, createdAt: new Date() }
  const res = await client.db(DB_NAME).collection<ShiftEvent>(COLLECTION).insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function findShiftEventByRequestId(
  staffUserId: string,
  eventType: ShiftEventType,
  requestId: string
): Promise<ShiftEvent | null> {
  const client = await clientPromise
  return client.db(DB_NAME).collection<ShiftEvent>(COLLECTION).findOne(
    {
      staffUserId,
      eventType,
      'metadata.requestId': requestId,
    },
    { sort: { createdAt: -1 } }
  )
}
