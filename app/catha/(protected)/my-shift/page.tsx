'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type MyShiftResponse = {
  ok: boolean
  shift: null | {
    id: string
    startedAt: string
    endedAt: string | null
    scheduledStartAt: string
    scheduledEndAt: string
    state: 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED'
    status: string
    timing: {
      isDelayed: boolean
      overdueBy: string
      delayedBy: string
      opened: { label: string; detail: string }
      closed: { label: string; detail: string }
    }
  }
  orders: Array<{
    id: string
    time: string | null
    status: string
    items: Array<{ name: string; qty: number }>
  }>
}

function statusBadge(state: 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED') {
  if (state === 'ACTIVE') return 'bg-emerald-100 text-emerald-800'
  if (state === 'AUTO_CLOSED') return 'bg-orange-100 text-orange-800'
  return 'bg-rose-100 text-rose-800'
}

export default function MyShiftPage() {
  const [data, setData] = useState<MyShiftResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/catha/shifts/my-shift', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (mounted) setData(json as MyShiftResponse)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const shift = data?.shift ?? null
  const orders = useMemo(() => data?.orders ?? [], [data?.orders])

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>My Shift</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading shift...</p>
          ) : !shift ? (
            <p className="text-sm text-muted-foreground">No shift found.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge className={statusBadge(shift.state)}>{shift.state.replace('_', ' ')}</Badge>
                <span className="text-sm text-muted-foreground">{shift.status}</span>
              </div>
              <p className="text-sm">Started: {new Date(shift.startedAt).toLocaleString('en-KE')}</p>
              <p className="text-sm">Ended: {shift.endedAt ? new Date(shift.endedAt).toLocaleString('en-KE') : 'Active'}</p>
              <p className="text-sm">Overdue: {shift.timing.overdueBy}</p>
              <p className="text-sm">Delayed: {shift.timing.delayedBy}</p>
              <p className="text-sm">Opened: {shift.timing.opened.detail}</p>
              <p className="text-sm">Closed: {shift.timing.closed.detail}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders (No Prices)</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders in this shift.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">Order: {order.id}</p>
                  <p className="text-xs text-muted-foreground">
                    Time: {order.time ? new Date(order.time).toLocaleString('en-KE') : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Status: {order.status}</p>
                  <p className="text-xs text-muted-foreground">
                    Items: {order.items.map((item) => `${item.name} x${item.qty}`).join(', ') || 'None'}
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

