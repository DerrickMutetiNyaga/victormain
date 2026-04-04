"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileBarChart, Download, TrendingUp, Package, Factory, FlaskConical, CheckCircle2, XCircle, Clock, Loader2, Hash, Calendar, User, Thermometer } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from "recharts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#1e293b"]

interface BatchReportData {
  totalBatches: number
  completedBatches: number
  processingBatches: number
  qcPendingBatches: number
  readyForDistributionBatches: number
  totalLitres: number
  totalBottles: number
  qcPassed: number
  qcFailed: number
  qcPending: number
  qcPassRate: string
  monthlyProduction: Array<{ month: string; batches: number; litres: number; bottles: number }>
  weeklyProduction: Array<{ date: string; batches: number; litres: number }>
  statusData: Array<{ status: string; count: number; color: string }>
  flavorDistribution: Array<{ flavor: string; batches: number; litres: number; bottles: number }>
  topBatches: Array<{
    id: string
    batchNumber: string
    flavor: string
    date: string
    totalLitres: number
    bottles250ml: number
    bottles500ml: number
    bottles1L: number
    bottles2L: number
    status: string
    qcStatus: string
    supervisor: string
  }>
  recentBatches: Array<{
    id: string
    batchNumber: string
    flavor: string
    date: string
    totalLitres: number
    bottles250ml: number
    bottles500ml: number
    bottles1L: number
    bottles2L: number
    status: string
    qcStatus: string
    supervisor: string
    shift: string
  }>
  avgLoss: number
  shiftDistribution: {
    Morning: number
    Afternoon: number
    Night: number
  }
}

