import { NextResponse } from 'next/server'
import { getShiftSettings, saveShiftSettings } from '@/lib/models/shift-setting'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ ok: true, settings: await getShiftSettings() })
}

export async function PUT(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (auth.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const current = await getShiftSettings()
  const noShiftReminderMinutes = clamp(
    body.noShiftReminderMinutes,
    1,
    60,
    current.noShiftReminderMinutes
  )
  const noShiftHardAlertMinutes = clamp(
    body.noShiftHardAlertMinutes,
    5,
    180,
    current.noShiftHardAlertMinutes
  )
  if (noShiftHardAlertMinutes <= noShiftReminderMinutes) {
    return NextResponse.json(
      { error: 'Hard alert minutes must be greater than reminder minutes' },
      { status: 400 }
    )
  }
  const settings = await saveShiftSettings({
    ...body,
    noShiftReminderMinutes,
    noShiftHardAlertMinutes,
    updatedBy: auth.user.email,
  })
  return NextResponse.json({ ok: true, settings })
}
