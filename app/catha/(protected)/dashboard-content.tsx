'use client'

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { CategoryChart } from "@/components/dashboard/category-chart"
import { TopSelling } from "@/components/dashboard/top-selling"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { StockAlerts } from "@/components/dashboard/stock-alerts"
import { Loader2 } from "lucide-react"

export default function BarDashboardContent({ userName }: { userName: string }) {
  const welcomeName = userName?.split(' ')[0] ?? 'User'
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/catha/dashboard')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load dashboard')
        setDashboardData(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading && !dashboardData) {
    return (
      <>
        <Header title="Dashboard" subtitle={`Welcome back, ${welcomeName}`} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Dashboard" subtitle={`Welcome back, ${welcomeName}`} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <StatsCards data={dashboardData?.stats} />
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          <SalesChart hourlyStats={dashboardData?.hourlyStats} weeklyData={dashboardData?.weeklyData} />
          <CategoryChart categoryStats={dashboardData?.categoryStats} />
        </div>
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          <TopSelling items={dashboardData?.topSellingItems} products={dashboardData?.products} />
          <RecentTransactions transactions={dashboardData?.recentTransactions} />
          <StockAlerts items={dashboardData?.lowStockItems} products={dashboardData?.products} />
        </div>
      </div>
    </>
  )
}
