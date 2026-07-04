import crypto from 'crypto'
import type { Db } from 'mongodb'
import { getJabaPublicBaseUrl } from '@/lib/jaba-app-url'
import {
  approveManualMpesaVerification,
  rejectManualMpesaVerification,
} from '@/lib/catha-manual-mpesa-verification'

export const MANUAL_MPESA_APPROVAL_TOKENS = 'catha_manual_mpesa_approval_tokens'

export type ManualMpesaApprovalTokenDoc = {
  token: string
  verificationId: string
  expiresAt: Date
  usedAt: Date | null
  usedAction: 'approve' | 'reject' | null
  createdAt: Date
}

let ensureIndexesPromise: Promise<void> | null = null

async function ensureIndexes(db: Db): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = db
      .collection(MANUAL_MPESA_APPROVAL_TOKENS)
      .createIndex({ token: 1 }, { unique: true, name: 'mmat_token_unique' })
      .then(() => undefined)
      .catch((err) => {
        console.error('[manual-mpesa-approval-token] index error:', err)
        ensureIndexesPromise = null
      })
  }
  await ensureIndexesPromise
}

export function buildManualMpesaApprovalUrl(token: string): string {
  return `${getJabaPublicBaseUrl()}/approve-mpesa/${encodeURIComponent(token)}`
}

export async function createManualMpesaApprovalToken(
  db: Db,
  verificationId: string,
  expiryMinutes = 60
): Promise<{ token: string; expiresAt: Date; approveUrl: string }> {
  await ensureIndexes(db)
  const minutes = Math.max(15, Math.min(24 * 60, Math.round(expiryMinutes) || 60))
  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000)
  await db.collection(MANUAL_MPESA_APPROVAL_TOKENS).insertOne({
    token,
    verificationId,
    expiresAt,
    usedAt: null,
    usedAction: null,
    createdAt: new Date(),
  })
  return { token, expiresAt, approveUrl: buildManualMpesaApprovalUrl(token) }
}

export type ApprovalTokenPreview =
  | {
      ok: true
      verificationId: string
      transactionCode: string
      orderId: string
      amount: number
      enteredBy: string
      notes: string | null
      expiresAt: string
      expired: boolean
      used: boolean
    }
  | { ok: false; error: string; status: number }

export async function getApprovalTokenPreview(
  db: Db,
  token: string
): Promise<ApprovalTokenPreview> {
  const raw = String(token || '').trim()
  if (!raw) return { ok: false, error: 'Invalid link', status: 400 }

  const row = await db.collection(MANUAL_MPESA_APPROVAL_TOKENS).findOne({ token: raw })
  if (!row) return { ok: false, error: 'This approval link is invalid.', status: 404 }

  const verification = await db.collection('catha_manual_mpesa_verifications').findOne({
    id: row.verificationId,
  })
  if (!verification) {
    return { ok: false, error: 'The related verification request was not found.', status: 404 }
  }

  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt)
  const used = row.usedAt != null
  const expired = Date.now() > expiresAt.getTime()

  return {
    ok: true,
    verificationId: String(row.verificationId),
    transactionCode: String(verification.transactionCode || ''),
    orderId: String(verification.orderId || ''),
    amount: Number(verification.amount || 0),
    enteredBy: String(verification.enteredBy || '—'),
    notes: verification.notes != null ? String(verification.notes) : null,
    expiresAt: expiresAt.toISOString(),
    expired,
    used,
  }
}

export type ConsumeApprovalTokenResult =
  | { ok: true; action: 'approve' | 'reject'; orderId: string; transactionCode: string }
  | { ok: false; error: string; status: number }

export async function consumeManualMpesaApprovalToken(
  db: Db,
  token: string,
  action: 'approve' | 'reject',
  rejectionReason?: string | null
): Promise<ConsumeApprovalTokenResult> {
  await ensureIndexes(db)
  const raw = String(token || '').trim()
  if (!raw) return { ok: false, error: 'Invalid link', status: 400 }

  const now = new Date()
  const row = await db.collection<ManualMpesaApprovalTokenDoc>(MANUAL_MPESA_APPROVAL_TOKENS).findOneAndUpdate(
    {
      token: raw,
      usedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        usedAt: now,
        usedAction: action,
      },
    },
    { returnDocument: 'after' }
  )

  const doc = row as ManualMpesaApprovalTokenDoc | null
  if (!doc?.verificationId) {
    return {
      ok: false,
      error: 'This approval link has expired, already been used, or is invalid.',
      status: 410,
    }
  }

  const verificationId = String(doc.verificationId)

  if (action === 'approve') {
    const result = await approveManualMpesaVerification(
      db,
      verificationId,
      'SMS approval link',
      null
    )
    if (!result.ok) {
      await db.collection(MANUAL_MPESA_APPROVAL_TOKENS).updateOne(
        { token: raw },
        { $set: { usedAt: null, usedAction: null } }
      )
      return { ok: false, error: result.error, status: result.status }
    }
    return {
      ok: true,
      action: 'approve',
      orderId: result.verification.orderId,
      transactionCode: result.verification.transactionCode,
    }
  }

  const rejectResult = await rejectManualMpesaVerification(
    db,
    verificationId,
    'SMS approval link',
    rejectionReason ?? 'Rejected via SMS link',
    null
  )
  if (!rejectResult.ok) {
    await db.collection(MANUAL_MPESA_APPROVAL_TOKENS).updateOne(
      { token: raw },
      { $set: { usedAt: null, usedAction: null } }
    )
    return { ok: false, error: rejectResult.error, status: rejectResult.status }
  }

  return {
    ok: true,
    action: 'reject',
    orderId: rejectResult.verification.orderId,
    transactionCode: rejectResult.verification.transactionCode,
  }
}
