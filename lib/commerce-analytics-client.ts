'use client'

import type { AnalyticsEventType } from '@/lib/commerce-analytics'

const SESSION_KEY = 'catha_analytics_session_v1'

function createSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getAnalyticsSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const next = createSessionId()
    window.localStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return createSessionId()
  }
}

export async function trackClientEvent(
  eventType: AnalyticsEventType,
  payload: Record<string, unknown> = {}
) {
  if (typeof window === 'undefined') return
  const body = {
    eventType,
    sessionId: getAnalyticsSessionId(),
    path: window.location.pathname || '/',
    ...payload,
  }
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    // Ignore client analytics failures to avoid impacting user flow.
  }
}
