/**
 * CATHA Cashier PIN verification - server-side utility.
 * Used by Credentials provider in NextAuth authorize().
 */

import bcrypt from 'bcryptjs'
import { getBarUserById, updateBarUserPinFields } from '@/lib/models/bar-user'

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

/**
 * Verify cashier PIN. Increments failures, locks after 5 failures for 15 minutes.
 * On success, resets failures and lock.
 */
export async function verifyCashierPin(
  cashierId: string,
  pin: string,
  clientIp?: string
): Promise<PinVerifyResult> {
  if (clientIp && checkIpRateLimit(clientIp)) {
    return { ok: false, reason: 'rate_limited' }
  }

  const user = await getBarUserById(cashierId)
  if (!user) return { ok: false, reason: 'not_found' }

  if (user.role !== 'cashier_admin') return { ok: false, reason: 'not_cashier' }
  if (user.status !== 'active') return { ok: false, reason: 'inactive' }
  if (!user.cashierPinHash) return { ok: false, reason: 'no_pin' }

  const now = new Date()
  const lockedUntil = user.cashierPinLockedUntil
  if (lockedUntil && new Date(lockedUntil) > now) {
    return { ok: false, reason: 'locked', lockedUntil: new Date(lockedUntil) }
  }

  const match = await bcrypt.compare(pin, user.cashierPinHash)
  if (!match) {
    const failures = (user.cashierPinFailedAttempts ?? 0) + 1
    let lockUntil: Date | null = null
    if (failures >= MAX_FAILURES) {
      lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000)
    }
    await updateBarUserPinFields(cashierId, {
      cashierPinFailedAttempts: failures,
      cashierPinLockedUntil: lockUntil,
    })
    if (clientIp) recordIpAttempt(clientIp)
    return { ok: false, reason: 'invalid' }
  }

  // Success: reset attempts and lock
  await updateBarUserPinFields(cashierId, {
    cashierPinFailedAttempts: 0,
    cashierPinLockedUntil: null,
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
