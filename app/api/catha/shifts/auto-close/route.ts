import { NextResponse } from 'next/server'
import { autoCloseOverdueShifts } from '@/lib/catha-shift-auto-close'

function hasCronAccess(request: Request): boolean {
  const expected = String(process.env.CATHA_SHIFT_AUTOCLOSE_CRON_SECRET || '').trim()
  if (!expected) return false
  const token = String(request.headers.get('x-catha-cron-secret') || '').trim()
  const bearer = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === expected || bearer === expected
}

export async function POST(request: Request) {
  if (!hasCronAccess(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const result = await autoCloseOverdueShifts({ limit: 2000 })
  return NextResponse.json({
    ok: true,
    autoClosedCount: result.autoClosed.length,
    shiftIds: result.autoClosed.map((s) => s._id?.toString()).filter(Boolean),
  })
}
