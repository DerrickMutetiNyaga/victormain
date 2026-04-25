import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import {
  getShiftNotificationSettings,
  saveShiftNotificationSettings,
} from '@/lib/models/shift-notification-settings'

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ ok: true, settings: await getShiftNotificationSettings() })
}

export async function PUT(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const settings = await saveShiftNotificationSettings({ ...body, updatedBy: auth.user.email })
  return NextResponse.json({ ok: true, settings })
}
