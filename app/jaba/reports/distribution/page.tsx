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
  totalItemsDelivered: number
  deliveryRate: number
  activeDistributors: number
  monthlyDistribution: Array<{ month: string; deliveries: number; items: number }>
  statusData: Array<{ status: string; count: number; color: string }>
  topDistributors: Array<{
    name: string
    region: string
    totalDeliveries: number
    delivered: number
    totalItems: number
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
        const response = await fetch('/api/jaba/distribution-reports')
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
  }, [])

  // Use report data or defaults
  const totalDeliveries = reportData?.totalDeliveries || 0
  const deliveredCount = reportData?.deliveredCount || 0
  const pendingCount = reportData?.pendingCount || 0
  const inTransitCount = reportData?.inTransitCount || 0
  const totalItemsDelivered = reportData?.totalItemsDelivered || 0
  const deliveryRate = reportData?.deliveryRate || 0
  const activeDistributors = reportData?.activeDistributors || 0
  const monthlyDistribution = reportData?.monthlyDistribution || []
  const statusData = reportData?.statusData || []
  const topDistributors = reportData?.topDistributors || []
  const weeklyDistribution = reportData?.weeklyDistribution || []
  const recentDeliveries = reportData?.recentDeliveries || []

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Distribution Reports</h1>
          <p className="text-sm text-muted-foreground">Delivery summaries and distributor performance analytics</p>
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
                  <p className="text-sm text-muted-foreground">Delivery Rate</p>
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
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Distribution Trend */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Monthly Distribution Trend</CardTitle>
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
              <CardTitle className="text-lg font-semibold text-card-foreground">Distribution Status</CardTitle>
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
        </div>

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

        {/* Top Distributors */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold text-card-foreground">Top 10 Distributors by Volume</CardTitle>
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
                    <TableHead className="font-semibold">Distributor</TableHead>
                    <TableHead className="font-semibold">Region</TableHead>
                    <TableHead className="font-semibold">Total Deliveries</TableHead>
                    <TableHead className="font-semibold">Delivered</TableHead>
                    <TableHead className="font-semibold">Items Delivered</TableHead>
                    <TableHead className="font-semibold">Monthly Volume</TableHead>
                    <TableHead className="font-semibold">Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDistributors.map((dist) => {
                    const performance = dist.totalDeliveries > 0 ? ((dist.delivered / dist.totalDeliveries) * 100).toFixed(1) : "0"
                    return (
                      <TableRow key={dist.name}>
                        <TableCell className="font-medium">{dist.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dist.region}</TableCell>
                        <TableCell className="font-medium">{dist.totalDeliveries}</TableCell>
                        <TableCell className="text-muted-foreground">{dist.delivered}</TableCell>
                        <TableCell className="font-medium">{dist.totalItems.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{dist.totalItems > 0 ? `${dist.totalItems.toLocaleString()} units` : "0"}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            parseFloat(performance) >= 90 ? "bg-green-100 text-green-800" :
                            parseFloat(performance) >= 70 ? "bg-amber-100 text-amber-800" :
                            "bg-red-100 text-red-800"
                          )}>
                            {performance}%
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
                      <TableCell className="text-muted-foreground">{note.driver || "N/A"}</TableCell>
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
