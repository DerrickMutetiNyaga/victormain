import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaSuperAdmin } from '@/lib/jaba-ai-auth'
import type { ActionItemState, AiActionStatePayload } from '@/lib/jaba-ai-intelligence-types'

export const runtime = 'nodejs'

const COL = 'jaba_ai_intelligence_state'

/**
 * Persist per-super-admin action tracking (reviewed / handled / snooze / notes).
 */
export async function GET() {
  const auth = await requireJabaSuperAdmin()
  if ('response' in auth) return auth.response

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const doc = await db.collection(COL).findOne<{ email: string; items: Record<string, ActionItemState> }>({
      email: auth.email,
    })
    const payload: AiActionStatePayload = { items: doc?.items ?? {} }
    return NextResponse.json(payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireJabaSuperAdmin()
  if ('response' in auth) return auth.response

  try {
    const body = (await request.json()) as AiActionStatePayload
    const items = body.items && typeof body.items === 'object' ? body.items : {}
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    await db.collection(COL).updateOne(
      { email: auth.email },
      {
        $set: {
          email: auth.email,
          items,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
