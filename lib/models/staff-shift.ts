import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export type StaffShiftStatus =
  | 'ACTIVE'
  | 'PENDING_CLOSURE'
  | 'COMPLETED'
  | 'CLOSED_LATE'
  | 'FORGOT_CLOCK_OUT'
  | 'AUTO_CLOSED'
  | 'SUSPICIOUS'
  | 'EARLY_EXIT'
  | 'OVERTIME'

export interface StaffShift {
  _id?: ObjectId
  staffUserId: string
  staffName: string
  role: string
  businessDate: string
  timezone: 'Africa/Nairobi'
  status: StaffShiftStatus
  deviceFingerprint: string
  startedAt: Date
  endedAt?: Date | null
  clockOutAt?: Date | null
  scheduledStartAt: Date
  scheduledEndAt: Date
  openingFloat: number
  expectedDrawerAmount: number
  countedDrawerAmount?: number | null
  drawerVariance?: number | null
  cashSales: number
  mpesaSales: number
  totalRevenue: number
  ordersServed: number
  refunds: number
  discounts: number
  totalBreakMinutes: number
  notes?: string
  pendingClosureReason?: string
  pendingClosureAt?: Date | null
  forcedClosedBy?: string
  forcedCloseReason?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'staff_shifts'

export async function ensureStaffShiftIndexes() {
  const client = await clientPromise
  const col = client.db(DB_NAME).collection(COLLECTION)
  await col.createIndex({ staffUserId: 1, startedAt: -1 }, { name: 'shift_staff_started_idx' })
  await col.createIndex({ status: 1, startedAt: -1 }, { name: 'shift_status_started_idx' })
  await col.createIndex({ status: 1, scheduledEndAt: 1 }, { name: 'shift_status_scheduled_end_idx' })
  await col.createIndex({ clockOutAt: -1 }, { name: 'shift_clockout_idx' })
  await col.createIndex({ businessDate: 1, staffUserId: 1 }, { name: 'shift_business_staff_idx' })
  await col.createIndex(
    { staffUserId: 1, status: 1 },
    {
      name: 'active_shift_unique_per_staff',
      unique: true,
      partialFilterExpression: { status: { $in: ['ACTIVE', 'PENDING_CLOSURE'] } },
    }
  )
}

export async function listOverdueOpenStaffShifts(params: {
  overdueBefore: Date
  limit?: number
}): Promise<StaffShift[]> {
  const client = await clientPromise
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .find({
      status: { $in: ['ACTIVE', 'PENDING_CLOSURE'] },
      scheduledEndAt: { $lt: params.overdueBefore },
    })
    .sort({ scheduledEndAt: 1 })
    .limit(params.limit ?? 100)
    .toArray()
}

export async function createStaffShift(
  payload: Omit<StaffShift, '_id' | 'createdAt' | 'updatedAt'>
): Promise<StaffShift> {
  const client = await clientPromise
  const now = new Date()
  const doc: StaffShift = { ...payload, createdAt: now, updatedAt: now }
  const res = await client.db(DB_NAME).collection<StaffShift>(COLLECTION).insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function getActiveStaffShiftByUserId(staffUserId: string): Promise<StaffShift | null> {
  const client = await clientPromise
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .findOne({ staffUserId, status: { $in: ['ACTIVE', 'PENDING_CLOSURE'] } })
}

export async function getShiftById(id: string): Promise<StaffShift | null> {
  const client = await clientPromise
  return client.db(DB_NAME).collection<StaffShift>(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function updateStaffShift(id: string, updates: Partial<StaffShift>): Promise<StaffShift | null> {
  const client = await clientPromise
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
}

export async function transitionActiveShift(
  id: string,
  updates: Partial<StaffShift>,
  expectedStatuses: StaffShiftStatus[] = ['ACTIVE', 'PENDING_CLOSURE']
): Promise<StaffShift | null> {
  const client = await clientPromise
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .findOneAndUpdate(
      { _id: new ObjectId(id), status: { $in: expectedStatuses } },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
}

export async function getLatestStaffShiftByUserId(staffUserId: string): Promise<StaffShift | null> {
  const client = await clientPromise
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .find({ staffUserId })
    .sort({ startedAt: -1 })
    .limit(1)
    .next()
}

export async function listStaffShifts(filters: {
  staffUserId?: string
  from?: Date
  to?: Date
  statuses?: StaffShiftStatus[]
  limit?: number
}): Promise<StaffShift[]> {
  const client = await clientPromise
  const query: Record<string, unknown> = {}
  if (filters.staffUserId) query.staffUserId = filters.staffUserId
  if (filters.statuses?.length) query.status = { $in: filters.statuses }
  if (filters.from || filters.to) {
    query.startedAt = {}
    if (filters.from) (query.startedAt as Record<string, unknown>).$gte = filters.from
    if (filters.to) (query.startedAt as Record<string, unknown>).$lte = filters.to
  }
  return client
    .db(DB_NAME)
    .collection<StaffShift>(COLLECTION)
    .find(query)
    .sort({ startedAt: -1 })
    .limit(filters.limit ?? 100)
    .toArray()
}
