import { NextResponse } from 'next/server'
import { requireJabaSuperAdmin } from '@/lib/jaba-ai-auth'
import { buildJabaAiContext } from '@/lib/jaba-ai-context'

export const runtime = 'nodejs'

/**
 * Normalized AI context for Jaba — super_admin only.
 * Aggregates existing Jaba APIs server-side (parallel fetch with session cookie).
 */
export async function GET(request: Request) {
  const auth = await requireJabaSuperAdmin()
  if ('response' in auth) return auth.response

  try {
    const context = await buildJabaAiContext(request)
    return NextResponse.json(context)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/jaba/ai-context]', msg)
    return NextResponse.json({ error: 'Failed to build AI context', details: msg }, { status: 500 })
  }
}
