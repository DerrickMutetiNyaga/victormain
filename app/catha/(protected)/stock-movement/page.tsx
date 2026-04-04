"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/layout/header"
import { MovementTable } from "@/components/stock-movement/movement-table"
import { RecordMovementModal } from "@/components/stock-movement/record-movement-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Download, TrendingUp, Package, Loader2 } from "lucide-react"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

interface StockMovement {
  id: string
  productId: string
  productName: string
  movementType: "inflow" | "outflow"
  reason: string
  quantity: number
  previousStock: number
  newStock: number
  supplier?: string
  reference: string
  date: string
  user: string
}

export default function BarStockMovementPage() {
  const { canAdd, canView } = useCathaPermissions("stockMovement")
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/catha/stock-movements')
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock movements')
      }

      const data = await response.json()
      if (data.success) {
        setMovements(data.movements || [])
      } else {
        throw new Error(data.error || 'Failed to fetch stock movements')
      }
    } catch (err: any) {
      console.error('Error fetching movements:', err)
      setError(err.message || 'Failed to load stock movements')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements()
  }, [])

  const stats = useMemo(() => {
    const inflowCount = movements.filter((m) => m.movementType === "inflow").length
    const outflowCount = movements.filter((m) => m.movementType === "outflow").length
    const inflowQty = movements.filter((m) => m.movementType === "inflow").reduce((sum, m) => sum + m.quantity, 0)
    const outflowQty = movements.filter((m) => m.movementType === "outflow").reduce((sum, m) => sum + m.quantity, 0)
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
    <>
      <Header title="Stock Movement" subtitle="Track all inventory changes and transactions" />
      <div className="space-y-6 p-4 sm:p-6">
        {/* Top toolbar */}
        <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-white via-white to-violet-50/30 border border-border/60 px-4 py-4 shadow-lg sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Movement History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              View every inflow and outflow across your products, suppliers, and channels.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:w-auto md:gap-3">
            <Button
              variant="outline"
              onClick={fetchMovements}
              disabled={isLoading}
              className="w-full gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm md:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            {canView && (
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm md:w-auto"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            {canAdd && <RecordMovementModal onSuccess={fetchMovements} />}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <MovementTable movements={movements} isLoading={isLoading} error={error} onRefresh={fetchMovements} />
      </div>
    </>
  )
}

