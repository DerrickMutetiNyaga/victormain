import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import clientPromise from '@/lib/mongodb'
import { requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { assertJabaStatefulRequestOrigin } from '@/lib/jaba-destructive-request-guard'
import { hashJabaBulkPurgeToken } from '@/lib/jaba-bulk-purge-crypto'
import { insertJabaSecurityAudit } from '@/lib/jaba-security-audit'

export const runtime = 'nodejs'

const COLLECTION = 'jaba_bulk_batch_purge_tokens'
const TOKEN_TTL_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const originBlock = assertJabaStatefulRequestOrigin(request)
  if (originBlock) return originBlock

  const adminGate = await requireJabaSuperAdminDb({
    forbiddenMessage: 'Only super admins can prepare a purge of all root batches',
  })
  if ('response' in adminGate) return adminGate.response
  const email = adminGate.email

  const ip = getClientIp(request)
  const ua = request.headers.get('user-agent')
  const rlEmail = checkRateLimit(`jaba-bulk-purge-prepare:${email}`, 6, 60 * 60 * 1000)
  if (!rlEmail.ok) {
    return NextResponse.json(
      { error: 'Too many purge preparations. Try again later.', retryAfterMs: rlEmail.retryAfterMs },
      { status: 429 }
    )
  }
  const rlIp = checkRateLimit(`jaba-bulk-purge-prepare-ip:${ip}`, 20, 60 * 60 * 1000)
  if (!rlIp.ok) {
    return NextResponse.json({ error: 'Too many requests from this network.' }, { status: 429 })
  }

  const purgeToken = randomBytes(28).toString('hex')
  const tokenHash = hashJabaBulkPurgeToken(purgeToken)
  const now = new Date()
  const client = await clientPromise
  const db = client.db('infusion_jaba')

  try {
    await db
      .collection(COLLECTION)
      .createIndex({ tokenHash: 1 }, { unique: true, name: 'uniq_bulk_purge_token_hash' })
    await db
      .collection(COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_bulk_purge_token' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('already exists') && !msg.includes('same name')) {
      console.warn('[bulk-delete-prepare] index ensure:', msg)
    }
  }

  await db.collection(COLLECTION).insertOne({
    tokenHash,
    requestedBy: email,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    consumed: false,
    otpFailedAttempts: 0,
  })

  await insertJabaSecurityAudit(db, {
    type: 'bulk_batch_purge_prepare',
    actorEmail: email,
    ip,
    userAgent: ua,
    meta: { tokenHashPrefix: tokenHash.slice(0, 12), expiresInMinutes: Math.round(TOKEN_TTL_MS / 60_000) },
  })

  return NextResponse.json({
    success: true,
    purgeToken,
    expiresInMinutes: Math.round(TOKEN_TTL_MS / 60_000),
  })
}
