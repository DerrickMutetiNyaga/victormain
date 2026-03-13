import { Header } from "@/components/layout/header"
import { SalesReport } from "@/components/reports/sales-report"
import { StaffPerformance } from "@/components/reports/staff-performance"
import { ProductPerformance } from "@/components/reports/product-performance"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { salesData } from "@/lib/dummy-data"
import { DollarSign, TrendingUp, ShoppingBag, Percent, Download, Calendar } from "lucide-react"

const stats = [
  {
    title: "Monthly Revenue",
    value: `$${salesData.thisMonth.toLocaleString()}`,
    change: "+8.2%",
    icon: DollarSign,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Monthly Profit",
    value: "$412,580",
    change: "+12.4%",
    icon: TrendingUp,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    title: "Total Orders",
    value: "4,856",
    change: "+5.8%",
    icon: ShoppingBag,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
  {
    title: "Profit Margin",
    value: "33.1%",
    change: "+2.1%",
    icon: Percent,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
]

export default function ReportsPage() {
  return (
    <>
        <Header title="Reports & Analytics" subtitle="Business intelligence dashboard" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Performance Overview</h2>
              <p className="text-sm text-muted-foreground">December 2024</p>
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
                      <p className="mt-1 text-xs text-chart-2">{stat.change} vs last month</p>
                    </div>
                    <div className={`rounded-lg p-2.5 ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesReport />
            </div>
            <StaffPerformance />
          </div>

          <ProductPerformance />
        </div>
    </>
  )
}
