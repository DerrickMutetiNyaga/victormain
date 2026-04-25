"use client"

import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { analyzeShiftTiming, formatDurationCompact, formatSignedTiming } from "@/lib/catha-shift-timing-analysis"

type Shift = {
  _id: string
  startedAt: string
  endedAt?: string
  scheduledStartAt?: string
  scheduledEndAt?: string
  status: string
  ordersServed: number
  totalRevenue: number
  notes?: string
}

export default function ShiftHistoryPage() {
  const [range, setRange] = useState("month")
  const [rows, setRows] = useState<Shift[]>([])
  const [liveNow, setLiveNow] = useState(() => new Date())

  useEffect(() => {
    fetch(`/api/catha/shifts/history?range=${encodeURIComponent(range)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.shifts ?? []))
      .catch(() => {})
  }, [range])

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const statusTone = (status: string) =>
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "FORGOT_CLOCK_OUT"
      ? "bg-rose-100 text-rose-700"
      : status === "AUTO_CLOSED"
      ? "bg-slate-200 text-slate-700"
      : status === "EARLY_EXIT"
      ? "bg-orange-100 text-orange-700"
      : status === "OVERTIME"
      ? "bg-violet-100 text-violet-700"
      : "bg-slate-100 text-slate-700"

  const timingTone = (label: string) =>
    label.startsWith("Late") || label.startsWith("Overtime")
      ? "bg-rose-100 text-rose-700"
      : label.startsWith("Early")
      ? "bg-amber-100 text-amber-700"
      : label.startsWith("On Time")
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700"

  const openTimingLabel = (row: Shift) => {
    const timing = analyzeShiftTiming({
      scheduledStartTime: row.scheduledStartAt,
      actualStartTime: row.startedAt,
    })
    if (timing.openStatus === "ON_TIME") return "On Time"
    return `${timing.openStatus === "EARLY" ? "Early Open" : "Late Open"}: ${formatSignedTiming(timing.openDiffMs)}`
  }

  const closeTimingLabel = (row: Shift) => {
    const timing = analyzeShiftTiming({
      scheduledEndTime: row.scheduledEndAt,
      actualEndTime: row.endedAt,
      actualStartTime: row.startedAt,
      active: row.status === "ACTIVE",
      now: liveNow,
    })
    if (row.status === "ACTIVE") {
      if ((timing.overtimeByMs ?? 0) > 0) return `Overtime: ${formatSignedTiming(timing.overtimeByMs ?? 0)}`
      if (timing.timeSinceStartMs != null) return `Time Passed: ${formatDurationCompact(timing.timeSinceStartMs)}`
      return "-"
    }
    if (!row.endedAt) return "-"
    if (timing.closeStatus === "ON_TIME") return "On Time"
    return `${timing.closeStatus === "EARLY" ? "Early Close" : "Late Close"}: ${formatSignedTiming(timing.closeDiffMs)}`
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Shift History</h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Clock In</th>
              <th className="px-3 py-2 text-left">Open Timing</th>
              <th className="px-3 py-2 text-left">Clock Out</th>
              <th className="px-3 py-2 text-left">Close/Live Timing</th>
              <th className="px-3 py-2 text-left">Orders</th>
              <th className="px-3 py-2 text-left">Revenue</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="px-3 py-2">{new Date(row.startedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                <td className="px-3 py-2">{new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                <td className="px-3 py-2"><Badge className={timingTone(openTimingLabel(row))}>{openTimingLabel(row)}</Badge></td>
                <td className="px-3 py-2">{row.endedAt ? new Date(row.endedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</td>
                <td className="px-3 py-2"><Badge className={timingTone(closeTimingLabel(row))}>{closeTimingLabel(row)}</Badge></td>
                <td className="px-3 py-2">{row.ordersServed}</td>
                <td className="px-3 py-2">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                <td className="px-3 py-2"><Badge className={statusTone(row.status)}>{row.status}</Badge></td>
                <td className="px-3 py-2">{row.notes || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>No shift history found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
