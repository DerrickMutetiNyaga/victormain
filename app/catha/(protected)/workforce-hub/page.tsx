"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  History,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  User,
  Users,
  Trophy,
  Download,
} from "lucide-react"
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
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "my-shifts", label: "My Shifts", icon: User },
  { id: "team-shifts", label: "Team", icon: Users },
  { id: "history", label: "History", icon: History },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const

type TabValue = (typeof tabOptions)[number]["id"]

function statusMeta(row: ShiftRow | MyShift) {
  const isLate = ["yellow", "orange", "red"].includes(String(row.metadata?.latenessBand ?? ""))
  if (row.status === "OVERTIME") {
    return { label: "Overtime", className: "bg-sky-100 text-sky-700 border-sky-200", dotClass: "bg-sky-500", pulse: false }
  }
  if (row.status === "ACTIVE" || !row.endedAt) {
    return isLate
      ? { label: "Active (Late)", className: "bg-orange-100 text-orange-700 border-orange-200", dotClass: "bg-orange-500", pulse: true }
      : { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500", pulse: true }
  }
  if (row.endedAt || row.status === "COMPLETED" || row.status === "AUTO_CLOSED") {
    return { label: "Clocked Out", className: "bg-slate-100 text-slate-700 border-slate-200", dotClass: "bg-slate-400", pulse: false }
  }
  return { label: "Absent", className: "bg-rose-100 text-rose-700 border-rose-200", dotClass: "bg-rose-500", pulse: false }
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
      { title: "Active Staff", value: Number(cards.activeShiftsNow ?? 0), icon: Users, tint: "from-emerald-500 to-green-400", trend: "+2 from yesterday" },
      {
        title: "Hours Worked",
        value: `${(
          dashboardRows.reduce(
            (sum, row) => sum + (new Date(row.endedAt ?? Date.now()).getTime() - new Date(row.startedAt).getTime()),
            0
          ) / 3_600_000
        ).toFixed(1)}h`,
        icon: Clock3,
        tint: "from-sky-500 to-cyan-400",
        trend: "Across all live shifts",
      },
      {
        title: "Revenue Today",
        value: `KES ${dashboardRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0).toLocaleString()}`,
        icon: TrendingUp,
        tint: "from-indigo-500 to-violet-500",
        trend: "Live service revenue",
      },
      { title: "Late Arrivals", value: Number(cards.lateArrivalsToday ?? 0), icon: AlertTriangle, tint: "from-amber-500 to-orange-500", trend: "Needs immediate review" },
      { title: "Attendance Score", value: `${attendanceScore}%`, icon: ShieldCheck, tint: "from-teal-500 to-emerald-500", trend: "On-time consistency today" },
      {
        title: "Pending Clock-outs",
        value: dashboardRows.filter((r) => r.status === "ACTIVE" && !r.endedAt).length,
        icon: TimerReset,
        tint: "from-slate-500 to-slate-400",
        trend: "Awaiting shift closure",
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
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.1),_transparent_40%)] p-4 md:p-6">
      <div className="mx-auto max-w-[1720px] space-y-5 2xl:space-y-6">
        <div className="sticky top-3 z-20 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Workforce Hub</h1>
                <Badge className="rounded-full border border-emerald-200 bg-emerald-100 px-3 text-emerald-700">
                  <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Today Live Pulse
                </Badge>
              </div>
              <p className="text-sm text-slate-500">Live attendance, payroll & shift operations</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[280px_150px_140px_140px_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee..."
                  aria-label="Search employee"
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-9"
                />
              </div>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-white" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-11 rounded-2xl border-slate-200 bg-white" />
              <Button variant="outline" onClick={exportCsv} className="h-11 rounded-2xl border-slate-200 bg-white">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button className="h-11 rounded-2xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600">
                <Plus className="mr-2 h-4 w-4" />
                Add Shift
              </Button>
            </div>
          </div>
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => (
            <motion.div key={kpi.title} whileHover={{ y: -5 }} className="min-w-[250px] flex-1 snap-start sm:min-w-0">
              <Card className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md">
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${kpi.tint}`} />
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <span className="text-sm text-slate-500">{kpi.title}</span>
                    <div className={`rounded-2xl bg-gradient-to-r p-2.5 text-white ${kpi.tint}`}>
                      <kpi.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold tracking-tight text-slate-900">
                    {kpi.value}
                  </motion.div>
                  <p className="mt-1 text-xs text-slate-500">{kpi.trend}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="overflow-x-auto">
              <div className="relative flex w-max min-w-full items-center gap-1 rounded-2xl bg-slate-100 p-1">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative h-10 overflow-hidden rounded-xl px-4 text-sm transition-all ${active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      {active ? (
                        <motion.span
                          layoutId="workforce-segment-active-pill"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-xl bg-white shadow-sm"
                        />
                      ) : null}
                      <Icon className="relative z-10 mr-2 h-4 w-4" />
                      <span className="relative z-10 flex items-center">
                        {tab.label}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div key="overview" {...panelMotion} className="grid grid-cols-12 gap-4 xl:gap-5 2xl:gap-6">
                  <div className="col-span-12 space-y-3 xl:col-span-8">
                    <div className="space-y-3">
                      {filteredTeamRows.slice(0, 12).map((row) => {
                        const status = statusMeta(row)
                        return (
                          <motion.div key={row._id} whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex min-w-[230px] items-center gap-3">
                                <Avatar className="h-11 w-11">
                                  <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
                                    {initials(row.staffName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-slate-900">{row.staffName}</p>
                                  <p className="text-xs text-slate-500">{row.role || "Team member"}</p>
                                </div>
                              </div>

                              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                                <div>
                                  <p className="text-xs text-slate-500">Clock In</p>
                                  <p className="font-medium text-slate-800">{new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Worked</p>
                                  <p className="font-medium text-slate-800">{hoursWorked(row.startedAt, row.endedAt)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Orders</p>
                                  <p className="font-medium text-slate-800">{row.ordersServed}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Revenue</p>
                                  <p className="font-medium text-slate-800">KES {Number(row.totalRevenue || 0).toLocaleString()}</p>
                                </div>
                                <div className="flex items-end">
                                  <Badge className={`border ${status.className}`}>
                                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                    {status.label}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="rounded-xl border-slate-200">View</Button>
                                <Button variant="outline" size="sm" className="rounded-xl border-slate-200">Edit</Button>
                                <Button size="sm" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">End Shift</Button>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                      {!loading && filteredTeamRows.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                          No live shift records for this filter.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-12 space-y-4 xl:col-span-4">
                    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-sm">Attendance Ring</CardTitle>
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
                            <RadialBar dataKey="value" cornerRadius={12} fill="#10B981" />
                            <Tooltip formatter={(v: number) => `${v}%`} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <p className="-mt-4 text-center text-xl font-semibold text-[#0F172A]">{attendanceScore}%</p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Top Performer</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="mb-2 inline-flex rounded-full bg-amber-100 p-2 text-amber-600">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div className="font-semibold text-slate-900">{insights.insights?.mostProductiveEmployee ?? "No data"}</div>
                        <div className="mt-1 text-slate-600">
                          KES {Number(insights.insights?.mostProductiveRevenue ?? 0).toLocaleString()} generated
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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

                    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                          <Badge className={`border ${status.className}`}>
                            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                            {status.label}
                          </Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {!loading && myRows.length === 0 && <div className="text-sm text-slate-500">No personal shifts found.</div>}
                </motion.div>
              )}

              {activeTab === "team-shifts" && (
                <motion.div key="team-shifts" {...panelMotion} className="space-y-3">
                  {filteredTeamRows.map((row) => {
                    const status = statusMeta(row)
                    return (
                      <div key={row._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{row.staffName}</p>
                            <p className="text-xs text-slate-500">{row.role || "-"}</p>
                          </div>
                          <div className="grid min-w-[280px] grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                            <div><p className="text-xs text-slate-500">Clock In</p><p>{new Date(row.startedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}</p></div>
                            <div><p className="text-xs text-slate-500">Clock Out</p><p>{row.endedAt ? new Date(row.endedAt).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</p></div>
                            <div><p className="text-xs text-slate-500">Hours</p><p>{hoursWorked(row.startedAt, row.endedAt)}</p></div>
                            <div><p className="text-xs text-slate-500">Revenue</p><p>KES {Number(row.totalRevenue || 0).toLocaleString()}</p></div>
                          </div>
                          <Badge className={`border ${status.className}`}>
                            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
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
                            <Badge className={`border ${status.className}`}>
                              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                              {status.label}
                            </Badge>
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
