import { getCathaSession } from '@/lib/catha-auth'
import { getCathaUserByEmail, getCathaUserById } from '@/lib/models/catha-user'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { getDatabase } from '@/lib/mongodb'
import { EAT_TIME_ZONE, evaluateLateness, getEatBusinessDate, getScheduledEatDate, isEarlyExit, isOvertime } from '@/lib/catha-shift-time'
import type { StaffShiftStatus } from '@/lib/models/staff-shift'
import { calculateShiftOrderStatsFromRows } from '@/lib/catha-shift-order-stats'

export async function requireShiftSessionUser() {
  const session = await getCathaSession()
  if (!session?.user?.email) return { ok: false as const, status: 401, error: 'Unauthorized' }
  const user = await getCathaUserByEmail(session.user.email)
  if (!user?._id) return { ok: false as const, status: 404, error: 'User not found' }
  return {
    ok: true as const,
    session,
    user,
    userId: user._id.toString(),
    role: String(user.role || '').toUpperCase(),
    name: user.name || session.user.name || session.user.email || 'Staff',
  }
}

export async function requireActiveShiftByEmail(email: string, options?: { allowSuperAdmin?: boolean }) {
  const user = await getCathaUserByEmail(email)
  if (!user?._id) return { ok: false as const, status: 404, error: 'User not found' }
  const role = String(user.role || '').trim().toUpperCase()
  if (options?.allowSuperAdmin && role === 'SUPER_ADMIN') {
    return { ok: true as const, userId: user._id.toString(), role, shift: null, user }
  }
  const shift = await getActiveStaffShiftByUserId(user._id.toString())
  if (!shift) {
    return { ok: false as const, status: 403, error: 'Active shift required before performing this action.' }
  }
  return { ok: true as const, userId: user._id.toString(), role, shift, user }
}

type ShiftGuardOptions = {
  allowSuperAdmin?: boolean
  allowedStatuses?: StaffShiftStatus[]
}

export async function requireActiveShiftForSessionUser(
  sessionUser: { email?: string | null; userId?: string | null; id?: string | null; _id?: string | null },
  options?: ShiftGuardOptions
) {
  const idCandidate = String(sessionUser.userId || sessionUser.id || sessionUser._id || '').trim()
  const email = String(sessionUser.email || '').trim()
  const user =
    (idCandidate ? await getCathaUserById(idCandidate) : null) ??
    (email ? await getCathaUserByEmail(email) : null)

  if (!user?._id) return { ok: false as const, status: 404, error: 'User not found' }

  const role = String(user.role || '').trim().toUpperCase()
  if (options?.allowSuperAdmin && role === 'SUPER_ADMIN') {
    return { ok: true as const, userId: user._id.toString(), role, shift: null, user }
  }

  const shift = await getActiveStaffShiftByUserId(user._id.toString())
  if (!shift) {
    return { ok: false as const, status: 403, error: 'Active shift required before performing this action.' }
  }
  const allowedStatuses = options?.allowedStatuses ?? ['ACTIVE', 'PENDING_CLOSURE']
  if (!allowedStatuses.includes(shift.status)) {
    return {
      ok: false as const,
      status: 403,
      error: `Shift status ${shift.status} does not allow this action.`,
    }
  }

  return { ok: true as const, userId: user._id.toString(), role, shift, user }
}

export function getDeviceFingerprint(headers: Headers): string {
  const ua = headers.get('user-agent') || 'unknown'
  const lang = headers.get('accept-language') || 'unknown'
  const forwarded = headers.get('x-forwarded-for') || 'unknown'
  return `${ua.slice(0, 60)}|${lang}|${forwarded}`.slice(0, 180)
}

export function deriveShiftStatusOnClose(params: {
  scheduledEndAt: Date
  endedAt: Date
  pendingClosure: boolean
}): StaffShiftStatus {
  if (params.pendingClosure) return 'FORGOT_CLOCK_OUT'
  if (isEarlyExit(params.scheduledEndAt, params.endedAt)) return 'EARLY_EXIT'
  if (isOvertime(params.scheduledEndAt, params.endedAt)) return 'OVERTIME'
  return 'COMPLETED'
}

export function getScheduleForNow(openingTime: string, closingTime: string) {
  const now = new Date()
  const scheduledStartAt = getScheduledEatDate(openingTime, now)
  const scheduledEndAt = getScheduledEatDate(closingTime, now)
  return {
    now,
    scheduledStartAt,
    scheduledEndAt,
    businessDate: getEatBusinessDate(now),
    timezone: EAT_TIME_ZONE,
    latenessBand: evaluateLateness(scheduledStartAt, now),
  }
}

export async function aggregateShiftOrderStats(staffName: string, startedAt: Date, endedAt: Date = new Date()) {
  const db = await getDatabase('infusion_jaba')
  const rows = await db
    .collection('orders')
    .find({
      timestamp: { $gte: startedAt, $lte: endedAt },
      cashier: staffName,
    })
    .toArray()
  return calculateShiftOrderStatsFromRows(rows)
}
