import { randomBytes } from 'crypto'
import type { ClientSession, Db } from 'mongodb'

const COLLECTION = 'jaba_deliveryNotes'
const FIELD = 'publicShortToken' as const

/** Alphanumeric mixed-case codes (readable in SMS, no slashes or dots). */
const SHORT_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** 8 random characters (~47 bits); not derived from note numbers. */
export function newPublicShortToken(): string {
  const bytes = randomBytes(12)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += SHORT_CODE_ALPHABET[bytes[i]! % SHORT_CODE_ALPHABET.length]!
  }
  return out
}

export async function generateUniquePublicShortToken(
  db: Db,
  maxAttempts = 16,
  session?: ClientSession
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const t = newPublicShortToken()
    const clash = await db
      .collection(COLLECTION)
      .findOne({ [FIELD]: t }, { projection: { _id: 1 }, session })
    if (!clash) return t
  }
  return newPublicShortToken() + newPublicShortToken().slice(0, 4)
}
