import { aggregateShiftOrderStats } from '@/lib/catha-shift-service'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'
import { getShiftSettings } from '@/lib/models/shift-setting'
import {
  type StaffShift,
  getActiveStaffShiftByUserId,
  getLatestStaffShiftByUserId,
  listOverdueOpenStaffShifts,
} from '@/lib/models/staff-shift'
import { isOverdueForAutoClose } from '@/lib/catha-shift-auto-close-utils'
import { closeShiftAndNotify } from '@/lib/catha-shift-lifecycle'

type AutoCloseConfig = {
  graceHours: number
  continueWindowHours: number
}

type AutoCloseResult = {
  autoClosed: StaffShift[]
  failures: Array<{ shiftId?: string; error: string }>
}

const OPEN_SHIFT_STATUSES = ['ACTIVE', 'PENDING_CLOSURE'] as const

function normalizeConfig(raw: Awaited<ReturnType<typeof getShiftSettings>>): AutoCloseConfig {
  const graceHours = Math.max(1, Math.min(12, Math.round(Number(raw.autoCloseGraceHours || 2))))
  const continueWindowHours = Math.max(1, Math.min(168, Math.round(Number(raw.continuePromptWindowHours || 24))))
  return { graceHours, continueWindowHours }
}

async function closeShiftAsSystem(shift: StaffShift, actorUserId = 'SYSTEM'): Promise<StaffShift | null> {
  if (!shift._id) return null
  const now = new Date()
  const closedAt = shift.scheduledEndAt ? new Date(shift.scheduledEndAt) : now
  const overdueByMs = Math.max(0, now.getTime() - closedAt.getTime())
  const delayedByMs = Math.max(0, overdueByMs - 2 * 60 * 60 * 1000)
  const crossedDayBoundary = now.toDateString() !== closedAt.toDateString()
  const closureContext = {
    strategy: 'expected' as const,
    wasDelayed: true,
    overdueByMs,
    delayedByMs,
    crossedDayBoundary,
    decidedAt: now.toISOString(),
    isCorrectedClosure: true,
  }
  const stats = await aggregateShiftOrderStats(shift.staffName, shift.startedAt, closedAt, [], shift.staffUserId)
  const expectedDrawerAmount = Number(shift.openingFloat || 0) + Number(stats.cashSales || 0)
  const countedDrawerAmount = Number(shift.countedDrawerAmount ?? expectedDrawerAmount)
  const drawerVariance = countedDrawerAmount - expectedDrawerAmount
  const durationMinutes = Math.max(0, Math.round((closedAt.getTime() - new Date(shift.startedAt).getTime()) / 60000))
  const overtimeMinutes = Math.max(
    0,
    Math.round((closedAt.getTime() - new Date(shift.scheduledEndAt).getTime()) / 60000)
  )

  const closeResult = await closeShiftAndNotify({
    shift,
    actorUserId,
    actorName: 'SYSTEM',
    closeEventType: 'FORCE_CLOSE',
    closeReason: 'overdue_auto_close_backlog',
    dedupeKey: `shift:auto-close:${shift._id.toString()}`,
    closeMessage: `[SHIFT AUTO CLOSED]\nUser: ${shift.staffName}\nReason: overdue_auto_close_backlog\nWorked: ${durationMinutes}m`,
    eventMetadata: { autoClosed: true, workedDurationMinutes: durationMinutes, overtimeMinutes },
    updates: {
      status: 'AUTO_CLOSED',
      endedAt: closedAt,
      clockOutAt: closedAt,
      countedDrawerAmount,
      expectedDrawerAmount,
      drawerVariance,
      cashSales: Number(stats.cashSales || 0),
      mpesaSales: Number(stats.mpesaSales || 0),
      totalRevenue: Number(stats.totalRevenue || 0),
      ordersServed: Number(stats.ordersServed || 0),
      refunds: Number(stats.refunds || 0),
      discounts: Number(stats.discounts || 0),
      pendingClosureAt: null,
      metadata: {
        ...(shift.metadata ?? {}),
        autoClosedBySystem: true,
        closedByType: 'SYSTEM',
        closeReason: 'overdue_auto_close_backlog',
        closeAtStrategy: closureContext.strategy,
        financialLocked: true,
        financialLockedAt: now.toISOString(),
        workedDurationMinutes: durationMinutes,
        overtimeMinutes,
        clockOutAt: closedAt.toISOString(),
      },
      closureContext: shift.closureContext ?? closureContext,
    },
  })
  if (closeResult.replay) return null
  const closed = closeResult.shift
  queueCathaAuditLog({
    type: 'SYSTEM',
    action: 'SHIFT_AUTO_CLOSE',
    status: 'SUCCESS',
    reason: 'overdue_auto_close_backlog',
    userId: shift.staffUserId,
    role: shift.role,
    shiftId: shift._id.toString(),
    endpoint: 'system:auto-close',
    payloadSummary: {
      graceHours: Math.round((now.getTime() - new Date(shift.scheduledEndAt).getTime()) / 3600000),
      workedDurationMinutes: durationMinutes,
      overtimeMinutes,
    },
  })
  return closed
}

