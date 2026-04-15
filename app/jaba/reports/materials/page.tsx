"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, Download, TrendingUp, DollarSign, AlertTriangle, Loader2 } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const COLORS = ["#ef4444", "#10b981", "#f59e0b", "#1e293b", "#8b5cf6"]

interface MaterialReportData {
  totalMaterials: number
  lowStockMaterials: number
  totalStockValue: number
  monthlyUsageValue: number
  monthlyCost: number
  monthlyUsage: Array<{ month: string; usage: number; cost: number }>
  categoryUsage: Array<{ category: string; quantity: number; materials: number }>
  stockLevels: Array<{ level: string; count: number }>
  topMaterials: Array<{
    name: string
    category: string
    quantityUsed: number
    unit: string
    cost: number
    currentStock: number
    minStock: number
  }>
  recentLogs: Array<{
    id: string
    materialName: string
    batchNumber: string
    quantityUsed: number
    unit: string
    remainingStock: number
    date: string
    approvedBy: string
  }>
  categories: string[]
}

export default function MaterialUsageReportsPage() {
  const [period, setPeriod] = useState("month")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<MaterialReportData | null>(null)

  // Fetch report data from database
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/jaba/material-reports')
        if (!response.ok) {
          throw new Error('Failed to fetch report data')
        }
        const data = await response.json()
        setReportData(data)
        console.log('[Material Reports Page] Fetched report data:', data)
      } catch (error: any) {
        console.error('[Material Reports Page] Error fetching report data:', error)
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
  const totalMaterials = reportData?.totalMaterials || 0
  const lowStockMaterials = reportData?.lowStockMaterials || 0
  const totalStockValue = reportData?.totalStockValue || 0
  const monthlyUsageValue = reportData?.monthlyUsageValue || 0
  const monthlyCost = reportData?.monthlyCost || 0
  const monthlyUsage = reportData?.monthlyUsage || []
  const categoryUsage = reportData?.categoryUsage || []
  const stockLevels = reportData?.stockLevels || []
  const topMaterials = reportData?.topMaterials || []
  const recentLogs = reportData?.recentLogs || []
  const categories = reportData?.categories || []

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Material Usage Reports</h1>
          <p className="text-sm text-muted-foreground">Track raw material consumption and cost analysis</p>
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
              <Package className="h-5 w-5" />
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
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
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
                  <p className="text-sm text-muted-foreground">Total Materials</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{totalMaterials}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{lowStockMaterials} low stock</p>
                </div>
                <div className="rounded-lg p-2.5 bg-red-600/10">
                  <Package className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock Value</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">${(totalStockValue / 1000).toFixed(1)}k</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current inventory</p>
                </div>
                <div className="rounded-lg p-2.5 bg-green-600/10">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Usage</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{monthlyUsageValue.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Units consumed</p>
                </div>
                <div className="rounded-lg p-2.5 bg-red-600/10">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Cost</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">${(monthlyCost / 1000).toFixed(1)}k</p>
                  <p className="mt-1 text-xs text-muted-foreground">Material expenses</p>
                </div>
                <div className="rounded-lg p-2.5 bg-red-600/10">
                  <DollarSign className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Usage Trend */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Monthly Usage Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                    <Area type="monotone" dataKey="usage" stroke="#10b981" strokeWidth={2} fill="url(#usageGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stock Levels Distribution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-card-foreground">Stock Levels Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stockLevels} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count">
                      {stockLevels.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {stockLevels.map((level, idx) => (
                    <div key={level.level} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                      <span className="text-sm text-muted-foreground">{level.level}: {level.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage by Category */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-card-foreground">Usage by Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1c1c28", border: "1px solid #2a2a3c", borderRadius: "8px", color: "#fafafa" }} />
                  <Bar dataKey="quantity" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Materials by Usage */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold text-card-foreground">Top 10 Materials by Usage</CardTitle>
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
                    <TableHead className="font-semibold">Material</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Quantity Used</TableHead>
                    <TableHead className="font-semibold">Current Stock</TableHead>
                    <TableHead className="font-semibold">Min Stock</TableHead>
                    <TableHead className="font-semibold">Estimated Cost</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMaterials.map((material) => {
                    const isLowStock = material.currentStock <= material.minStock
                    return (
                      <TableRow key={material.name}>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{material.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{material.quantityUsed.toLocaleString()} {material.unit}</TableCell>
                        <TableCell className={cn("font-medium", isLowStock && "text-red-600")}>
                          {material.currentStock} {material.unit}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{material.minStock} {material.unit}</TableCell>
                        <TableCell className="font-medium">${material.cost.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            isLowStock ? "bg-red-100 text-red-800" :
                            material.currentStock <= material.minStock * 1.5 ? "bg-amber-100 text-amber-800" :
                            "bg-green-100 text-green-800"
                          )}>
                            {isLowStock ? "Low Stock" : "In Stock"}
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

        {/* Recent Usage Logs */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-card-foreground">Recent Material Usage Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Material</TableHead>
                    <TableHead className="font-semibold">Batch</TableHead>
                    <TableHead className="font-semibold">Quantity Used</TableHead>
                    <TableHead className="font-semibold">Remaining Stock</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.materialName}</TableCell>
                      <TableCell className="text-muted-foreground">{log.batchNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{log.quantityUsed} {log.unit}</TableCell>
                      <TableCell className={cn("font-medium", log.remainingStock <= 50 && "text-red-600")}>
                        {log.remainingStock} {log.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.approvedBy}</TableCell>
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
