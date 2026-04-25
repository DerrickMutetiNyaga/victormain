"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { CalendarDays, Download, Plus, Search, TrendingUp, Users, AlertTriangle, Clock3 } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  RadialBar,
  RadialBarChart,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ShiftRow = {
  _id: string
  staffName: string
  role: string
  startedAt: string
  endedAt?: string
  ordersServed: number
  totalRevenue: number
  status: string
  notes?: string
  metadata?: { latenessBand?: string }
}

type MyShift = {
  _id: string
  startedAt: string
  endedAt?: string
  ordersServed: number
  totalRevenue: number
  status: string
  metadata?: { latenessBand?: string }
}

type InsightsResponse = {
  charts?: {
    revenuePerCashier?: Array<{ name: string; revenue: number }>
    peakHoursWorked?: Array<{ hour: string; count: number }>
    attendanceTrends?: Array<{ day: string; onTimeRate: number }>
    chronicLateness?: Array<{ name: string; lateCount: number }>
  }
  insights?: {
    mostProductiveEmployee?: string | null
    mostProductiveRevenue?: number
  }
  scoreboard?: Array<{ name: string; revenue: number; attendanceScore: number; badge: string }>
}

const tabOptions = [
  { id: "overview", label: "Overview" },
  { id: "my-shifts", label: "My Shifts" },
  { id: "team-shifts", label: "Team Shifts" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
] as const

type TabValue = (typeof tabOptions)[number]["id"]

function statusMeta(row: ShiftRow | MyShift) {
  const isLate = ["yellow", "orange", "red"].includes(String(row.metadata?.latenessBand ?? ""))
  if (row.status === "ACTIVE") {
    return isLate
      ? { label: "Late", className: "bg-orange-100 text-orange-700 border-orange-200" }
      : { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  }
  if (row.endedAt || row.status === "COMPLETED" || row.status === "AUTO_CLOSED") {
    return { label: "Clocked Out", className: "bg-slate-100 text-slate-700 border-slate-200" }
  }
  return { label: "Absent", className: "bg-rose-100 text-rose-700 border-rose-200" }
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function hoursWorked(startedAt: string, endedAt?: string) {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "0h 0m"
  const mins = Math.round((end - start) / 60000)
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h ${rem}m`
}

export default function WorkforceHubPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabValue>("overview")
  const [query, setQuery] = useState("")
  const [range, setRange] = useState("today")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [dashboardRows, setDashboardRows] = useState<ShiftRow[]>([])
  const [historyRows, setHistoryRows] = useState<MyShift[]>([])
  const [myRows, setMyRows] = useState<MyShift[]>([])
  const [cards, setCards] = useState<Record<string, unknown>>({})
  const [insights, setInsights] = useState<InsightsResponse>({})
  const [loading, setLoading] = useState(true)

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String((session?.user as { role?: string } | undefined)?.role ?? "").toUpperCase())

  useEffect(() => {
    const params = new URLSearchParams({ range })
    if (fromDate) params.set("from", new Date(fromDate).toISOString())
    if (toDate) {
      const end = new Date(toDate)
      end.setHours(23, 59, 59, 999)
      params.set("to", end.toISOString())
    }

    setLoading(true)
    Promise.all([
      fetch(`/api/catha/shifts/dashboard?${params.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/catha/shifts/mine", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/catha/shifts/history?${params.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/catha/shifts/insights", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([dashboardData, myData, historyData, insightsData]) => {
        setDashboardRows((dashboardData.rows ?? []) as ShiftRow[])
        setCards((dashboardData.cards ?? {}) as Record<string, unknown>)
        setMyRows((myData.shifts ?? []) as MyShift[])
        setHistoryRows((historyData.shifts ?? []) as MyShift[])
        setInsights((insightsData ?? {}) as InsightsResponse)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [range, fromDate, toDate])

  const filteredTeamRows = useMemo(() => {
    const base = isAdmin ? dashboardRows : dashboardRows.filter((row) => row.status === "ACTIVE" || !row.endedAt)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((row) => row.staffName.toLowerCase().includes(q))
  }, [dashboardRows, isAdmin, query])

  const attendanceScore = useMemo(() => {
    const source = dashboardRows.length ? dashboardRows : myRows
    if (!source.length) return 100
    const lateCount = source.filter((s) => ["yellow", "orange", "red"].includes(String(s.metadata?.latenessBand ?? ""))).length
    return Math.max(0, Math.round(((source.length - lateCount) / source.length) * 100))
  }, [dashboardRows, myRows])

  const kpis = useMemo(
    () => [
      { title: "Active Staff Today", value: Number(cards.activeShiftsNow ?? 0), icon: Users },
      {
        title: "Hours Worked",
        value: `${(
          dashboardRows.reduce(
            (sum, row) => sum + (new Date(row.endedAt ?? Date.now()).getTime() - new Date(row.startedAt).getTime()),
            0
          ) / 3_600_000
        ).toFixed(1)}h`,
        icon: Clock3,
      },
      {
        title: "Revenue Today",
        value: `KES ${dashboardRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0).toLocaleString()}`,
        icon: TrendingUp,
      },
      { title: "Late Arrivals", value: Number(cards.lateArrivalsToday ?? 0), icon: AlertTriangle },
      { title: "Attendance Score", value: `${attendanceScore}%`, icon: CalendarDays },
      {
        title: "Pending Clock-outs",
        value: dashboardRows.filter((r) => r.status === "ACTIVE" && !r.endedAt).length,
        icon: Clock3,
      },
    ],
    [cards, dashboardRows, attendanceScore]
  )

  function exportCsv() {
    const rows = (activeTab === "my-shifts" ? myRows : activeTab === "history" ? historyRows : filteredTeamRows) as Array<ShiftRow | MyShift>
    const headers = ["Name", "Clock In", "Clock Out", "Hours", "Orders", "Revenue", "Status", "Notes"]
    const csvRows = rows.map((row) => [
      "staffName" in row ? row.staffName : "My Shift",
      new Date(row.startedAt).toISOString(),
      row.endedAt ? new Date(row.endedAt).toISOString() : "",
      hoursWorked(row.startedAt, row.endedAt),
      String(row.ordersServed ?? 0),
      String(row.totalRevenue ?? 0),
      statusMeta(row).label,
      "notes" in row ? String(row.notes ?? "") : "",
    ])
    const csvText = [headers, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `workforce-hub-${format(new Date(), "yyyy-MM-dd")}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const visibleTabs = isAdmin ? tabOptions : tabOptions.filter((tab) => tab.id !== "team-shifts" && tab.id !== "analytics")

  const panelMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 },
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] md:text-3xl">Workforce Hub</h1>
              <p className="mt-1 text-sm text-slate-600 md:text-base">
                Manage attendance, live shifts, team performance & payroll
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[260px_130px_130px_130px_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee..."
                  className="h-10 rounded-xl border-slate-200 pl-9"
                />
              </div>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-xl border-slate-200" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-xl border-slate-200" />
              <Button variant="outline" onClick={exportCsv} className="h-10 rounded-xl border-slate-200">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button className="h-10 rounded-xl bg-[#10B981] text-white hover:bg-emerald-500">
                <Plus className="mr-2 h-4 w-4" />
                Add Shift
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <motion.div key={kpi.title} whileHover={{ y: -3, scale: 1.01 }}>
              <Card className="rounded-[24px] border border-slate-200/80 bg-white shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{kpi.title}</span>
                    <kpi.icon className="h-4 w-4 text-[#10B981]" />
                  </div>
                  <div className="text-xl font-semibold text-[#0F172A]">{kpi.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="rounded-[24px] border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
              <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl bg-slate-100/80 p-1">
                {visibleTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#0F172A]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div key="overview" {...panelMotion} className="grid grid-cols-1 gap-4 xl:grid-cols-10">
                  <div className="xl:col-span-7">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            {["Avatar", "Name", "Clock In", "Hours Worked", "Orders", "Revenue", "Status", "Actions"].map((h) => (
                              <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTeamRows.slice(0, 12).map((row) => {
                            const status = statusMeta(row)
                            return (
                              <tr key={row._id} className="border-t transition-colors hover:bg-slate-50">
                                <td className="px-3 py-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                                      {initials(row.staffName)}
                                    </AvatarFallback>
                                  </Avatar>
                                </td>
                                <td className="px-3 py-3 font-medium text-slate-900">{row.staffName}</td>
                                <td className="px-3 py-3 text-slate-600">
                                  {new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}
                                </td>
                                <td className="px-3 py-3 text-slate-600">{hoursWorked(row.startedAt, row.endedAt)}</td>
                                <td className="px-3 py-3">{row.ordersServed}</td>
                                <td className="px-3 py-3">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                                <td className="px-3 py-3">
                                  <Badge className={`border ${status.className}`}>
                                    {status.label === "Active" ? <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> : null}
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="px-3 py-3">
                                  <Button variant="outline" size="sm" className="rounded-lg border-slate-200">
                                    View
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                          {!loading && filteredTeamRows.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                                No live shift records for this filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="space-y-4 xl:col-span-3">
                    <Card className="rounded-2xl border border-slate-200 shadow-sm">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-sm">Attendance</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart
                            innerRadius="65%"
                            outerRadius="95%"
                            data={[{ value: attendanceScore }]}
                            startAngle={90}
                            endAngle={-270}
                          >
                            <RadialBar dataKey="value" cornerRadius={12} />
                            <Tooltip formatter={(v: number) => `${v}%`} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <p className="-mt-4 text-center text-xl font-semibold text-[#0F172A]">{attendanceScore}%</p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Top Performer</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="font-semibold text-slate-900">{insights.insights?.mostProductiveEmployee ?? "No data"}</div>
                        <div className="mt-1 text-slate-600">
                          KES {Number(insights.insights?.mostProductiveRevenue ?? 0).toLocaleString()} generated
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Late Alerts</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {(insights.charts?.chronicLateness ?? []).slice(0, 4).map((late) => (
                          <div key={late.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <span className="truncate">{late.name}</span>
                            <Badge className="bg-orange-100 text-orange-700">{late.lateCount} late</Badge>
                          </div>
                        ))}
                        {(insights.charts?.chronicLateness ?? []).length === 0 && <p className="text-slate-500">No late alerts.</p>}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Upcoming Schedules</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {filteredTeamRows.slice(0, 3).map((row) => (
                          <div key={row._id} className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="font-medium text-slate-900">{row.staffName}</div>
                            <div className="text-slate-600">
                              Next shift target: {new Date(row.startedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}
                            </div>
                          </div>
                        ))}
                        {filteredTeamRows.length === 0 && <p className="text-slate-500">No upcoming schedules.</p>}
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}

              {activeTab === "my-shifts" && (
                <motion.div key="my-shifts" {...panelMotion} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {myRows.map((row) => {
                    const status = statusMeta(row)
                    return (
                      <Card key={row._id} className="rounded-2xl border border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-slate-900">
                            {new Date(row.startedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center justify-between"><span className="text-slate-500">Clock In</span><span>{new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Clock Out</span><span>{row.endedAt ? new Date(row.endedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Hours</span><span>{hoursWorked(row.startedAt, row.endedAt)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Revenue</span><span>KES {Number(row.totalRevenue || 0).toLocaleString()}</span></div>
                          <Badge className={`border ${status.className}`}>{status.label}</Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {!loading && myRows.length === 0 && <div className="text-sm text-slate-500">No personal shifts found.</div>}
                </motion.div>
              )}

              {activeTab === "team-shifts" && (
                <motion.div key="team-shifts" {...panelMotion} className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {["Name", "Role", "Clock In", "Clock Out", "Hours", "Orders", "Revenue", "Status"].map((h) => (
                          <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeamRows.map((row) => {
                        const status = statusMeta(row)
                        return (
                          <tr key={row._id} className="border-t transition-colors hover:bg-slate-50">
                            <td className="px-3 py-3 font-medium">{row.staffName}</td>
                            <td className="px-3 py-3">{row.role || "-"}</td>
                            <td className="px-3 py-3">{new Date(row.startedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                            <td className="px-3 py-3">{row.endedAt ? new Date(row.endedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</td>
                            <td className="px-3 py-3">{hoursWorked(row.startedAt, row.endedAt)}</td>
                            <td className="px-3 py-3">{row.ordersServed}</td>
                            <td className="px-3 py-3">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                            <td className="px-3 py-3"><Badge className={`border ${status.className}`}>{status.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div key="history" {...panelMotion} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {historyRows.map((row) => {
                    const status = statusMeta(row)
                    return (
                      <Card key={row._id} className="rounded-2xl border border-slate-200 shadow-sm">
                        <CardContent className="space-y-2 p-4 text-sm">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-900">
                              {new Date(row.startedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}
                            </p>
                            <Badge className={`border ${status.className}`}>{status.label}</Badge>
                          </div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Clock In</span><span>{new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Clock Out</span><span>{row.endedAt ? new Date(row.endedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Hours</span><span>{hoursWorked(row.startedAt, row.endedAt)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Revenue</span><span>KES {Number(row.totalRevenue || 0).toLocaleString()}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-500">Orders</span><span>{row.ordersServed}</span></div>
                          <div className="text-slate-600">{row.status}</div>
                          <div className="text-slate-500">{(row as ShiftRow).notes || "No notes"}</div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </motion.div>
              )}

              {activeTab === "analytics" && (
                <motion.div key="analytics" {...panelMotion} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <Card className="rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
                    <CardContent className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={insights.charts?.revenuePerCashier ?? []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" hide />
                          <YAxis />
                          <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                          <Line dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Attendance Trend</CardTitle></CardHeader>
                    <CardContent className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insights.charts?.attendanceTrends ?? []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="day" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(v: number) => `${v}%`} />
                          <Bar dataKey="onTimeRate" fill="#10B981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Staff Leaderboard</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {(insights.scoreboard ?? []).map((staff, idx) => (
                        <div key={staff.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">#{idx + 1} {staff.name}</p>
                            <p className="text-slate-500">{staff.attendanceScore}% attendance</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">KES {Number(staff.revenue || 0).toLocaleString()}</p>
                            <p className="text-slate-500">{staff.badge}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Peak Shift Hours Heatmap</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-6 gap-2">
                      {(insights.charts?.peakHoursWorked ?? []).map((bucket) => {
                        const intensity = Math.min(0.85, Number(bucket.count || 0) / 10)
                        return (
                          <div
                            key={bucket.hour}
                            className="rounded-lg p-2 text-center text-xs"
                            style={{ backgroundColor: `rgba(16,185,129,${0.1 + intensity})`, color: "#0F172A" }}
                            title={`${bucket.hour} - ${bucket.count} shifts`}
                          >
                            <div>{bucket.hour.slice(0, 2)}</div>
                            <div className="font-semibold">{bucket.count}</div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
