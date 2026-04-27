"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Clock3,
  Filter,
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
  scheduledStartAt?: string
  scheduledEndAt?: string
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
  scheduledStartAt?: string
  scheduledEndAt?: string
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

type ShiftNotificationHealth = {
  recent: Array<{
    shiftId: string | null
    type: string
    status: "sent" | "failed"
    recipients: number
    error: string | null
    timestamp: string
  }>
  failuresLast24h: number
  successRate: number
}

type KpiScope = "today" | "month"
type KpiValueKind = "number" | "currency" | "percent"

function formatFreshnessLabel(lastFetchedAt: number, nowTick: number) {
  const elapsedSeconds = Math.max(0, Math.floor((nowTick - lastFetchedAt) / 1000))
  if (elapsedSeconds < 10) return "Updated just now"
  if (elapsedSeconds < 60) return `Updated ${elapsedSeconds}s ago`
  return `Updated ${Math.floor(elapsedSeconds / 60)}m ago`
}

function AnimatedKpiValue({
  value,
  kind,
}: {
  value: number
  kind: KpiValueKind
}) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const start = display
    const end = value
    const durationMs = 420
    const startedAt = performance.now()
    let raf = 0
    const step = (ts: number) => {
      const progress = Math.min(1, (ts - startedAt) / durationMs)
      const next = start + (end - start) * progress
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  if (kind === "currency") return <>{`KES ${Math.round(display).toLocaleString()}`}</>
  if (kind === "percent") return <>{`${Math.round(display)}%`}</>
  return <>{Math.round(display).toLocaleString()}</>
}

const tabOptions = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "my-shifts", label: "My Shifts", icon: User },
  { id: "team-shifts", label: "Team", icon: Users },
  { id: "history", label: "History", icon: History },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const

type TabValue = (typeof tabOptions)[number]["id"]

const kenyaTimeFormat: Intl.DateTimeFormatOptions = { timeZone: "Africa/Nairobi" }

