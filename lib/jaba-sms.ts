import clientPromise from '@/lib/mongodb'

const DB_NAME = 'infusion_jaba'
const SETTINGS_COLLECTION = 'jaba_settings'
const SETTINGS_ID = 'sms_notifications'

export interface JabaSmsEventSettings {
  batchCreated: boolean
  packagingCreated: boolean
  distributionCreated: boolean
  distributionDelivered: boolean
}

export interface JabaSmsSettings {
  enabled: boolean
  numbers: string[]
  events: JabaSmsEventSettings
  updatedAt: Date
  updatedBy?: string
}

export const DEFAULT_JABA_SMS_SETTINGS: JabaSmsSettings = {
  enabled: false,
  numbers: [],
  events: {
    batchCreated: true,
    packagingCreated: true,
    distributionCreated: true,
    distributionDelivered: false,
  },
  updatedAt: new Date(),
}

export function normalizePhoneNumbers(input: unknown): string[] {
  const raw =
    Array.isArray(input)
      ? input.map((v) => String(v ?? ''))
      : String(input ?? '')
          .split(',')
          .map((v) => v.trim())
  const cleaned = raw
    .map((n) => n.replace(/\s+/g, ''))
    .filter(Boolean)
    .map((n) => {
      const digits = n.replace(/[^\d+]/g, '')
      const noPlus = digits.startsWith('+') ? digits.slice(1) : digits

      // Kenya local format 07XXXXXXXX / 01XXXXXXXX -> +2547XXXXXXXX / +2541XXXXXXXX
      if (/^0\d{9}$/.test(noPlus)) {
        return `+254${noPlus.slice(1)}`
      }

      // Kenya intl without plus 254XXXXXXXXX -> +254XXXXXXXXX
      if (/^254\d{9}$/.test(noPlus)) {
        return `+${noPlus}`
      }

      // Already intl +XXXXXXXX
      if (/^\+\d{8,15}$/.test(digits)) {
        return digits
      }

      // Generic intl digits without plus
      if (/^\d{8,15}$/.test(noPlus)) {
        return `+${noPlus}`
      }

      return ''
    })
    .filter(Boolean)
  return [...new Set(cleaned)]
}

export async function getJabaSmsSettings(): Promise<JabaSmsSettings> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const doc = await db.collection(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_ID })
  if (!doc) {
    return { ...DEFAULT_JABA_SMS_SETTINGS }
  }
  return {
    enabled: Boolean(doc.enabled),
    numbers: normalizePhoneNumbers(doc.numbers ?? []),
    events: {
      batchCreated: Boolean(doc.events?.batchCreated),
      packagingCreated: Boolean(doc.events?.packagingCreated),
      distributionCreated: Boolean(doc.events?.distributionCreated),
      distributionDelivered: Boolean(doc.events?.distributionDelivered),
    },
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
  }
}

export async function saveJabaSmsSettings(settings: Partial<JabaSmsSettings> & { updatedBy?: string }) {
  const current = await getJabaSmsSettings()
  const next: JabaSmsSettings = {
    enabled: settings.enabled ?? current.enabled,
    numbers: normalizePhoneNumbers(settings.numbers ?? current.numbers),
    events: {
      batchCreated: settings.events?.batchCreated ?? current.events.batchCreated,
      packagingCreated: settings.events?.packagingCreated ?? current.events.packagingCreated,
      distributionCreated: settings.events?.distributionCreated ?? current.events.distributionCreated,
      distributionDelivered: settings.events?.distributionDelivered ?? current.events.distributionDelivered,
    },
    updatedAt: new Date(),
    updatedBy: settings.updatedBy,
  }

  const client = await clientPromise
  const db = client.db(DB_NAME)
  await db.collection(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_ID },
    { $set: next },
    { upsert: true }
  )
  return next
}

function isSmsConfigured(): boolean {
  return Boolean(
    process.env.ZETTATEL_USER_ID &&
      process.env.ZETTATEL_PASSWORD &&
      process.env.ZETTATEL_SENDER_ID
  )
}

export async function sendJabaSms(message: string, numbers: string[]) {
  if (!message.trim() || numbers.length === 0 || !isSmsConfigured()) return

  const endpoint = process.env.ZETTATEL_API_URL || 'https://portal.zettatel.com/SMSApi/send'
  const payload = new URLSearchParams({
    userId: process.env.ZETTATEL_USER_ID || '',
    password: process.env.ZETTATEL_PASSWORD || '',
    sendMethod: 'quick',
    mobile: numbers.join(','),
    msg: message,
    senderid: process.env.ZETTATEL_SENDER_ID || '',
    msgType: process.env.ZETTATEL_MSG_TYPE || 'text',
    duplicatecheck: 'true',
    output: 'json',
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (process.env.ZETTATEL_API_KEY) {
    headers.apikey = process.env.ZETTATEL_API_KEY
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: payload.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zettatel failed: ${res.status} ${text}`)
  }
}

export async function sendJabaSmsForEvent(event: keyof JabaSmsEventSettings, message: string) {
  try {
    const settings = await getJabaSmsSettings()
    if (!settings.enabled || !settings.events[event]) return
    await sendJabaSms(message, settings.numbers)
  } catch (error) {
    console.error(`[Jaba SMS] Failed to send ${event} SMS:`, error)
  }
}
