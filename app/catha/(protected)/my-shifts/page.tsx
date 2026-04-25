"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"

type Shift = {
  _id: string
  startedAt: string
  endedAt?: string
  ordersServed: number
  totalRevenue: number
  status: string
  metadata?: { latenessBand?: string }
}

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])

  useEffect(() => {
    fetch("/api/catha/shifts/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setShifts(d.shifts ?? []))
      .catch(() => {})
  }, [])

  const today = shifts[0]
  const attendanceScore = useMemo(() => {
    if (!shifts.length) return 100
    const lateCount = shifts.filter((s) => ["yellow", "orange", "red"].includes(String(s.metadata?.latenessBand ?? ""))).length
    return Math.max(0, Math.round(((shifts.length - lateCount) / shifts.length) * 100))
  }, [shifts])
  const latenessHistory = useMemo(
    () => shifts.map((s) => s.metadata?.latenessBand || "on_time").slice(0, 10),
    [shifts]
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Shifts</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-xs text-muted-foreground">Orders Served</div><div className="text-lg font-semibold">{today?.ordersServed ?? 0}</div></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-xs text-muted-foreground">Revenue Made</div><div className="text-lg font-semibold">KES {(today?.totalRevenue ?? 0).toLocaleString()}</div></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-xs text-muted-foreground">Time Worked</div><div className="text-lg font-semibold">{today?.endedAt ? "Closed" : "Active"}</div></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-xs text-muted-foreground">Tips</div><div className="text-lg font-semibold">-</div></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-xs text-muted-foreground">Attendance Score</div><div className="text-lg font-semibold">{attendanceScore}%</div></div>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-2 text-sm font-medium">Lateness History (Recent 10)</div>
        <div className="flex flex-wrap gap-2">
          {latenessHistory.map((item, idx) => (
            <Badge key={`${item}-${idx}`} className={item === "red" ? "bg-rose-100 text-rose-700" : item === "orange" ? "bg-orange-100 text-orange-700" : item === "yellow" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
              {item}
            </Badge>
          ))}
          {latenessHistory.length === 0 && <span className="text-sm text-muted-foreground">No shift records yet.</span>}
        </div>
      </div>
      <div className="rounded-xl border">
        <div className="border-b px-4 py-3 font-medium">Last 30 shifts</div>
        <div className="divide-y">
          {shifts.map((s) => (
            <div key={s._id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{new Date(s.startedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}</span>
              <span>{s.ordersServed} orders</span>
              <span>KES {s.totalRevenue.toLocaleString()}</span>
              <span>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
