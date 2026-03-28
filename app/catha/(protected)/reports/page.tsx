 "use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DollarSign, TrendingUp, ShoppingBag, Percent, Download, Calendar } from "lucide-react"
import { toast } from "sonner"

type ReportData = {
  summary: {
    revenue: number
    orders: number
    avgOrderValue: number
  }
  paymentBreakdown: Array<{ method: string; total: number; count: number }>
  topProducts: Array<{ productId: string; name: string; revenue: number; quantity: number }>
}

function formatKsh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const now = new Date()
  const [startDate, setStartDate] = useState<string>(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [endDate, setEndDate] = useState<string>(isoDate(now))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData>({
    summary: { revenue: 0, orders: 0, avgOrderValue: 0 },
    paymentBreakdown: [],
    topProducts: [],
  })

  const loadReports = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates.")
      return
    }
    if (startDate > endDate) {
      toast.error("Start date cannot be after end date.")
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/catha/reports?${params.toString()}`, { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || "Failed to load reports")
      setData({
        summary: result.summary || { revenue: 0, orders: 0, avgOrderValue: 0 },
        paymentBreakdown: result.paymentBreakdown || [],
        topProducts: result.topProducts || [],
      })
    } catch (error: any) {
      toast.error(error?.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleExportReport = () => {
    if (!startDate || !endDate) {
      toast.error("Please select date range first.")
      return
    }
    if (startDate > endDate) {
      toast.error("Start date cannot be after end date.")
      return
    }
    const params = new URLSearchParams({ startDate, endDate, format: "csv" })
    window.open(`/api/catha/reports?${params.toString()}`, "_blank")
  }

  const stats = useMemo(() => [
    {
      title: "Revenue",
      value: formatKsh(data.summary.revenue),
      note: `${data.summary.orders} completed orders`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Orders",
      value: `${data.summary.orders}`,
      note: "Completed orders in range",
      icon: TrendingUp,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Avg Order Value",
      value: data.summary.orders > 0 ? formatKsh(Math.round(data.summary.avgOrderValue)) : "—",
      note: data.summary.orders > 0 ? "Average ticket value" : "No completed orders yet",
      icon: ShoppingBag,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Date Range",
      value: `${startDate} → ${endDate}`,
      note: "Active report period",
      icon: Percent,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ], [data.summary, startDate, endDate])

  const rangeLabel = `${startDate} to ${endDate}`

  return (
    <>
      <Header title="Reports & Analytics" subtitle="Business intelligence dashboard" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Performance Overview</h2>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-[145px] border-0 p-0 shadow-none focus-visible:ring-0"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-[145px] border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={loadReports} disabled={loading}>
              <Calendar className="h-4 w-4" />
              Date Range
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={handleExportReport}>
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="mt-1 text-2xl font-bold text-card-foreground">{stat.value}</p>
                    <p className="mt-1 text-xs text-chart-2">{stat.note}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment breakdown */}
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Revenue by payment method</h3>
            {data.paymentBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.paymentBreakdown.map((row) => (
                    <TableRow key={row.method}>
                      <TableCell className="capitalize">
                        {row.method || "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKsh(Math.round(row.total || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Top products by revenue</h3>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((row, index) => (
                    <TableRow key={row.productId || index}>
                      <TableCell className="text-xs text-muted-foreground">#{index + 1}</TableCell>
                      <TableCell>{row.name || row.productId}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKsh(Math.round(row.revenue || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
