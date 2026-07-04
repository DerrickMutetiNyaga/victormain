"use client"

import { Suspense } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { InventoryStats } from "@/components/inventory/inventory-stats"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { AddStockModal } from "@/components/inventory/add-stock-modal"
import { Button } from "@/components/ui/button"
import { Download, Loader2, Upload } from "lucide-react"

export default function InventoryPage() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Inventory Management" subtitle="Track and manage your stock" />

        <div className="p-6 space-y-6">
          {/* Top toolbar */}
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-white via-white to-amber-50/30 border border-border/60 px-5 py-4 shadow-lg">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Stock Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor on-hand quantities, low stock alerts, and stock value in real time.
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
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <AddStockModal />
            </div>
          </div>

          {/* KPI cards */}
          <InventoryStats />

          {/* Table — Suspense required for useSearchParams (e.g. ?filter= deep links) */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card py-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm">Loading inventory…</span>
              </div>
            }
          >
            <InventoryTable />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
