"use client"

import { useMemo } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MovementTable } from "@/components/stock-movement/movement-table"
import { RecordMovementModal } from "@/components/stock-movement/record-movement-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { stockMovements } from "@/lib/dummy-data"
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Download, TrendingUp, Package } from "lucide-react"

export default function StockMovementPage() {
  // Ensure stockMovements is defined and is an array - calculate inside component for SSR safety
  const movements = useMemo(() => {
    return Array.isArray(stockMovements) ? stockMovements : []
  }, [])

  const stats = useMemo(() => {
    const inflowCount = movements.filter((m) => m?.type === "inflow").length
    const outflowCount = movements.filter((m) => m?.type === "outflow").length
    const inflowQty = movements.filter((m) => m?.type === "inflow").reduce((sum, m) => sum + (m?.quantity || 0), 0)
    const outflowQty = movements.filter((m) => m?.type === "outflow").reduce((sum, m) => sum + (m?.quantity || 0), 0)
    const netMovement = inflowQty - outflowQty

    return [
      {
        title: "Total Inflows",
        value: inflowCount.toString(),
        subtitle: `${inflowQty.toLocaleString()} units received`,
        icon: ArrowDownCircle,
        color: "text-emerald-700",
        bgColor: "bg-emerald-100",
        borderColor: "border-emerald-200",
      },
      {
        title: "Total Outflows",
        value: outflowCount.toString(),
        subtitle: `${outflowQty.toLocaleString()} units out`,
        icon: ArrowUpCircle,
        color: "text-red-700",
        bgColor: "bg-red-100",
        borderColor: "border-red-200",
      },
      {
        title: "Net Movement",
        value: netMovement >= 0 ? `+${netMovement.toLocaleString()}` : netMovement.toLocaleString(),
        subtitle: "Units this period",
        icon: TrendingUp,
        color: netMovement >= 0 ? "text-emerald-700" : "text-red-700",
        bgColor: netMovement >= 0 ? "bg-emerald-100" : "bg-red-100",
        borderColor: netMovement >= 0 ? "border-emerald-200" : "border-red-200",
      },
      {
        title: "Total Movements",
        value: movements.length.toString(),
        subtitle: "All transactions",
        icon: Package,
        color: "text-violet-700",
        bgColor: "bg-violet-100",
        borderColor: "border-violet-200",
      },
    ]
  }, [movements])
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Stock Movement" subtitle="Track all inventory changes and transactions" />
        <div className="p-6 space-y-6">
          {/* Top toolbar */}
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-white via-white to-violet-50/30 border border-border/60 px-5 py-4 shadow-lg">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Movement History</h2>
              <p className="text-sm text-muted-foreground mt-1">
                View every inflow and outflow across your products, suppliers, and channels.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <RecordMovementModal />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card
                key={stat.title}
                className={`overflow-hidden border-2 ${stat.borderColor} bg-gradient-to-br from-card to-card/90 shadow-sm hover:shadow-md transition-shadow`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                    </div>
                    <div className={`rounded-xl ${stat.bgColor} p-3 shadow-sm flex items-center justify-center flex-shrink-0`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Movement Table */}
          <MovementTable movements={movements} />
        </div>
      </main>
    </div>
  )
}
