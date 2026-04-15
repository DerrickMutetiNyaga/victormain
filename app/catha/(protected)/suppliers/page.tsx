"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/layout/header"
import { SuppliersTable } from "@/components/suppliers/suppliers-table"
import { AddSupplierModal } from "@/components/suppliers/add-supplier-modal"
import { DeliveryModal } from "@/components/suppliers/delivery-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Truck, DollarSign, Package, Clock, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

interface Supplier {
  id: string
  name: string
  category: string
  contact: string
  email: string
  phone: string
  address: string
  balance: number
  status: "active" | "inactive"
  lastDelivery: string | Date | null
}

export default function BarSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { canAdd, canEdit, canDelete } = useCathaPermissions("suppliers")

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/catha/suppliers')
      
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers')
      }

      const data = await response.json()
      if (data.success) {
        setSuppliers(data.suppliers || [])
      } else {
        throw new Error(data.error || 'Failed to fetch suppliers')
      }
    } catch (err: any) {
      console.error('Error fetching suppliers:', err)
      setError(err.message || 'Failed to load suppliers')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const stats = useMemo(() => {
    const activeCount = suppliers.filter((s) => s.status === "active").length
    const totalBalance = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0)
    
    return [
      {
        title: "Active Suppliers",
        value: activeCount.toString(),
        subtitle: "Currently active",
        icon: Truck,
        color: "text-sky-700",
        bgColor: "bg-sky-100",
        borderColor: "border-sky-200",
      },
      {
        title: "Total Outstanding",
        value: "Ksh " + totalBalance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        subtitle: "Amount owed",
        icon: DollarSign,
        color: "text-amber-700",
        bgColor: "bg-amber-100",
        borderColor: "border-amber-200",
      },
      {
        title: "Total Suppliers",
        value: suppliers.length.toString(),
        subtitle: "All suppliers",
        icon: Package,
        color: "text-violet-700",
        bgColor: "bg-violet-100",
        borderColor: "border-violet-200",
      },
      {
        title: "Categories",
        value: Array.from(new Set(suppliers.map(s => s.category))).length.toString(),
        subtitle: "Unique categories",
        icon: Clock,
        color: "text-emerald-700",
        bgColor: "bg-emerald-100",
        borderColor: "border-emerald-200",
      },
    ]
  }, [suppliers])

  return (
    <>
      <Header title="Suppliers & Distributors" subtitle="Manage your supply chain and vendor relationships" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
        {/* Top toolbar - Desktop */}
        <div className="hidden md:flex items-center justify-between rounded-2xl bg-gradient-to-br from-white via-white to-sky-50/30 border border-border/60 px-5 py-4 shadow-lg">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Supplier Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">Track suppliers, deliveries, and outstanding balances</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchSuppliers}
              disabled={isLoading}
              className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm"
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
            {canAdd && (
              <>
                <DeliveryModal onSuccess={fetchSuppliers} />
                <AddSupplierModal onSuccess={fetchSuppliers} />
              </>
            )}
          </div>
        </div>

        {/* Top toolbar - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="rounded-xl bg-white border border-border/60 px-4 py-3 shadow-sm">
            <h2 className="text-base font-bold text-foreground">Supplier Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track suppliers & balances</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSuppliers}
              disabled={isLoading}
              className="flex-1 min-w-[80px] gap-2 rounded-xl h-10 text-xs"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            {canAdd && (
              <>
                <DeliveryModal onSuccess={fetchSuppliers} />
                <AddSupplierModal onSuccess={fetchSuppliers} />
              </>
            )}
          </div>
        </div>

        {/* Stats - Desktop */}
        <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Stats - Mobile horizontal scroll */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {stats.map((stat) => (
              <Card
                key={stat.title}
                className={`flex-shrink-0 w-[130px] overflow-hidden border ${stat.borderColor} bg-white shadow-sm`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`rounded-lg ${stat.bgColor} p-1.5`}>
                      <stat.icon className={`h-3 w-3 ${stat.color}`} />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                      {stat.title}
                    </p>
                  </div>
                  <p className="text-base font-bold text-foreground truncate">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Suppliers Table */}
        <SuppliersTable suppliers={suppliers} isLoading={isLoading} error={error} onRefresh={fetchSuppliers} canEdit={canEdit} canDelete={canDelete} />
      </div>
    </>
  )
}