export async function autoCloseOverdueShiftForUser(userId: string): Promise<AutoCloseResult> {
  const settings = normalizeConfig(await getShiftSettings())
  const active = await getActiveStaffShiftByUserId(userId)
  if (!active || !isOverdueForAutoClose(active, settings.graceHours)) {
    return { autoClosed: [], failures: [] }
  }
  const closed = await closeShiftAsSystem(active)
  return { autoClosed: closed ? [closed] : [], failures: [] }
}

export async function autoCloseOverdueShifts(options?: { limit?: number; batchSize?: number }): Promise<AutoCloseResult> {
  const settings = normalizeConfig(await getShiftSettings())
  const closed: StaffShift[] = []
  const failures: Array<{ shiftId?: string; error: string }> = []
  const max = Math.max(1, options?.limit ?? 5000)
  const batchSize = Math.max(1, Math.min(200, options?.batchSize ?? 100))
  const overdueBefore = new Date(Date.now() - settings.graceHours * 60 * 60 * 1000)

  while (closed.length + failures.length < max) {
    const left = max - (closed.length + failures.length)
    const batch = await listOverdueOpenStaffShifts({
      overdueBefore,
      limit: Math.min(batchSize, left),
    })
    if (batch.length === 0) break
    for (const shift of batch) {
      try {
        const done = await closeShiftAsSystem(shift)
        if (done) closed.push(done)
      } catch (error: any) {
        failures.push({
          shiftId: shift._id?.toString(),
          error: error?.message || 'auto_close_failed',
        })
        console.error('[shift-auto-close] failed shift', {
          shiftId: shift._id?.toString(),
          error: error?.message || error,
        })
      }
    }
  }
  return { autoClosed: closed, failures }
}

export async function getContinuePromptShiftForUser(userId: string) {
  const settings = normalizeConfig(await getShiftSettings())
  const latest = await getLatestStaffShiftByUserId(userId)
  const isRecentAutoClosed =
    latest &&
    latest.status === 'AUTO_CLOSED' &&
    Boolean((latest.metadata as { autoClosedBySystem?: boolean } | undefined)?.autoClosedBySystem) &&
    latest.endedAt &&
    Date.now() - new Date(latest.endedAt).getTime() <= settings.continueWindowHours * 60 * 60 * 1000

  if (!isRecentAutoClosed || !latest) return null
  return {
    _id: latest._id?.toString(),
    startedAt: latest.startedAt,
    endedAt: latest.endedAt,
    status: latest.status,
  }
}

let startupSweepTriggered = false
let firstRequestSweepTriggered = false

export function triggerStartupBacklogSweep(): void {
  if (startupSweepTriggered) return
  startupSweepTriggered = true
  void autoCloseOverdueShifts({ limit: 10_000, batchSize: 100 }).catch((error: any) => {
    console.error('[shift-auto-close] startup sweep failed', error?.message || error)
  })
}

export async function runFirstRequestBacklogSweep(): Promise<void> {
  if (firstRequestSweepTriggered) return
  firstRequestSweepTriggered = true
  await autoCloseOverdueShifts({ limit: 10_000, batchSize: 100 })
}

// Fire-and-forget deployment/startup sweep for existing overdue backlog.
if (process.env.NODE_ENV !== 'test') {
  triggerStartupBacklogSweep()
}
