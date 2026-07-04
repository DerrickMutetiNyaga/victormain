'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Hourglass,
  Info,
  Package2,
  Play,
  RefreshCw,
  ShoppingBag,
  Square,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type MyShiftResponse = {
  ok: boolean
  shift: null | {
    id: string
    startedAt: string
    endedAt: string | null
    scheduledStart?: string
    scheduledEnd?: string
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

type Tone = 'red' | 'green' | 'blue' | 'yellow'

function toneClasses(tone: Tone) {
  if (tone === 'red') return 'bg-red-50 text-red-600'
  if (tone === 'green') return 'bg-emerald-50 text-emerald-600'
  if (tone === 'yellow') return 'bg-amber-50 text-amber-600'
  return 'bg-blue-50 text-blue-600'
}

function pillClasses(state: 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED') {
  if (state === 'ACTIVE') return 'bg-emerald-100 text-emerald-700'
  if (state === 'AUTO_CLOSED') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-KE')
}

function formatLastUpdated(date: Date) {
  return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ShiftDetailRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: Tone
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClasses(tone)}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="truncate text-base font-medium text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
  tone: Tone
}) {
  return (
    <div className={`rounded-xl p-4 ${toneClasses(tone)}`}>
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70">{icon}</div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-600">{helper}</p>
    </div>
  )
}

function ShiftSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-md md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}

export default function MyShiftPage() {
  const [data, setData] = useState<MyShiftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date())

  useEffect(() => {
    let mounted = true
    fetch('/api/catha/shifts/my-shift', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (mounted) {
          setData(json as MyShiftResponse)
          setLastUpdatedAt(new Date())
        }
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
  const completedOrders = useMemo(
    () => orders.filter((order) => String(order.status || '').toUpperCase().includes('COMPLETE')).length,
    [orders],
  )
  const pendingOrders = useMemo(() => orders.length - completedOrders, [orders.length, completedOrders])
  const scheduledStart = shift?.scheduledStart ?? shift?.scheduledStartAt
  const scheduledEnd = shift?.scheduledEnd ?? shift?.scheduledEndAt

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <ShiftSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Shift</h1>
          <p className="text-sm text-gray-500">Here&apos;s your shift overview and orders</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw className="h-4 w-4" />
          <span>Last updated: {formatLastUpdated(lastUpdatedAt)}</span>
        </div>
      </header>

      {!shift ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <p className="text-base font-medium text-gray-900">No shift found</p>
          <p className="mt-2 text-sm text-gray-500">There is no active or recent shift to display right now.</p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-md md:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-gray-100 px-4 py-6 text-center">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pillClasses(shift.state)}`}>
                  {shift.state.replace('_', ' ')}
                </span>
                <span className="mt-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{shift.status}</span>
                <div className="mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <ShoppingBag className="h-9 w-9" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  {shift.state === 'ACTIVE' ? 'Shift Active' : 'Shift Completed'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Thank you for your service!</p>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="space-y-4">
                  <ShiftDetailRow icon={<Play className="h-4 w-4" />} label="Started" value={formatDate(shift.startedAt)} tone="green" />
                  <ShiftDetailRow icon={<Square className="h-4 w-4" />} label="Ended" value={formatDate(shift.endedAt)} tone="red" />
                  <ShiftDetailRow
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Scheduled Start"
                    value={formatDate(scheduledStart ?? null)}
                    tone="blue"
                  />
                  <ShiftDetailRow
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Scheduled End"
                    value={formatDate(scheduledEnd ?? null)}
                    tone="blue"
                  />
                  <ShiftDetailRow
                    icon={<Hourglass className="h-4 w-4" />}
                    label="Total Duration"
                    value={shift.timing.closed.detail}
                    tone="yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
                <MetricCard
                  icon={<Clock3 className="h-4 w-4" />}
                  label="Opened"
                  value={shift.timing.opened.detail}
                  helper="Compared to schedule"
                  tone="red"
                />
                <MetricCard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Closed"
                  value={shift.timing.closed.detail}
                  helper="Compared to schedule"
                  tone="green"
                />
                <MetricCard
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Overdue"
                  value={shift.timing.overdueBy}
                  helper="Beyond allowed time"
                  tone="yellow"
                />
                <MetricCard
                  icon={<Hourglass className="h-4 w-4" />}
                  label="Delayed"
                  value={shift.timing.delayedBy}
                  helper="From scheduled time"
                  tone="blue"
                />
              </div>
            </div>
          </section>

          <section className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600">
              <Info className="h-4 w-4" />
            </div>
            <p className="text-sm text-blue-900">
              You opened your shift {shift.timing.opened.detail} than scheduled and closed it {shift.timing.closed.detail} before
              scheduled end.
            </p>
          </section>
        </>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-md">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-xl font-semibold text-gray-900">Orders (No Prices)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">{orders.length} Orders</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-600">{completedOrders} Completed</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-600">{pendingOrders} Pending</span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
              <Package2 className="h-7 w-7" />
            </div>
            <p className="text-xl font-semibold text-gray-900">No orders in this shift</p>
            <p className="mt-2 text-sm text-gray-500">Orders will appear here as they are placed.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-base font-medium text-gray-900">Order {order.id}</p>
                  <p className="text-sm text-gray-500">{formatDate(order.time)}</p>
                </div>
                <p className="mt-1 text-sm text-gray-500">Status: {order.status}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {order.items.map((item) => `${item.name} x${item.qty}`).join(', ') || 'No items'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

