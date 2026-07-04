"use client"

import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Package, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface StatsCardsProps {
  data?: {
    todaySales?: number
    yesterdaySales?: number
    todayOrders?: number
    yesterdayOrders?: number
    salesChange?: string
    ordersChange?: string
    totalStockUnits?: number
    lowStockCount?: number
    totalProducts?: number
  } | null
}

function getStats(data: StatsCardsProps["data"]) {
  const salesChange = data?.salesChange ? parseFloat(data.salesChange) : 0
  const ordersChange = data?.ordersChange ? parseFloat(data.ordersChange) : 0
  return [
    {
      title: "Today's Sales",
      value: data ? `Ksh ${(data.todaySales ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}` : "—",
      change: data ? `${salesChange >= 0 ? "+" : ""}${data.salesChange}%` : "—",
      trend: salesChange >= 0 ? "up" : "down",
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Orders",
      value: data ? String(data.todayOrders ?? 0) : "—",
      change: data ? `${ordersChange >= 0 ? "+" : ""}${data.ordersChange}%` : "—",
      trend: ordersChange >= 0 ? "up" : "down",
      icon: ShoppingBag,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Items in Stock",
      value: data ? (data.totalStockUnits ?? 0).toLocaleString() : "—",
      change: "—",
      trend: "up" as const,
      icon: Package,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Low Stock Alerts",
      value: data ? String(data.lowStockCount ?? 0) : "—",
      change: "—",
      trend: "up" as const,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ]
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = getStats(data)
  return (
    <>
      {/* Desktop Stats Grid */}
      <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold text-card-foreground">{stat.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {stat.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-chart-2" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className={stat.trend === "up" ? "text-chart-2" : "text-destructive"}>{stat.change}</span>
                <span className="text-sm text-muted-foreground">vs yesterday</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mobile Stats - Horizontal scroll */}
      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-border bg-card flex-shrink-0 w-[160px]">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`rounded-lg p-1.5 ${stat.bgColor}`}>
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground truncate">{stat.title}</p>
                </div>
                <p className="text-lg font-bold text-card-foreground">{stat.value}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  {stat.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 text-chart-2" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  <span className={`text-xs ${stat.trend === "up" ? "text-chart-2" : "text-destructive"}`}>{stat.change}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