function statusMeta(row: ShiftRow | MyShift) {
  if (row.status === "ACTIVE" || !row.endedAt) {
    return { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500", pulse: true }
  }
  if (row.status === "AUTO_CLOSED") {
    return { label: "Auto Closed", className: "bg-rose-100 text-rose-700 border-rose-200", dotClass: "bg-rose-500", pulse: false }
  }
  if (row.status === "FORGOT_CLOCK_OUT") {
    return { label: "Forgot Clock-out", className: "bg-amber-100 text-amber-700 border-amber-200", dotClass: "bg-amber-500", pulse: false }
  }
  if (row.status === "OVERTIME") {
    return { label: "Overtime", className: "bg-violet-100 text-violet-700 border-violet-200", dotClass: "bg-violet-500", pulse: false }
  }
  if (row.endedAt || row.status === "COMPLETED" || row.status === "AUTO_CLOSED") {
    return { label: "Clocked Out", className: "bg-slate-100 text-slate-700 border-slate-200", dotClass: "bg-slate-400", pulse: false }
  }
  return { label: "Clocked Out", className: "bg-slate-100 text-slate-700 border-slate-200", dotClass: "bg-slate-400", pulse: false }
}

function isLiveShift(row: ShiftRow | MyShift) {
  return row.status === "ACTIVE" || !row.endedAt
}

function formatMinuteDelta(minutes: number) {
  const abs = Math.abs(minutes)
  const hrs = Math.floor(abs / 60)
  const rem = abs % 60
  if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m`
  if (hrs > 0) return `${hrs}h`
  return `${rem}m`
}

function timingFromSchedule(actualAt?: string, scheduledAt?: string, noDataLabel = "-") {
  const scheduled = scheduledAt ? new Date(scheduledAt) : null
  const actual = actualAt ? new Date(actualAt) : null
  if (!scheduled || !actual || Number.isNaN(scheduled.getTime()) || Number.isNaN(actual.getTime())) {
    return {
      label: "No schedule",
      detail: noDataLabel,
      className: "bg-slate-100 text-slate-600 border-slate-200",
    }
  }
  const diffMinutes = Math.round((actual.getTime() - scheduled.getTime()) / 60000)
  if (diffMinutes > 0) {
    return {
      label: "Late",
      detail: `${formatMinuteDelta(diffMinutes)} late`,
      className: "bg-orange-100 text-orange-700 border-orange-200",
    }
  }
  if (diffMinutes < 0) {
    return {
      label: "Early",
      detail: `${formatMinuteDelta(diffMinutes)} early`,
      className: "bg-sky-100 text-sky-700 border-sky-200",
    }
  }
  return {
    label: "On Time",
    detail: "On time",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  }
}

function clockInTimingMeta(row: ShiftRow | MyShift) {
  return timingFromSchedule(row.startedAt, row.scheduledStartAt)
}

function clockOutTimingMeta(row: ShiftRow | MyShift) {
  if (!row.endedAt) {
    return {
      label: "Active",
      detail: "Active",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    }
  }
  return timingFromSchedule(row.endedAt, row.scheduledEndAt)
}

function timingMeta(row: ShiftRow | MyShift) {
  return clockInTimingMeta(row)
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

function formatDate(dateLike: string) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-KE", kenyaTimeFormat)
}

function formatTime(dateLike?: string) {
  if (!dateLike) return "-"
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleTimeString("en-KE", kenyaTimeFormat)
}

function rowKey(row: ShiftRow | MyShift, scope: string, index: number) {
  const id = String(row._id ?? "")
  if (id) return `${scope}-${id}-${row.startedAt}`
  return `${scope}-${row.startedAt}-${row.endedAt ?? "active"}-${index}`
}

export default function WorkforceHubPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabValue>("overview")
  const [query, setQuery] = useState("")
  const [range, setRange] = useState("month")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [dashboardRows, setDashboardRows] = useState<ShiftRow[]>([])
  const [historyRows, setHistoryRows] = useState<ShiftRow[]>([])
  const [myRows, setMyRows] = useState<MyShift[]>([])
  const [cards, setCards] = useState<Record<string, unknown>>({})
  const [insights, setInsights] = useState<InsightsResponse>({})
  const [loading, setLoading] = useState(true)
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(Date.now())
  const [freshnessNowTick, setFreshnessNowTick] = useState<number>(Date.now())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notificationHealth, setNotificationHealth] = useState<ShiftNotificationHealth>({
    recent: [],
    failuresLast24h: 0,
    successRate: 1,
  })
  const [notificationFilter, setNotificationFilter] = useState<"all" | "sent" | "failed">("all")

  const role = String((session?.user as { role?: string } | undefined)?.role ?? "").toUpperCase()
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role)
  const isCashier = role === "CASHIER"

  useEffect(() => {
    if (sessionStatus !== "loading" && isCashier) {
      router.replace("/catha/my-shift")
    }
  }, [sessionStatus, isCashier, router])

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
        setHistoryRows((historyData.shifts ?? []) as ShiftRow[])
        setInsights((insightsData ?? {}) as InsightsResponse)
        setLastFetchedAt(Date.now())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [range, fromDate, toDate])

  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessNowTick(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetch(`/api/catha/shifts/notifications/health?limit=20&filter=${notificationFilter}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setNotificationHealth({
          recent: Array.isArray(data?.recent) ? data.recent : [],
          failuresLast24h: Number(data?.failuresLast24h ?? 0),
          successRate: Number(data?.successRate ?? 1),
        })
      })
      .catch(() => {})
  }, [isAdmin, notificationFilter])

  if (sessionStatus === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">Loading workforce hub...</div>
  }

  if (isCashier) {
    return <div className="p-6 text-sm text-muted-foreground">Redirecting to My Shift...</div>
  }

  const filteredTeamRows = useMemo(() => {
    const teamSource = dashboardRows.length > 0 ? dashboardRows : historyRows
    const base = isAdmin ? teamSource : teamSource.filter((row) => row.status === "ACTIVE" || !row.endedAt)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((row) => row.staffName.toLowerCase().includes(q))
  }, [dashboardRows, historyRows, isAdmin, query])

  const attendanceScore = Number(cards.attendanceScoreMonth ?? 100)
  const hoursWorkedTodayMs = Number(cards.hoursWorkedTodayMs ?? 0)
  const hoursWorkedToday = `${(hoursWorkedTodayMs / 3_600_000).toFixed(1)}h`
  const activeDelta = Number(cards.activeShiftsDeltaFromYesterday ?? 0)
  const activeDeltaLabel = `${activeDelta >= 0 ? "+" : ""}${activeDelta} from yesterday`

  const kpis = useMemo(
    () => [
      {
        title: "Active Staff",
        value: Number(cards.activeShiftsNow ?? 0),
        valueKind: "number" as KpiValueKind,
        icon: Users,
        tint: "from-emerald-500 to-green-400",
        trend: activeDeltaLabel,
        scope: "today" as KpiScope,
        emptyLabel: "No activity today",
        onClick: () => setActiveTab("team-shifts" as TabValue),
      },
      {
        title: "Hours Worked",
        value: Number(hoursWorkedTodayMs / 3_600_000),
        valueKind: "number" as KpiValueKind,
        icon: Clock3,
        tint: "from-sky-500 to-cyan-400",
        trend: "Across all shifts today",
        scope: "today" as KpiScope,
        suffix: "h",
        emptyLabel: "No activity today",
      },
      {
        title: "Revenue Today",
        value: Number(cards.revenueToday ?? 0),
        valueKind: "currency" as KpiValueKind,
        icon: TrendingUp,
        tint: "from-indigo-500 to-violet-500",
        trend: "Live service revenue today",
        scope: "today" as KpiScope,
        emptyLabel: "No activity today",
      },
      {
        title: "Late Arrivals",
        value: Number(cards.lateArrivalsMonth ?? 0),
        valueKind: "number" as KpiValueKind,
        icon: AlertTriangle,
        tint: "from-amber-500 to-orange-500",
        trend: "This month performance",
        scope: "month" as KpiScope,
        emptyLabel: "No late arrivals this month",
        onClick: () => setActiveTab("history" as TabValue),
      },
      {
        title: "Attendance Score",
        value: attendanceScore,
        valueKind: "percent" as KpiValueKind,
        icon: ShieldCheck,
        tint: "from-teal-500 to-emerald-500",
        trend: "On-time consistency this month",
        scope: "month" as KpiScope,
      },
      {
        title: "Pending Clock-outs",
        value: Number(cards.pendingClockOutsToday ?? 0),
        valueKind: "number" as KpiValueKind,
        icon: TimerReset,
        tint: "from-slate-500 to-slate-400",
        trend: "Awaiting shift closure",
        scope: "today" as KpiScope,
        emptyLabel: "No pending clock-outs",
        onClick: () => setActiveTab("team-shifts" as TabValue),
      },
    ],
    [activeDeltaLabel, attendanceScore, cards, hoursWorkedMs]
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

  const revenueTotal = useMemo(
    () => dashboardRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0),
    [dashboardRows]
  )

  function formatCurrency(value: number) {
    return `KES ${Number(value || 0).toLocaleString()}`
  }

  function handleRangeChange(nextRange: string) {
    setRange(nextRange)
    if (nextRange !== "custom") {
      setFiltersOpen(false)
    }
  }

  function handleFromDateChange(nextFromDate: string) {
    setFromDate(nextFromDate)
    if (range !== "custom") {
      setFiltersOpen(false)
    }
  }

  function handleToDateChange(nextToDate: string) {
    setToDate(nextToDate)
    if (nextToDate) {
      setFiltersOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100/70 p-2 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px] space-y-3 lg:space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Workforce Hub</h1>
                <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Today Live Pulse
                </Badge>
              </div>
              <p className="text-sm text-slate-600">Live attendance, payroll and shift operations.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                {formatFreshnessLabel(lastFetchedAt, freshnessNowTick)}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                Active staff: <span className="font-semibold text-slate-900">{Number(cards.activeShiftsNow ?? 0)}</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                Revenue: <span className="font-semibold text-slate-900">{formatCurrency(revenueTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee..."
                aria-label="Search employee"
                className="h-10 rounded-xl border-slate-200 bg-white pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="h-10 rounded-xl border-slate-200 bg-white px-3"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
            <Button variant="outline" onClick={exportCsv} className="hidden h-10 rounded-xl border-slate-200 bg-white px-3 md:inline-flex">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button className="hidden h-10 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700 md:inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Add Shift
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                key="filters-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 sm:p-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[160px_170px_170px_auto]">
                    <Select value={range} onValueChange={handleRangeChange}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => handleFromDateChange(e.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                    />
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => handleToDateChange(e.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                    />
                    <div className="flex items-center text-xs text-slate-600">Use custom dates for deep history and payroll checks.</div>
                  </div>
                  <div className="mt-2 grid gap-2 md:hidden">
                    <Button variant="outline" onClick={exportCsv} className="h-10 rounded-xl border-slate-200 bg-white px-3">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    <Button className="h-10 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Shift
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => (
            <motion.div key={kpi.title} whileHover={{ y: -2 }}>
              <Card
                onClick={kpi.onClick}
                role={kpi.onClick ? "button" : undefined}
                tabIndex={kpi.onClick ? 0 : -1}
                className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
                  kpi.onClick ? "cursor-pointer transition hover:border-slate-300" : ""
                }`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${kpi.tint}`} />
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.title}</p>
                      <Badge
                        className={`mt-1 border px-2 py-0.5 text-[10px] ${
                          kpi.scope === "today"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : "border-blue-200 bg-blue-100 text-blue-700"
                        }`}
                      >
                        {kpi.scope === "today" ? "Today" : "This Month"}
                      </Badge>
                      {Number(kpi.value) === 0 && kpi.emptyLabel ? (
                        <p className="mt-1 text-sm font-medium text-slate-500">{kpi.emptyLabel}</p>
                      ) : (
                        <motion.p
                          key={`${kpi.title}-${String(kpi.value)}`}
                          initial={{ opacity: 0.45 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.35 }}
                          className="mt-1 text-2xl font-semibold leading-none text-slate-900"
                        >
                          <AnimatedKpiValue value={Number(kpi.value)} kind={kpi.valueKind} />
                          {kpi.suffix ? kpi.suffix : null}
                        </motion.p>
                      )}
                      <p className="mt-1.5 truncate text-[11px] text-slate-500">{kpi.trend}</p>
                    </div>
                    <div className={`rounded-lg bg-gradient-to-r p-2 text-white shadow-sm ${kpi.tint}`}>
                      <kpi.icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700">Today (live data)</Badge>
          <Badge className="border border-blue-200 bg-blue-100 text-blue-700">This Month (performance)</Badge>
        </div>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="overflow-x-auto">
              <div className="relative flex w-max min-w-full items-center gap-1 rounded-xl bg-slate-100 p-1">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative h-9 overflow-hidden rounded-lg px-3 text-sm transition-all ${active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
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
                <motion.div key="overview" {...panelMotion} className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    <Card className="rounded-2xl border border-slate-200 shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Live Team Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="space-y-2 p-3 md:hidden">
                          {filteredTeamRows.slice(0, 12).map((row, index) => {
                            const status = statusMeta(row)
                            return (
                              <div key={rowKey(row, "overview-mobile", index)} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="relative">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                                          {initials(row.staffName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {isLiveShift(row) ? (
                                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                      ) : null}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="truncate text-sm font-semibold text-slate-900">{row.staffName}</p>
                                        {isLiveShift(row) ? <span className="text-[11px] font-semibold text-emerald-600">Active</span> : null}
                                      </div>
                                      <p className="truncate text-xs text-slate-500">{row.role || "Team member"}</p>
                                    </div>
                                  </div>
                                  <Badge className={`border text-xs ${status.className}`}>
                                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                    {status.label}
                                  </Badge>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                  <p className="text-slate-500">
                                    Clock In <span className="ml-1 font-medium text-slate-800">{formatTime(row.startedAt)} ({clockInTimingMeta(row).detail})</span>
                                  </p>
                                  <p className="text-slate-500">
                                    Clock Out <span className="ml-1 font-medium text-slate-800">{formatTime(row.endedAt)} ({clockOutTimingMeta(row).detail})</span>
                                  </p>
                                  <p className="text-slate-500">Worked <span className="ml-1 font-medium text-slate-800">{hoursWorked(row.startedAt, row.endedAt)}</span></p>
                                  <p className="text-slate-500">Orders <span className="ml-1 font-medium text-slate-800">{row.ordersServed}</span></p>
                                  <p className="text-slate-500">Revenue <span className="ml-1 font-medium text-slate-800">{formatCurrency(row.totalRevenue)}</span></p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                          <table className="min-w-[980px] w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2.5 font-medium">Staff</th>
                                <th className="px-3 py-2.5 font-medium">Role</th>
                                <th className="px-3 py-2.5 font-medium">Clock In</th>
                                <th className="px-3 py-2.5 font-medium">Clock Out</th>
                                <th className="px-3 py-2.5 font-medium">Worked</th>
                                <th className="px-3 py-2.5 font-medium">Orders</th>
                                <th className="px-3 py-2.5 font-medium">Revenue</th>
                                <th className="px-3 py-2.5 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredTeamRows.slice(0, 12).map((row, index) => {
                                const status = statusMeta(row)
                                const clockInTiming = clockInTimingMeta(row)
                                const clockOutTiming = clockOutTimingMeta(row)
                                return (
                                  <tr key={rowKey(row, "overview", index)} className="border-t border-slate-100 align-middle">
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="relative">
                                          <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                                              {initials(row.staffName)}
                                            </AvatarFallback>
                                          </Avatar>
                                          {isLiveShift(row) ? (
                                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                          ) : null}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium text-slate-900">{row.staffName}</p>
                                          {isLiveShift(row) ? <p className="text-[11px] font-semibold text-emerald-600">Active</p> : null}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700">{row.role || "Team member"}</td>
                                    <td className="px-3 py-2.5 text-slate-700">
                                      <div className="flex flex-col gap-1">
                                        <span>{formatTime(row.startedAt)}</span>
                                        <Badge className={`w-fit border ${clockInTiming.className}`}>{clockInTiming.detail}</Badge>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700">
                                      <div className="flex flex-col gap-1">
                                        <span>{formatTime(row.endedAt)}</span>
                                        <Badge className={`w-fit border ${clockOutTiming.className}`}>{clockOutTiming.detail}</Badge>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700">{hoursWorked(row.startedAt, row.endedAt)}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{row.ordersServed}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{formatCurrency(row.totalRevenue)}</td>
                                    <td className="px-3 py-2.5">
                                      <Badge className={`border text-xs ${status.className}`}>
                                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                        {status.label}
                                      </Badge>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {!loading && filteredTeamRows.length === 0 && (
                          <div className="px-4 py-8 text-center text-sm text-slate-500">No live shift records for this filter.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-3">
                    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-sm">Attendance Ring</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[160px]">
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
                          {formatCurrency(Number(insights.insights?.mostProductiveRevenue ?? 0))} generated
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

                    {isAdmin ? (
                      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm">Shift Notifications</CardTitle>
                            <Select value={notificationFilter} onValueChange={(value) => setNotificationFilter(value as "all" | "sent" | "failed")}>
                              <SelectTrigger className="h-8 w-[120px] rounded-lg border-slate-200 bg-white text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="sent">Success</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                              <p className="text-slate-500">Failures (24h)</p>
                              <p className="text-sm font-semibold text-slate-900">{notificationHealth.failuresLast24h}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                              <p className="text-slate-500">Success Rate</p>
                              <p className="text-sm font-semibold text-slate-900">
                                {(notificationHealth.successRate * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {notificationHealth.recent.slice(0, 20).map((event, index) => (
                              <div key={`${event.timestamp}-${event.shiftId ?? "none"}-${index}`} className="rounded-lg border border-slate-200 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-slate-800">
                                    {event.type} - {event.status}
                                  </span>
                                  <Badge
                                    className={
                                      event.status === "sent"
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border border-rose-200 bg-rose-50 text-rose-700"
                                    }
                                  >
                                    {event.status}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-slate-500">
                                  {formatTime(event.timestamp)} | recipients: {event.recipients}
                                </p>
                                {event.error ? <p className="text-rose-600">{event.error}</p> : null}
                              </div>
                            ))}
                            {notificationHealth.recent.length === 0 ? <p className="text-slate-500">No notification events yet.</p> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </motion.div>
              )}

              {activeTab === "my-shifts" && (
                <motion.div key="my-shifts" {...panelMotion} className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-[860px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Clock In</th>
                          <th className="px-4 py-3 font-medium">Clock Out</th>
                          <th className="px-4 py-3 font-medium">Hours</th>
                          <th className="px-4 py-3 font-medium">Revenue</th>
                          <th className="px-4 py-3 font-medium">Orders</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRows.map((row, index) => {
                          const status = statusMeta(row)
                          return (
                            <tr key={rowKey(row, "my-shifts", index)} className="border-t border-slate-100">
                              <td className="px-4 py-3 text-slate-900">{formatDate(row.startedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.startedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{hoursWorked(row.startedAt, row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-700">{row.ordersServed}</td>
                              <td className="px-4 py-3">
                                <Badge className={`border ${status.className}`}>
                                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                  {status.label}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!loading && myRows.length === 0 && <div className="rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500">No personal shifts found.</div>}
                </motion.div>
              )}

              {activeTab === "team-shifts" && (
                <motion.div key="team-shifts" {...panelMotion} className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Staff</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Clock In</th>
                          <th className="px-4 py-3 font-medium">Clock Out</th>
                          <th className="px-4 py-3 font-medium">Hours</th>
                          <th className="px-4 py-3 font-medium">Orders</th>
                          <th className="px-4 py-3 font-medium">Revenue</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeamRows.map((row, index) => {
                          const status = statusMeta(row)
                          return (
                            <tr key={rowKey(row, "team-shifts", index)} className="border-t border-slate-100">
                              <td className="px-4 py-3 font-medium text-slate-900">{row.staffName}</td>
                              <td className="px-4 py-3 text-slate-700">{row.role || "-"}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.startedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{hoursWorked(row.startedAt, row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{row.ordersServed}</td>
                              <td className="px-4 py-3 text-slate-700">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <Badge className={`border ${status.className}`}>
                                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                  {status.label}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!loading && filteredTeamRows.length === 0 && <div className="rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500">No team shifts found.</div>}
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div key="history" {...panelMotion} className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Clock In</th>
                          <th className="px-4 py-3 font-medium">Clock Out</th>
                          <th className="px-4 py-3 font-medium">Hours</th>
                          <th className="px-4 py-3 font-medium">Orders</th>
                          <th className="px-4 py-3 font-medium">Revenue</th>
                          <th className="px-4 py-3 font-medium">Timing</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row, index) => {
                          const status = statusMeta(row)
                          const timing = timingMeta(row)
                          return (
                            <tr key={rowKey(row, "history", index)} className="border-t border-slate-100">
                              <td className="px-4 py-3 text-slate-900">{formatDate(row.startedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.startedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{formatTime(row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{hoursWorked(row.startedAt, row.endedAt)}</td>
                              <td className="px-4 py-3 text-slate-700">{row.ordersServed}</td>
                              <td className="px-4 py-3 text-slate-700">KES {Number(row.totalRevenue || 0).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <Badge className={`border ${timing.className}`}>{timing.detail}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`border ${status.className}`}>
                                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status.dotClass} ${status.pulse ? "animate-pulse" : ""}`} />
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{(row as ShiftRow).notes || "No notes"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
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
                    <CardHeader className="pb-2"><CardTitle className="text-base">Peak Shift Hours</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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
