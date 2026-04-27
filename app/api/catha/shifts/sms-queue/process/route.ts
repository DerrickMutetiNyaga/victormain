import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { processShiftSmsQueueBatch } from '@/lib/catha-shift-sms-queue-worker'

function hasCronAccess(request: Request): boolean {
  const secret = String(process.env.CATHA_SMS_QUEUE_CRON_SECRET || '').trim()
  if (!secret) return false
  const provided = String(request.headers.get('x-cron-secret') || '').trim()
  return provided === secret
}

async function ensureAccess(request: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (hasCronAccess(request)) return { ok: true }
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return { ok: false, response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function POST(request: Request) {
  const access = await ensureAccess(request)
  if (!access.ok) return access.response
  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)))
  const result = await processShiftSmsQueueBatch(limit)
  return NextResponse.json({
    ok: true,
    ...result,
  })
}

