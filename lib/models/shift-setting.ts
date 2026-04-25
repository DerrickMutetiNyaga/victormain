import clientPromise from '@/lib/mongodb'

export interface ShiftSettings {
  openingTime: string
  closingTime: string
  graceLatenessMinutes: number
  autoReminders: boolean
  requireFloat: boolean
  requireCashCount: boolean
  smsEnabled: boolean
  autoCloseAfterInactiveHours: number
  breakTracking: boolean
  overtimeHourlyRate: number
  updatedAt: Date
  updatedBy?: string
}

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shift_settings'
const SETTINGS_ID = 'catha_shift_settings'

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  openingTime: '08:00',
  closingTime: '23:00',
  graceLatenessMinutes: 5,
  autoReminders: true,
  requireFloat: false,
  requireCashCount: false,
  smsEnabled: false,
  autoCloseAfterInactiveHours: 8,
  breakTracking: true,
  overtimeHourlyRate: 0,
  updatedAt: new Date(),
}

export async function ensureShiftSettingsIndexes() {
  const client = await clientPromise
  await client.db(DB_NAME).collection(COLLECTION).createIndex({ _id: 1 }, { unique: true })
}

export async function getShiftSettings(): Promise<ShiftSettings> {
  const client = await clientPromise
  const doc = await client.db(DB_NAME).collection(COLLECTION).findOne({ _id: SETTINGS_ID })
  if (!doc) return { ...DEFAULT_SHIFT_SETTINGS }
  return {
    openingTime: doc.openingTime ?? DEFAULT_SHIFT_SETTINGS.openingTime,
    closingTime: doc.closingTime ?? DEFAULT_SHIFT_SETTINGS.closingTime,
    graceLatenessMinutes: Number(doc.graceLatenessMinutes ?? DEFAULT_SHIFT_SETTINGS.graceLatenessMinutes),
    autoReminders: Boolean(doc.autoReminders ?? DEFAULT_SHIFT_SETTINGS.autoReminders),
    requireFloat: Boolean(doc.requireFloat ?? DEFAULT_SHIFT_SETTINGS.requireFloat),
    requireCashCount: Boolean(doc.requireCashCount ?? DEFAULT_SHIFT_SETTINGS.requireCashCount),
    smsEnabled: Boolean(doc.smsEnabled ?? DEFAULT_SHIFT_SETTINGS.smsEnabled),
    autoCloseAfterInactiveHours: Number(
      doc.autoCloseAfterInactiveHours ?? DEFAULT_SHIFT_SETTINGS.autoCloseAfterInactiveHours
    ),
    breakTracking: Boolean(doc.breakTracking ?? DEFAULT_SHIFT_SETTINGS.breakTracking),
    overtimeHourlyRate: Number(doc.overtimeHourlyRate ?? DEFAULT_SHIFT_SETTINGS.overtimeHourlyRate),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
  }
}

export async function saveShiftSettings(
  updates: Partial<ShiftSettings> & { updatedBy?: string }
): Promise<ShiftSettings> {
  const current = await getShiftSettings()
  const next: ShiftSettings = {
    ...current,
    ...updates,
    updatedAt: new Date(),
  }
  const client = await clientPromise
  await client
    .db(DB_NAME)
    .collection(COLLECTION)
    .updateOne({ _id: SETTINGS_ID }, { $set: next }, { upsert: true })
  return next
}
