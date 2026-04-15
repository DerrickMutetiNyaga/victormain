/**
 * Catha Cashier PIN verification - server-side utility.
 * Pure Catha-only implementation using catha_users collection.
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import {
  getCathaUserByPinLookup,
  updateCathaUserPinFields,
  type CathaUser,
} from '@/lib/models/catha-user'

const MAX_FAILURES = 5
const LOCK_MINUTES = 15

/** In-memory rate limit: IP -> { count, resetAt } */
const ipAttempts = new Map<string, { count: number; resetAt: number }>()
const IP_RATE_WINDOW_MS = 60_000 // 1 minute
const IP_MAX_ATTEMPTS = 10

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipAttempts.get(ip)
  if (!entry) return false
  if (now > entry.resetAt) {
    ipAttempts.delete(ip)
    return false
  }
  return entry.count >= IP_MAX_ATTEMPTS
}

function recordIpAttempt(ip: string): void {
  const now = Date.now()
  const entry = ipAttempts.get(ip)
  if (!entry) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS })
    return
  }
  if (now > entry.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS })
    return
  }
  entry.count++
}

export type PinVerifyResult =
  | { ok: true; user: { id: string; email: string; name: string; role: string; status: string } }
  | { ok: false; reason: 'locked'; lockedUntil: Date }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_cashier' }
  | { ok: false; reason: 'inactive' }
  | { ok: false; reason: 'no_pin' }
  | { ok: false; reason: 'rate_limited' }

function getPinPepper(): string {
  const fromEnv = process.env.CATHA_PIN_PEPPER || process.env.NEXTAUTH_SECRET
  if (!fromEnv) {
    throw new Error('[catha-pin] CATHA_PIN_PEPPER or NEXTAUTH_SECRET must be set')
  }
  return fromEnv
}

export function computePinLookup(pin: string): string {
  const pepper = getPinPepper()
  return crypto.createHmac('sha256', pepper).update(pin).digest('hex')
}

/**
 * Verify cashier PIN against catha_users.
 * Increments failures, locks after MAX_FAILURES for LOCK_MINUTES.
 * On success, resets failures and lock.
 */
export async function verifyCashierPin(
  pin: string,
  clientIp?: string
): Promise<PinVerifyResult> {
  if (clientIp && checkIpRateLimit(clientIp)) {
    return { ok: false, reason: 'rate_limited' }
  }

  const lookup = computePinLookup(pin)
  const user = await getCathaUserByPinLookup(lookup)
  if (!user) return { ok: false, reason: 'not_found' }

  if (user.role !== 'CASHIER') return { ok: false, reason: 'not_cashier' }
  if (user.status !== 'ACTIVE') return { ok: false, reason: 'inactive' }
  if (!user.pinHash) return { ok: false, reason: 'no_pin' }

  const now = new Date()
  const lockedUntil = user.pinLockedUntil
  if (lockedUntil && new Date(lockedUntil) > now) {
    return { ok: false, reason: 'locked', lockedUntil: new Date(lockedUntil) }
  }

  const match = await bcrypt.compare(pin, user.pinHash)
  if (!match) {
    const failures = (user.pinFailedAttempts ?? 0) + 1
    let lockUntil: Date | null = null
    if (failures >= MAX_FAILURES) {
      lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000)
    }
    await updateCathaUserPinFields((user._id as any).toString(), {
      pinFailedAttempts: failures,
      pinLockedUntil: lockUntil,
    })
    if (clientIp) recordIpAttempt(clientIp)
    return { ok: false, reason: 'invalid' }
  }

  // Success: reset attempts and lock
  await updateCathaUserPinFields((user._id as any).toString(), {
    pinFailedAttempts: 0,
    pinLockedUntil: null,
  })

  const id = (user._id as { toString: () => string }).toString()
  return {
    ok: true,
    user: {
      id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
  }
}
