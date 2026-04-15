import clientPromise from '@/lib/mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { normalizePhoneNumbers, sendJabaSmsStrict } from '@/lib/jaba-sms'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shop_auth_otps'
const OTP_EXPIRY_MINUTES = 10
/** Minimum seconds between OTP send requests for the same number */
const SEND_COOLDOWN_MS = 45 * 1000

const KENYA_FULL_REGEX = /^\+254\d{9}$/

export function normalizeShopAuthPhone(raw: string): string | null {
  const normalized = normalizeKenyaPhone(raw)
  if (!normalized) return null
  if (!KENYA_FULL_REGEX.test(normalized)) return null
  return normalized
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function requestShopAuthOtp(phone: string): Promise<void> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const coll = db.collection(COLLECTION)
  await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  await coll.createIndex({ phone: 1, createdAt: -1 }).catch(() => {})

  const now = new Date()
  const recent = await coll.findOne(
    { phone, createdAt: { $gt: new Date(now.getTime() - SEND_COOLDOWN_MS) } },
    { sort: { createdAt: -1 } }
  )
  if (recent) {
    throw new Error('Please wait a moment before requesting another code.')
  }

  await coll.deleteMany({ phone, used: false })

  const otp = generateOtp()
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await coll.insertOne({
    phone,
    otp,
    used: false,
    createdAt: now,
    expiresAt,
  })

  const targets = normalizePhoneNumbers(phone)
  const message = `Catha Lounge: Your code is ${otp}. Valid ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`
  await sendJabaSmsStrict(message, targets)
}

export async function verifyAndConsumeShopAuthOtp(phone: string, otp: string): Promise<boolean> {
  const trimmed = otp.trim()
  if (!/^\d{6}$/.test(trimmed)) return false

  const client = await clientPromise
  const db = client.db(DB_NAME)
  const coll = db.collection(COLLECTION)

  const doc = await coll.findOne(
    {
      phone,
      used: false,
      expiresAt: { $gt: new Date() },
    },
    { sort: { createdAt: -1 } }
  )

  if (!doc || String(doc.otp) !== trimmed) return false

  await coll.updateOne({ _id: doc._id }, { $set: { used: true, usedAt: new Date() } })
  return true
}