export default function BatchReportsPage() {
  const [period, setPeriod] = useState("month")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<BatchReportData | null>(null)

  // Fetch report data from database
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/jaba/batch-reports')
        if (!response.ok) {
          throw new Error('Failed to fetch report data')
        }
        const data = await response.json()
        setReportData(data)
        console.log('[Batch Reports Page] Fetched report data:', data)
      } catch (error: any) {
        console.error('[Batch Reports Page] Error fetching report data:', error)
        toast.error('Failed to load report data', {
          description: error.message || 'Please try again later',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [])

  // Use report data or defaults
  const totalBatches = reportData?.totalBatches || 0
  const completedBatches = reportData?.completedBatches || 0
  const processingBatches = reportData?.processingBatches || 0
  const qcPendingBatches = reportData?.qcPendingBatches || 0
  const readyForDistributionBatches = reportData?.readyForDistributionBatches || 0
  const totalLitres = reportData?.totalLitres || 0
  const totalBottles = reportData?.totalBottles || 0
  const qcPassed = reportData?.qcPassed || 0
  const qcFailed = reportData?.qcFailed || 0
  const qcPending = reportData?.qcPending || 0
  const qcPassRate = reportData?.qcPassRate || "0"
  const monthlyProduction = reportData?.monthlyProduction || []
  const weeklyProduction = reportData?.weeklyProduction || []
  const statusData = reportData?.statusData || []
  const flavorDistribution = reportData?.flavorDistribution || []
  const topBatches = reportData?.topBatches || []
  const recentBatches = reportData?.recentBatches || []
  const shiftDistribution = reportData?.shiftDistribution || { Morning: 0, Afternoon: 0, Night: 0 }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'Completed': 'bg-green-100 text-green-800',
      'Ready for Distribution': 'bg-purple-100 text-purple-800',
      'Processing': 'bg-blue-100 text-blue-800',
      'Processed': 'bg-blue-100 text-blue-800',
      'QC Pending': 'bg-amber-100 text-amber-800',
      'QC Passed - Ready for Packaging': 'bg-green-100 text-green-800',
      'QC Failed': 'bg-red-100 text-red-800',
      'Partially Packaged': 'bg-yellow-100 text-yellow-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getQCStatusBadge = (qcStatus: string) => {
    const qcColors: Record<string, string> = {
      'Pass': 'bg-green-100 text-green-800',
      'Fail': 'bg-red-100 text-red-800',
      'Pending': 'bg-amber-100 text-amber-800',
      'In Progress': 'bg-blue-100 text-blue-800',
    }
    return qcColors[qcStatus] || 'bg-gray-100 text-gray-800'
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Batch Reports</h1>
          <p className="text-sm text-muted-foreground">Production batch analytics and performance metrics</p>
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
                  <FileBarChart className="h-5 w-5" />
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
                        <SelectItem value="Processing">Processing</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="QC Pending">QC Pending</SelectItem>
                        <SelectItem value="Ready for Distribution">Ready for Distribution</SelectItem>
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
                      <Button variant="outline" className="flex-1" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Batches</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{totalBatches}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{completedBatches} completed</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-blue-600/10">
                      <Factory className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Production</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{totalLitres.toLocaleString()}L</p>
                      <p className="mt-1 text-xs text-muted-foreground">{totalBottles.toLocaleString()} bottles</p>
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
                      <p className="text-sm text-muted-foreground">QC Pass Rate</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{qcPassRate}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">{qcPassed} passed, {qcFailed} failed</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-purple-600/10">
                      <FlaskConical className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">In Processing</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{processingBatches}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{qcPendingBatches} QC pending</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-amber-600/10">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Monthly Production Trend */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground">Monthly Production Trend</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyProduction} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="productionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                        <Area type="monotone" dataKey="litres" stroke="#3b82f6" strokeWidth={2} fill="url(#productionGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Batch Status Distribution */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground">Batch Status Distribution</CardTitle>
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
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
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
            </div>

            {/* Weekly Production */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-card-foreground">Weekly Production Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyProduction} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                      <Bar dataKey="batches" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Flavor Distribution */}
            {flavorDistribution.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground">Production by Flavor</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={flavorDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                        <XAxis dataKey="flavor" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                        <Bar dataKey="batches" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Batches by Volume */}
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold text-card-foreground">Top 10 Batches by Volume</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Batch Number</TableHead>
                        <TableHead className="font-semibold">Flavor</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Total Litres</TableHead>
                        <TableHead className="font-semibold">Bottles</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">QC Status</TableHead>
                        <TableHead className="font-semibold">Supervisor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topBatches.length > 0 ? (
                        topBatches.map((batch) => (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">
                              <Link href={`/jaba/batches/${batch.id}`} className="text-blue-600 hover:underline">
                                {batch.batchNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{batch.flavor}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(batch.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">{batch.totalLitres.toLocaleString()}L</TableCell>
                            <TableCell className="text-muted-foreground">
                              {((batch.bottles500ml || 0) + (batch.bottles1L || 0) + (batch.bottles2L || 0)).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(getStatusBadge(batch.status))}>
                                {batch.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(getQCStatusBadge(batch.qcStatus))}>
                                {batch.qcStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{batch.supervisor}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No batches found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Batches */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-card-foreground">Recent Batches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Batch Number</TableHead>
                        <TableHead className="font-semibold">Flavor</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Volume</TableHead>
                        <TableHead className="font-semibold">Shift</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">QC Status</TableHead>
                        <TableHead className="font-semibold">Supervisor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBatches.length > 0 ? (
                        recentBatches.map((batch) => (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">
                              <Link href={`/jaba/batches/${batch.id}`} className="text-blue-600 hover:underline">
                                {batch.batchNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{batch.flavor}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(batch.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">{batch.totalLitres.toLocaleString()}L</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                batch.shift === 'Morning' ? 'bg-yellow-100 text-yellow-800' :
                                batch.shift === 'Afternoon' ? 'bg-orange-100 text-orange-800' :
                                'bg-purple-100 text-purple-800'
                              )}>
                                {batch.shift}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(getStatusBadge(batch.status))}>
                                {batch.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(getQCStatusBadge(batch.qcStatus))}>
                                {batch.qcStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{batch.supervisor}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No batches found
                          </TableCell>
                        </TableRow>
                      )}
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
