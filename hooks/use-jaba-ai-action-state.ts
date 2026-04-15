'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ActionItemState } from '@/lib/jaba-ai-intelligence-types'

export function useJabaAiActionState() {
  const [items, setItems] = useState<Record<string, ActionItemState>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/jaba/ai-intelligence/state', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then((d) => {
        if (!cancelled) setItems(d.items ?? {})
      })
      .catch(() => {
        if (!cancelled) setItems({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: Record<string, ActionItemState>) => {
    await fetch('/api/jaba/ai-intelligence/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: next }),
    })
  }, [])

  const updateItem = useCallback(
    (id: string, patch: Partial<ActionItemState>) => {
      setItems((prev) => {
        const cur = prev[id] ?? { status: 'open' as const, updatedAt: new Date().toISOString() }
        const next: ActionItemState = {
          ...cur,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
        const merged = { ...prev, [id]: next }
        void persist(merged)
        return merged
      })
    },
    [persist]
  )

  const endOfTodayIso = () => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  }

  return { items, loading, updateItem, endOfTodayIso }
}
