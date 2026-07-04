"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Truck, Download, TrendingUp, Package, MapPin, Loader2, Hash, Calendar, User } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#1e293b"]

interface DistributionReportData {
  totalDeliveries: number
  deliveredCount: number
  pendingCount: number
  inTransitCount: number
  totalAmountInvoiced: number
  totalAmountCollected: number
  outstandingAmount: number
  paymentCollectionRate: number
  totalItemsDelivered: number
  deliveryRate: number
  activeDistributors: number
  period: string
  statusFilter: string
  monthlyDistribution: Array<{ month: string; deliveries: number; items: number }>
  statusData: Array<{ status: string; count: number; color: string }>
  paymentStatusData: Array<{ status: string; count: number; color: string }>
  agingBuckets: Array<{ bucket: string; amount: number; count: number }>
  topDistributors: Array<{
    name: string
    region: string
    totalDeliveries: number
    delivered: number
    totalItems: number
    totalInvoiced: number
    totalCollected: number
    outstanding: number
    collectionRate: number
  }>
  weeklyDistribution: Array<{ date: string; deliveries: number }>
  recentDeliveries: Array<{
    id: string
    noteId: string
    distributorName: string
    batchNumber: string
    date: string
    items: Array<{ size: string; quantity: number }>
    driver: string
    vehicle: string
    paymentStatus: string
    paymentAmount: number
    paymentReason: string
    totalCost: number
    remainingAmount: number
    status: string
  }>
}

