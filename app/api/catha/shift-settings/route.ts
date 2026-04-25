import { NextResponse } from 'next/server'
import { getShiftSettings, saveShiftSettings } from '@/lib/models/shift-setting'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

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
  const settings = await saveShiftSettings({ ...body, updatedBy: auth.user.email })
  return NextResponse.json({ ok: true, settings })
}
