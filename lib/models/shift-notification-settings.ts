import clientPromise from '@/lib/mongodb'
import { normalizePhoneNumbers } from '@/lib/jaba-sms'

export interface ShiftNotificationSettings {
  enabled: boolean
  numbers: string[]
  clockIn: boolean
  clockOut: boolean
  suspicious: boolean
  cashVariance: boolean
  updatedAt: Date
  updatedBy?: string
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_settings'
const SETTINGS_ID = 'catha_shift_notifications'

const DEFAULT_SETTINGS: ShiftNotificationSettings = {
  enabled: false,
  numbers: [],
  clockIn: true,
  clockOut: true,
  suspicious: true,
  cashVariance: true,
  updatedAt: new Date(),
}

export async function getShiftNotificationSettings(): Promise<ShiftNotificationSettings> {
  const client = await clientPromise
  const doc = await client.db(DB_NAME).collection(COLLECTION).findOne({ _id: SETTINGS_ID })
  if (!doc) return { ...DEFAULT_SETTINGS }
  return {
    enabled: Boolean(doc.enabled),
    numbers: normalizePhoneNumbers(doc.numbers ?? []),
    clockIn: Boolean(doc.clockIn ?? true),
    clockOut: Boolean(doc.clockOut ?? true),
    suspicious: Boolean(doc.suspicious ?? true),
    cashVariance: Boolean(doc.cashVariance ?? true),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
  }
}

export async function saveShiftNotificationSettings(
  updates: Partial<ShiftNotificationSettings> & { updatedBy?: string }
) {
  const current = await getShiftNotificationSettings()
  const next: ShiftNotificationSettings = {
    ...current,
    ...updates,
    numbers: normalizePhoneNumbers(updates.numbers ?? current.numbers),
    updatedAt: new Date(),
  }
  const client = await clientPromise
  await client.db(DB_NAME).collection(COLLECTION).updateOne({ _id: SETTINGS_ID }, { $set: next }, { upsert: true })
  return next
}
