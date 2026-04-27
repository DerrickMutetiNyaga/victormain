import { createShiftEvent } from '@/lib/models/shift-event'
import {
  acquireShiftCloseNotificationLock,
  getLatestStaffShiftByUserId,
  markShiftCloseNotificationFailure,
  markShiftCloseNotificationSuccess,
  transitionActiveShift,
  type StaffShift,
} from '@/lib/models/staff-shift'
import { sendShiftNotification } from '@/lib/catha-shift-sms'
import { randomUUID } from 'crypto'
import { queueShiftUserSms } from '@/lib/catha-shift-user-sms'

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function sendShiftOpenedNotification(args: {
  shiftId: string
  message: string
  dedupeKey: string
}) {
  console.log('[ShiftLifecycle] notify open', {
    shiftId: args.shiftId,
    dedupeKey: args.dedupeKey,
  })
  await sendShiftNotification('CLOCK_IN', args.message, args.shiftId, {
    dedupeKey: args.dedupeKey,
    throwOnError: true,
  })
}

export async function closeShiftAndNotify(params: {
  shift: StaffShift
  actorUserId: string
  actorName: string
  closeReason: string
  closeEventType?: 'CLOSE' | 'FORCE_CLOSE'
  eventMetadata?: Record<string, unknown>
  expectedStatuses?: Array<'ACTIVE' | 'PENDING_CLOSURE' | 'AUTO_CLOSED'>
  updates: Partial<StaffShift>
  closeMessage: string
  dedupeKey: string
}) {
  if (!params.shift?._id) {
    throw new Error('Shift not found for closeShiftAndNotify')
  }

  const shiftId = params.shift._id.toString()
  const expectedStatuses = params.expectedStatuses ?? ['ACTIVE', 'PENDING_CLOSURE']

  const closed = await transitionActiveShift(shiftId, params.updates, expectedStatuses as any)
  if (!closed) {
    const latest = await getLatestStaffShiftByUserId(params.shift.staffUserId)
    if (latest?.endedAt) return { shift: latest, replay: true as const }
    throw new Error('Shift close transition failed')
  }

  await createShiftEvent({
    shiftId,
    staffUserId: params.shift.staffUserId,
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    eventType: params.closeEventType ?? 'CLOSE',
    reason: params.closeReason,
    metadata: { lifecycleClose: true, ...(params.eventMetadata ?? {}) },
  })

  console.log('[ShiftLifecycle] notify close', {
    shiftId,
    reason: params.closeReason,
    dedupeKey: params.dedupeKey,
  })
  const lockId = randomUUID()
  const acquired = await acquireShiftCloseNotificationLock(shiftId, lockId)
  if (!acquired) {
    return { shift: closed, replay: true as const }
  }

  try {
    const smsTimeoutMs = Math.max(5_000, Number(process.env.CATHA_SHIFT_CLOSE_SMS_TIMEOUT_MS || 20_000))
    await withTimeout(
      sendShiftNotification('CLOCK_OUT', params.closeMessage, shiftId, {
        dedupeKey: params.dedupeKey,
        throwOnError: true,
      }),
      smsTimeoutMs,
      'close_notification_timeout'
    )
    await markShiftCloseNotificationSuccess(shiftId, lockId)
  } catch (error: any) {
    await markShiftCloseNotificationFailure(shiftId, lockId, error?.message || 'close_notification_failed')
    throw error
  }

  const closedAt = params.updates.endedAt ? new Date(params.updates.endedAt) : new Date()
  const closeTime = closedAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
  const isAutoClose = params.closeReason === 'overdue_auto_close_backlog'
  void queueShiftUserSms({
    userId: params.shift.staffUserId,
    shiftId,
    eventType: isAutoClose ? 'SHIFT_AUTO_CLOSED' : 'SHIFT_CLOSED',
    message: isAutoClose
      ? `Shift Auto-Closed: Hi ${params.shift.staffName}, your shift was automatically closed due to overtime at ${closeTime}.`
      : `Shift Closed: Hi ${params.shift.staffName}, your shift closed at ${closeTime}. Status: manual. Thank you.`,
  })

  return { shift: closed, replay: false as const }
}