export default function DistributionReportsPage() {
  const [period, setPeriod] = useState("month")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<DistributionReportData | null>(null)

  // Fetch report data from database
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          period,
          status: statusFilter,
        })
        const response = await fetch(`/api/jaba/distribution-reports?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch report data')
        }
        const data = await response.json()
        setReportData(data)
        console.log('[Distribution Reports Page] Fetched report data:', data)
      } catch (error: any) {
        console.error('[Distribution Reports Page] Error fetching report data:', error)
        toast.error('Failed to load report data', {
          description: error.message || 'Please try again later',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [period, statusFilter])

  // Use report data or defaults
  const totalDeliveries = reportData?.totalDeliveries || 0
  const deliveredCount = reportData?.deliveredCount || 0
  const pendingCount = reportData?.pendingCount || 0
  const inTransitCount = reportData?.inTransitCount || 0
  const totalItemsDelivered = reportData?.totalItemsDelivered || 0
  const totalAmountInvoiced = reportData?.totalAmountInvoiced || 0
  const totalAmountCollected = reportData?.totalAmountCollected || 0
  const outstandingAmount = reportData?.outstandingAmount || 0
  const paymentCollectionRate = reportData?.paymentCollectionRate || 0
  const deliveryRate = reportData?.deliveryRate || 0
  const activeDistributors = reportData?.activeDistributors || 0
  const monthlyDistribution = reportData?.monthlyDistribution || []
  const statusData = reportData?.statusData || []
  const paymentStatusData = reportData?.paymentStatusData || []
  const agingBuckets = reportData?.agingBuckets || []
  const topDistributors = reportData?.topDistributors || []
  const weeklyDistribution = reportData?.weeklyDistribution || []
  const recentDeliveries = reportData?.recentDeliveries || []

  const periodLabel = period === "week" ? "Last 7 days" : period === "quarter" ? "Last 90 days" : "Last 30 days"

  const formatKes = (value: number) =>
    `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const escapeCsvValue = (value: string | number) => {
    const stringValue = String(value ?? "")
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }

  const handleExportCsv = () => {
    if (!reportData) {
      toast.error("No report data to export")
      return
    }

    const generatedAt = new Date().toISOString()
    const summaryRows = [
      ["Metric", "Value"],
      ["Period", periodLabel],
      ["Status Filter", statusFilter],
      ["Generated At", generatedAt],
      ["Total Deliveries", totalDeliveries],
      ["Delivered", deliveredCount],
      ["Pending", pendingCount],
      ["In Transit", inTransitCount],
      ["Total Items Delivered", totalItemsDelivered],
      ["Total Invoiced", totalAmountInvoiced.toFixed(2)],
      ["Amount Collected", totalAmountCollected.toFixed(2)],
      ["Pending Collection", outstandingAmount.toFixed(2)],
      ["Collection Rate (%)", paymentCollectionRate.toFixed(2)],
    ]

    const distributorRows = [
      [],
      ["Distributor Collection Performance"],
      ["Distributor", "Region", "Deliveries", "Delivered", "Items", "Invoiced", "Collected", "Outstanding", "Collection Rate (%)"],
      ...topDistributors.map((dist) => [
        dist.name,
        dist.region,
        dist.totalDeliveries,
        dist.delivered,
        dist.totalItems,
        dist.totalInvoiced.toFixed(2),
        dist.totalCollected.toFixed(2),
        dist.outstanding.toFixed(2),
        dist.collectionRate.toFixed(2),
      ]),
    ]

    const deliveryRows = [
      [],
      ["Recent Delivery Notes"],
      ["Note ID", "Distributor", "Batch", "Date", "Items", "Driver", "Vehicle", "Invoiced", "Collected", "Remaining", "Payment Status", "Payment Note", "Delivery Status"],
      ...recentDeliveries.map((note) => [
        note.noteId,
        note.distributorName,
        note.batchNumber,
        new Date(note.date).toISOString(),
        note.items?.map((item: any) => `${item.quantity}x${item.size}`).join(" | ") || "",
        note.driver || "N/A",
        note.vehicle || "N/A",
        note.totalCost.toFixed(2),
        note.paymentAmount.toFixed(2),
        note.remainingAmount.toFixed(2),
        note.paymentStatus || "Unpaid",
        note.paymentReason || "",
        note.status || "",
      ]),
    ]

    const csvRows = [...summaryRows, ...distributorRows, ...deliveryRows]
    const csvContent = csvRows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const safePeriod = period.replace(/\s+/g, "-")
    const safeStatus = statusFilter.replace(/\s+/g, "-")
    link.href = url
    link.download = `distribution-report-${safePeriod}-${safeStatus}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("CSV export downloaded")
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Distribution Reports</h1>
          <p className="text-sm text-muted-foreground">Delivery and payment analytics ({periodLabel}{statusFilter !== "all" ? `, ${statusFilter}` : ""})</p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Loading report data...</p>
          </div>
        ) : (
          <>
        {/* Filters */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Export Format</Label>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm" onClick={handleExportCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{totalDeliveries}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{deliveredCount} delivered</p>
                </div>
                <div className="rounded-lg p-2.5 bg-green-600/10">
                  <Truck className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Items Delivered</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{totalItemsDelivered.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total units</p>
                </div>
                <div className="rounded-lg p-2.5 bg-green-600/10">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Completion Rate</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">
                    {totalDeliveries > 0 ? ((deliveredCount / totalDeliveries) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Success rate</p>
                </div>
                <div className="rounded-lg p-2.5 bg-green-600/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Distributors</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{activeDistributors}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total partners</p>
                </div>
                <div className="rounded-lg p-2.5 bg-red-600/10">
                  <MapPin className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Collected</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">
                    {formatKes(totalAmountCollected)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paymentCollectionRate.toFixed(1)}% of {formatKes(totalAmountInvoiced)}
                  </p>
                </div>
                <div className="rounded-lg p-2.5 bg-emerald-600/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Collection</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">
                    {formatKes(outstandingAmount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Remaining balance from delivery notes</p>
                </div>
                <div className="rounded-lg p-2.5 bg-amber-600/10">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monthly Distribution Trend */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Distribution Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                    <Area type="monotone" dataKey="items" stroke="#10b981" strokeWidth={2} fill="url(#distGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribution Status */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Delivery Status Mix</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {statusData.map((status) => (
                    <div key={status.status} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-muted-foreground">{status.status}: {status.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Payment Status Mix</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count">
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`payment-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {paymentStatusData.map((status) => (
                    <div key={status.status} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-muted-foreground">{status.status}: {status.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Distribution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Weekly Distribution Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                    <Bar dataKey="deliveries" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Aging */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Outstanding Aging</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                    <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: any) =>
                        name === "amount" ? [formatKes(Number(value) || 0), "Outstanding"] : [value, name]
                      }
                      contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }}
                    />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Distributors */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold text-card-foreground">Top 10 Distributors by Volume</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Distributor</TableHead>
                    <TableHead className="font-semibold">Region</TableHead>
                    <TableHead className="font-semibold">Total Deliveries</TableHead>
                    <TableHead className="font-semibold">Delivered</TableHead>
                    <TableHead className="font-semibold">Items Delivered</TableHead>
                    <TableHead className="font-semibold">Invoiced</TableHead>
                    <TableHead className="font-semibold">Collected</TableHead>
                    <TableHead className="font-semibold">Outstanding</TableHead>
                    <TableHead className="font-semibold">Collection Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDistributors.map((dist) => {
                    return (
                      <TableRow key={dist.name}>
                        <TableCell className="font-medium">{dist.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dist.region}</TableCell>
                        <TableCell className="font-medium">{dist.totalDeliveries}</TableCell>
                        <TableCell className="text-muted-foreground">{dist.delivered}</TableCell>
                        <TableCell className="font-medium">{dist.totalItems.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{formatKes(dist.totalInvoiced)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatKes(dist.totalCollected)}</TableCell>
                        <TableCell className="font-medium">{formatKes(dist.outstanding)}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            dist.collectionRate >= 90 ? "bg-green-100 text-green-800" :
                            dist.collectionRate >= 70 ? "bg-amber-100 text-amber-800" :
                            "bg-red-100 text-red-800"
                          )}>
                            {dist.collectionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-card-foreground">Recent Delivery Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Note ID</TableHead>
                    <TableHead className="font-semibold">Distributor</TableHead>
                    <TableHead className="font-semibold">Batch</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Items</TableHead>
                    <TableHead className="font-semibold">Driver</TableHead>
                    <TableHead className="font-semibold">Invoiced</TableHead>
                    <TableHead className="font-semibold">Collected</TableHead>
                    <TableHead className="font-semibold">Remaining</TableHead>
                    <TableHead className="font-semibold">Payment</TableHead>
                    <TableHead className="font-semibold">Payment Note</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeliveries.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-medium">{note.noteId}</TableCell>
                      <TableCell>{note.distributorName}</TableCell>
                      <TableCell className="text-muted-foreground">{note.batchNumber}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(note.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {note.items && note.items.length > 0 ? (
                          note.items.map((item: any, idx: number) => (
                            <span key={idx} className="text-xs block">
                              {item.quantity}×{item.size}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="text-xs space-y-0.5">
                          <div>{note.driver || "N/A"}</div>
                          <div className="text-[11px]">{note.vehicle || "N/A"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatKes(note.totalCost)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatKes(note.paymentAmount)}</TableCell>
                      <TableCell className="font-medium">{formatKes(note.remainingAmount)}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          note.paymentStatus === "Paid" ? "bg-green-100 text-green-800" :
                          note.paymentStatus === "Partial" ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        )}>
                          {note.paymentStatus || "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[240px]">
                        <span className="text-xs line-clamp-2" title={note.paymentReason || "No payment note"}>
                          {note.paymentReason || "No payment note"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          note.status === "Delivered" ? "bg-green-100 text-green-800" :
                          note.status === "In Transit" ? "bg-red-100 text-red-800" :
                          "bg-amber-100 text-amber-800"
                        )}>
                          {note.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </>
  )
}
