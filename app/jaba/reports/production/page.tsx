"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileBarChart, Download, TrendingUp, Calendar, Loader2, Factory, Package } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

interface ProductionReportData {
  totalBatches: number
  completedBatches: number
  totalLitres: number
  avgLitresPerBatch: number
  completionRate: number
  avgEfficiency: number
  monthlyProduction: Array<{ month: string; batches: number; litres: number; efficiency: number }>
  weeklyProduction: Array<{ day: string; litres: number; batches: number }>
  shiftData: Array<{ shift: string; batches: number; litres: number }>
  flavorData: Array<{ flavor: string; batches: number; litres: number }>
  recentBatches: Array<{
    id: string
    batchNumber: string
    flavor: string
    date: string
    totalLitres: number
    shift: string
    status: string
    expectedLoss: number
    efficiency: string
  }>
}

export default function ProductionReportsPage() {
  const [period, setPeriod] = useState("month")
  const [dateRange, setDateRange] = useState("thisMonth")
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ProductionReportData | null>(null)

  // Fetch report data from database
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          period,
          dateRange,
        })
        const response = await fetch(`/api/jaba/production-reports?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch report data')
        }
        const data = await response.json()
        setReportData(data)
        console.log('[Production Reports Page] Fetched report data:', data)
      } catch (error: any) {
        console.error('[Production Reports Page] Error fetching report data:', error)
        toast.error('Failed to load report data', {
          description: error.message || 'Please try again later',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [period, dateRange])

  // Use report data or defaults
  const totalBatches = reportData?.totalBatches || 0
  const completedBatches = reportData?.completedBatches || 0
  const totalLitres = reportData?.totalLitres || 0
  const avgLitresPerBatch = reportData?.avgLitresPerBatch || 0
  const completionRate = reportData?.completionRate || 0
  const avgEfficiency = reportData?.avgEfficiency || 0
  const monthlyProduction = reportData?.monthlyProduction || []
  const weeklyProduction = reportData?.weeklyProduction || []
  const shiftData = reportData?.shiftData || []
  const flavorData = reportData?.flavorData || []
  const recentBatches = reportData?.recentBatches || []

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Production Reports</h1>
          <p className="text-sm text-muted-foreground">Daily, weekly, and monthly production analytics</p>
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
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="lastMonth">Last Month</SelectItem>
                        <SelectItem value="last3Months">Last 3 Months</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Export Format</Label>
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" 
                        size="sm"
                        onClick={async () => {
                          try {
                            const params = new URLSearchParams({
                              period,
                              dateRange,
                            })
                            const response = await fetch(`/api/jaba/production-reports/export/pdf?${params.toString()}`)
                            if (!response.ok) {
                              throw new Error('Failed to export PDF')
                            }
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            const contentDisposition = response.headers.get('Content-Disposition')
                            const filename = contentDisposition 
                              ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
                              : `production_report_${dateRange}_${new Date().toISOString().split('T')[0]}.html`
                            a.download = filename
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                            document.body.removeChild(a)
                            toast.success('PDF exported successfully!')
                          } catch (error: any) {
                            console.error('Error exporting PDF:', error)
                            toast.error('Failed to export PDF')
                          }
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        size="sm"
                        onClick={async () => {
                          try {
                            const params = new URLSearchParams({
                              period,
                              dateRange,
                            })
                            const response = await fetch(`/api/jaba/production-reports/export/excel?${params.toString()}`)
                            if (!response.ok) {
                              throw new Error('Failed to export Excel')
                            }
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            const contentDisposition = response.headers.get('Content-Disposition')
                            const filename = contentDisposition 
                              ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
                              : `production_report_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`
                            a.download = filename
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                            document.body.removeChild(a)
                            toast.success('Excel exported successfully!')
                          } catch (error: any) {
                            console.error('Error exporting Excel:', error)
                            toast.error('Failed to export Excel')
                          }
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Excel
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
                    <div className="rounded-lg p-2.5 bg-red-600/10">
                      <Factory className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Litres</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{totalLitres.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Avg: {avgLitresPerBatch.toFixed(0)}L/batch</p>
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
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">
                        {completionRate.toFixed(1)}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Production efficiency</p>
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
                      <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                      <p className="mt-1 text-2xl font-bold text-card-foreground">{avgEfficiency.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-green-600/10">
                      <TrendingUp className="h-5 w-5 text-green-600" />
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
                          <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                        <Area type="monotone" dataKey="litres" stroke="#ef4444" strokeWidth={2} fill="url(#monthlyGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Production by Shift */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground">Production by Shift</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                        <XAxis dataKey="shift" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                        <Bar dataKey="litres" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
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
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                      <Bar dataKey="litres" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Flavors */}
            {flavorData.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground">Top 10 Flavors by Production</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={flavorData} layout="vertical" margin={{ top: 10, right: 10, left: 100, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                        <YAxis dataKey="flavor" type="category" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} width={90} />
                        <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                        <Bar dataKey="litres" fill="#10b981" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Production Batches Table */}
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold text-card-foreground">Recent Production Batches</CardTitle>
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
                        <TableHead className="font-semibold">Batch No.</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Flavor</TableHead>
                        <TableHead className="font-semibold">Litres</TableHead>
                        <TableHead className="font-semibold">Shift</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Efficiency</TableHead>
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
                            <TableCell className="text-muted-foreground">
                              {new Date(batch.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{batch.flavor}</TableCell>
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
                            <TableCell className="text-muted-foreground">
                              {batch.efficiency}%
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
