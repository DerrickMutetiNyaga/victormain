'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SmsLogRow = {
  id: string
  userId: string
  shiftId: string | null
  phone: string
  message: string
  eventType: string
  attempts: number
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed' | 'permanently_failed'
  providerMessageId: string | null
  sentAt: string | null
  deliveredAt: string | null
  resolvedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

type SmsMetrics = {
  total: number
  sent: number
  delivered: number
  failed: number
  permanentlyFailed: number
  pending: number
  processing: number
  successRate: number
  failureRate: number
  avgDeliveryMs: number | null
  retryDistribution: Record<string, number>
  unresolvedCriticalAlerts: number
}

export default function SmsLogsPage() {
  const [rows, setRows] = useState<SmsLogRow[]>([])
  const [metrics, setMetrics] = useState<SmsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  const load = () => {
    let mounted = true
    setLoading(true)
    const q = new URLSearchParams({ limit: '200', status })
    if (search.trim()) q.set('search', search.trim())
    fetch(`/api/catha/settings/sms-logs?${q.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        setRows(Array.isArray(data?.rows) ? data.rows : [])
        setMetrics(data?.metrics ?? null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const action = async (id: string, op: 'retry' | 'resolve') => {
    await fetch('/api/catha/settings/sms-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: op }),
    })
    load()
  }

  const formatMs = (ms: number | null) => {
    if (ms === null) return '-'
    const mins = Math.round(ms / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <Badge variant="outline">Total: {metrics?.total ?? 0}</Badge>
            <Badge variant="outline">Success: {metrics?.successRate ?? 0}%</Badge>
            <Badge variant="outline">Failure: {metrics?.failureRate ?? 0}%</Badge>
            <Badge variant="outline">Avg Delivery: {formatMs(metrics?.avgDeliveryMs ?? null)}</Badge>
            <Badge variant="destructive">Critical: {metrics?.unresolvedCriticalAlerts ?? 0}</Badge>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or user"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={() => load()}>Search</Button>
            {['all', 'pending', 'processing', 'sent', 'delivered', 'failed', 'permanently_failed'].map((s) => (
              <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SMS logs yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Badge>{row.status}</Badge>
                    <span className="text-xs text-muted-foreground">{row.eventType}</span>
                    <span className="text-xs text-muted-foreground">Attempts: {row.attempts}</span>
                  </div>
                  <p className="text-sm mt-1">{row.phone}</p>
                  <p className="text-xs text-muted-foreground mt-1">{row.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">User: {row.userId}</p>
                  {row.providerMessageId ? (
                    <p className="text-xs text-muted-foreground mt-1">Provider ID: {row.providerMessageId}</p>
                  ) : null}
                  {row.lastError ? <p className="text-xs text-red-600 mt-1">{row.lastError}</p> : null}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => action(row.id, 'retry')}>Retry</Button>
                    <Button size="sm" variant="outline" onClick={() => action(row.id, 'resolve')}>Mark resolved</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(row.createdAt).toLocaleString('en-KE')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

