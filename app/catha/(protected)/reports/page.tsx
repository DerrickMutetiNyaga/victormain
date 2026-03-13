import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingUp, ShoppingBag, Percent, Download, Calendar } from "lucide-react"
import { getDatabase } from "@/lib/mongodb"

type ReportsSummary = {
  todayRevenue: number
  monthRevenue: number
  todayOrders: number
  monthOrders: number
}

async function getReportsSummary(): Promise<ReportsSummary> {
  const db = await getDatabase("infusion_jaba")
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayAgg] = await db
    .collection("orders")
    .aggregate<{ total: number; count: number }>([
      { $match: { status: "completed", timestamp: { $gte: startToday, $lte: now } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ])
    .toArray()

  const [monthAgg] = await db
    .collection("orders")
    .aggregate<{ total: number; count: number }>([
      { $match: { status: "completed", timestamp: { $gte: startMonth, $lte: now } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ])
    .toArray()

  const todayRevenue = todayAgg?.total ?? 0
  const todayOrders = todayAgg?.count ?? 0
  const monthRevenue = monthAgg?.total ?? 0
  const monthOrders = monthAgg?.count ?? 0

  return { todayRevenue, monthRevenue, todayOrders, monthOrders }
}

type PaymentBreakdownRow = {
  method: string
  total: number
  count: number
}

type TopProductRow = {
  productId: string
  name: string
  revenue: number
  quantity: number
}

async function getPaymentBreakdown(): Promise<PaymentBreakdownRow[]> {
  const db = await getDatabase("infusion_jaba")
  const rows = await db
    .collection("orders")
    .aggregate<PaymentBreakdownRow>([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: { $ifNull: ["$paymentMethod", "unknown"] },
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ])
    .toArray()

  return rows.map((r) => ({
    method: r.method ?? r["_id"],
    total: r.total,
    count: r.count,
  }))
}

async function getTopProducts(limit = 5): Promise<TopProductRow[]> {
  const db = await getDatabase("infusion_jaba")
  const rows = await db
    .collection("orders")
    .aggregate<TopProductRow>([
      { $match: { status: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ])
    .toArray()

  return rows.map((r) => ({
    productId: r.productId ?? r["_id"],
    name: r.name,
    revenue: r.revenue,
    quantity: r.quantity,
  }))
}

function formatKsh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`
}

export default async function ReportsPage() {
  const [summary, paymentBreakdown, topProducts] = await Promise.all([
    getReportsSummary(),
    getPaymentBreakdown(),
    getTopProducts(),
  ])
  const avgToday = summary.todayOrders > 0 ? summary.todayRevenue / summary.todayOrders : 0
  const avgMonth = summary.monthOrders > 0 ? summary.monthRevenue / summary.monthOrders : 0

  const stats = [
    {
      title: "Today Revenue",
      value: formatKsh(summary.todayRevenue),
      note: `${summary.todayOrders} completed orders`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Month Revenue",
      value: formatKsh(summary.monthRevenue),
      note: `${summary.monthOrders} completed orders`,
      icon: TrendingUp,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Avg Order (Today)",
      value: summary.todayOrders > 0 ? formatKsh(Math.round(avgToday)) : "—",
      note: summary.todayOrders > 0 ? "Average ticket value" : "No completed orders yet",
      icon: ShoppingBag,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Avg Order (Month)",
      value: summary.monthOrders > 0 ? formatKsh(Math.round(avgMonth)) : "—",
      note: summary.monthOrders > 0 ? "Month-to-date average ticket" : "No completed orders yet",
      icon: Percent,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ] as const

  const now = new Date()
  const monthLabel = now.toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  })

  return (
    <>
      <Header title="Reports & Analytics" subtitle="Business intelligence dashboard" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Performance Overview</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 bg-transparent">
              <Calendar className="h-4 w-4" />
              Date Range
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent">
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
            {paymentBreakdown.length === 0 ? (
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
                  {paymentBreakdown.map((row) => (
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
            {topProducts.length === 0 ? (
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
                  {topProducts.map((row, index) => (
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
