"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type Row = {
  _id: string
  staffName: string
  role: string
  startedAt: string
  endedAt?: string
  ordersServed: number
  totalRevenue: number
  cashSales: number
  mpesaSales: number
  refunds: number
  drawerVariance?: number
  status: string
  notes?: string
  deviceFingerprint: string
}

export default function StaffShiftsPage() {
  const { data: session } = useSession()
  const [rows, setRows] = useState<Row[]>([])
  const [cards, setCards] = useState<Record<string, unknown>>({})
  const [range, setRange] = useState("today")
  const [staffQuery, setStaffQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<any>(null)

  useEffect(() => {
    const role = String((session?.user as any)?.role || "").toUpperCase()
    if (session && !["ADMIN", "SUPER_ADMIN"].includes(role)) {
      window.location.href = "/catha/access-denied"
      return
    }
    setLoading(true)
    fetch(`/api/catha/shifts/dashboard?range=${encodeURIComponent(range)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? [])
        setCards(d.cards ?? {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch("/api/catha/shifts/insights", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInsights(d))
      .catch(() => {})
  }, [range, session])

  const filteredRows = useMemo(() => {
    const q = staffQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.staffName.toLowerCase().includes(q))
  }, [rows, staffQuery])

  function statusVariant(status: string) {
    if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700"
    if (status === "PENDING_CLOSURE") return "bg-amber-100 text-amber-700"
    if (status === "EARLY_EXIT") return "bg-orange-100 text-orange-700"
    if (status === "OVERTIME") return "bg-violet-100 text-violet-700"
    if (status === "FORGOT_CLOCK_OUT") return "bg-rose-100 text-rose-700"
    return "bg-slate-100 text-slate-700"
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Staff Shifts Dashboard</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter staff..."
            className="h-10 w-[180px] md:w-[240px]"
            value={staffQuery}
            onChange={(e) => setStaffQuery(e.target.value)}
          />
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-10 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Object.entries(cards).map(([key, value]) => (
          <div key={key} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-xs capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</div>
            <div className="text-lg font-semibold">{typeof value === "object" ? "-" : String(value ?? "-")}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Per Cashier</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights?.charts?.revenuePerCashier ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Peak Hours Worked</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights?.charts?.peakHoursWorked ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" interval={3} />
                <YAxis />
                <Tooltip />
                <Line dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Attendance Trends (14 days)</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights?.charts?.attendanceTrends ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line dataKey="onTimeRate" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Cash Shortages History</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights?.charts?.cashShortagesHistory ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                <Bar dataKey="shortage" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">Daily Scoreboard & Rewards</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {insights?.scoreboard?.map((row: any) => (
            <div key={row.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">Attendance {row.attendanceScore}%</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">KES {Number(row.revenue || 0).toLocaleString()}</div>
                <Badge className="bg-emerald-100 text-emerald-700">{row.badge}</Badge>
              </div>
            </div>
          ))}
          {!insights?.scoreboard?.length && <div className="text-sm text-muted-foreground">No scoreboard data yet.</div>}
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Cashier Name","Role","Clock In Time (EAT)","Clock Out Time (EAT)","Orders Served","Revenue Generated","Cash Sales","Mpesa Sales","Refunds","Drawer Variance","Shift Status","Device Used","Notes"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="px-3 py-2">{row.staffName}</td>
                <td className="px-3 py-2">{row.role}</td>
                <td className="px-3 py-2">{new Date(row.startedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                <td className="px-3 py-2">{row.endedAt ? new Date(row.endedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</td>
                <td className="px-3 py-2">{row.ordersServed}</td>
                <td className="px-3 py-2">{row.totalRevenue.toLocaleString()}</td>
                <td className="px-3 py-2">{row.cashSales.toLocaleString()}</td>
                <td className="px-3 py-2">{row.mpesaSales.toLocaleString()}</td>
                <td className="px-3 py-2">{row.refunds.toLocaleString()}</td>
                <td className="px-3 py-2">{row.drawerVariance ?? "-"}</td>
                <td className="px-3 py-2"><Badge className={statusVariant(row.status)}>{row.status}</Badge></td>
                <td className="px-3 py-2">{row.deviceFingerprint}</td>
                <td className="px-3 py-2">{row.notes || "-"}</td>
              </tr>
            ))}
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">No shifts found for selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
