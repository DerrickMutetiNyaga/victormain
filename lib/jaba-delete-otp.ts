import clientPromise from '@/lib/mongodb'
import { sendJabaSms } from '@/lib/jaba-sms'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'jaba_delete_otps'
const OTP_EXPIRY_MINUTES = 10

export type DeleteAction =
  | 'delete_batch'
  | 'delete_packaging'
  | 'delete_delivery_note'
  | 'delete_raw_material'
  | 'delete_supplier'
  | 'delete_distributor'
  | 'delete_flavor'
  | 'delete_user'
  | 'delete_flavour_output'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function requestDeleteOtp(params: {
  action: DeleteAction
  targetId: string
  requestedBy: string
}) {
  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  const targetNumber = (process.env.OT_NUMBER || '').trim()

  if (!targetNumber) {
    throw new Error('OT_NUMBER is not configured in environment variables')
  }

  const client = await clientPromise
  const db = client.db(DB_NAME)
  await db.collection(COLLECTION).insertOne({
    action: params.action,
    targetId: params.targetId,
    requestedBy: params.requestedBy,
    otp,
    used: false,
    createdAt: new Date(),
    expiresAt,
  })

  const message = `Jaba ${params.action} OTP: ${otp}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`
  await sendJabaSms(message, [targetNumber])
}

export async function verifyDeleteOtp(params: {
  action: DeleteAction
  targetId: string
  requestedBy: string
  otp: string
}): Promise<boolean> {
  const client = await clientPromise
  const db = client.db(DB_NAME)

  const doc = await db.collection(COLLECTION).findOne(
    {
      action: params.action,
      targetId: params.targetId,
      requestedBy: params.requestedBy,
      used: false,
      expiresAt: { $gt: new Date() },
    },
    { sort: { createdAt: -1 } }
  )

  if (!doc || String(doc.otp) !== params.otp.trim()) return false

  await db.collection(COLLECTION).updateOne(
    { _id: doc._id },
    { $set: { used: true, usedAt: new Date() } }
  )

  return true
}
