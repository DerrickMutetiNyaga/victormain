import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { aggregateShiftOrderStats, deriveShiftStatusOnClose, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getShiftById, updateStaffShift } from '@/lib/models/staff-shift'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const shiftId = String(body.shiftId ?? '')
  if (!ObjectId.isValid(shiftId)) return NextResponse.json({ error: 'Invalid shiftId' }, { status: 400 })
  const shift = await getShiftById(shiftId)
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  const isOwner = shift.staffUserId === auth.userId
  const isManager = auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN'
  if (!isOwner && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['PENDING_CLOSURE', 'ACTIVE'].includes(shift.status)) {
    return NextResponse.json({ error: 'Shift is not open' }, { status: 400 })
  }
  const now = new Date()
  const stats = await aggregateShiftOrderStats(shift.staffName, shift.startedAt, now)
  const countedDrawerAmount = Number(body.countedDrawerAmount ?? shift.countedDrawerAmount ?? 0)
  const expectedDrawerAmount = shift.openingFloat + stats.cashSales
  const drawerVariance = countedDrawerAmount - expectedDrawerAmount
  const status = deriveShiftStatusOnClose({
    scheduledEndAt: shift.scheduledEndAt,
    endedAt: now,
    pendingClosure: shift.status === 'PENDING_CLOSURE',
  })
  const closed = await updateStaffShift(shiftId, {
    endedAt: now,
    status,
    countedDrawerAmount,
    expectedDrawerAmount,
    drawerVariance,
    cashSales: stats.cashSales,
    mpesaSales: stats.mpesaSales,
    totalRevenue: stats.totalRevenue,
    ordersServed: stats.ordersServed,
    refunds: stats.refunds,
    discounts: stats.discounts,
    pendingClosureAt: null,
    notes: String(body.notes ?? shift.notes ?? ''),
  })
  await createShiftEvent({
    shiftId,
    staffUserId: shift.staffUserId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'CLOSE',
    metadata: { status, resolvedPending: true },
  })
  return NextResponse.json({ ok: true, shift: closed })
}
