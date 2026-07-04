import { NextResponse } from 'next/server'
import { requireJabaSuperAdmin } from '@/lib/jaba-ai-auth'
import { buildJabaAiContext } from '@/lib/jaba-ai-context'
import { buildRuleBasedAnswer, maybeGenerateLlmAnswer } from '@/lib/jaba-ai-answer'
import { checkRateLimit } from '@/lib/jaba-ai-rate-limit'

export const runtime = 'nodejs'

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20

/**
 * Ask AI — structured answer from rules + optional future LLM provider.
 * POST body: { question: string }
 */
export async function POST(request: Request) {
  const auth = await requireJabaSuperAdmin()
  if ('response' in auth) return auth.response

  const rl = checkRateLimit(`jaba-ai:${auth.email}`, RATE_MAX, RATE_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: Math.ceil(rl.retryAfterMs) },
      { status: 429 }
    )
  }

  let body: { question?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = String(body.question ?? '').trim().slice(0, 4000)
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  try {
    const context = await buildJabaAiContext(request)
    const ruleAnswer = buildRuleBasedAnswer(question, context)
    const answer = await maybeGenerateLlmAnswer(question, context, ruleAnswer)

    return NextResponse.json({
      answer,
      generatedAt: context.generatedAt,
      sourcesUsed: answer.dataSources,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/jaba/ai-intelligence]', msg)
    return NextResponse.json({ error: 'Failed to generate answer', details: msg }, { status: 500 })
  }
}
