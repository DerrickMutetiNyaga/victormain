'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { JabaAiContext } from '@/lib/jaba-ai-intelligence-types'
import { JabaAiIntelligenceView } from '@/components/jaba/ai-intelligence/jaba-ai-intelligence-view'

export default function JabaAiIntelligencePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<JabaAiContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/jaba/ai-context', { cache: 'no-store' })
      const json = await res.json()
      if (res.status === 403 || res.status === 401) {
        router.replace('/jaba/unauthorized')
        return
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load intelligence context')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (status === 'loading') return
    const role = session?.user?.role?.toLowerCase()
    if (role !== 'super_admin') {
      router.replace('/jaba/unauthorized')
      return
    }
    load()
  }, [session, status, router, load])

  return (
    <JabaAiIntelligenceView data={data} loading={loading} error={error} onRefresh={load} />
  )
}
