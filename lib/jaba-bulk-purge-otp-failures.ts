import type { Db } from 'mongodb'
import { hashJabaBulkPurgeToken } from '@/lib/jaba-bulk-purge-crypto'

const COLLECTION = 'jaba_bulk_batch_purge_tokens'
const MAX_OTP_ATTEMPTS = 5

/** After too many wrong OTPs, the purge session is voided (must prepare again). */
export async function recordBulkPurgeOtpFailure(db: Db, rawPurgeToken: string): Promise<void> {
  const tokenHash = hashJabaBulkPurgeToken(rawPurgeToken)
  const r = await db.collection(COLLECTION).findOneAndUpdate(
    { tokenHash, consumed: false },
    { $inc: { otpFailedAttempts: 1 }, $set: { lastOtpFailureAt: new Date() } },
    { returnDocument: 'after' }
  )
  const n = Number((r.value as { otpFailedAttempts?: number } | null)?.otpFailedAttempts) || 0
  if (n >= MAX_OTP_ATTEMPTS) {
    await db.collection(COLLECTION).updateOne(
      { tokenHash },
      {
        $set: {
          consumed: true,
          invalidatedAt: new Date(),
          invalidatedReason: 'otp_brute',
        },
      }
    )
  }
}
