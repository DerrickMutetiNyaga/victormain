"use client"

import { useMemo } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { SuppliersTable } from "@/components/suppliers/suppliers-table"
import { AddSupplierModal } from "@/components/suppliers/add-supplier-modal"
import { DeliveryModal } from "@/components/suppliers/delivery-modal"
import { Card, CardContent } from "@/components/ui/card"
import { suppliers } from "@/lib/dummy-data"
import { Truck, DollarSign, Package, Clock } from "lucide-react"

export default function SuppliersPage() {
  // Ensure suppliers is defined and is an array - calculate inside component for SSR safety
  const suppliersList = useMemo(() => {
    return Array.isArray(suppliers) ? suppliers : []
  }, [])

  const stats = useMemo(() => {
    const activeCount = suppliersList.filter((s) => s?.status === "active").length
    const totalBalance = suppliersList.reduce((sum, s) => sum + (s?.balance || 0), 0)

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
        title: "Pending Orders",
        value: "8",
        subtitle: "Awaiting delivery",
        icon: Package,
        color: "text-violet-700",
        bgColor: "bg-violet-100",
        borderColor: "border-violet-200",
      },
      {
        title: "Deliveries This Week",
        value: "12",
        subtitle: "Completed deliveries",
        icon: Clock,
        color: "text-emerald-700",
        bgColor: "bg-emerald-100",
        borderColor: "border-emerald-200",
      },
    ]
  }, [suppliersList])
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Suppliers & Distributors" subtitle="Manage your supply chain and vendor relationships" />
        <div className="p-6 space-y-6">
          {/* Top toolbar */}
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-white via-white to-sky-50/30 border border-border/60 px-5 py-4 shadow-lg">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Supplier Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">Track suppliers, deliveries, and outstanding balances</p>
            </div>
            <div className="flex gap-3">
              <DeliveryModal />
              <AddSupplierModal />
            </div>
          </div>

          {/* Stats */}
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

          {/* Suppliers Table */}
          <SuppliersTable suppliers={suppliersList} />
        </div>
      </main>
    </div>
  )
}
