"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { InventoryStats } from "@/components/inventory/inventory-stats"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { AddStockModal } from "@/components/inventory/add-stock-modal"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

export default function BarInventoryPage() {
  const [isExporting, setIsExporting] = useState(false)
  const { canView, canAdd } = useCathaPermissions("inventory")

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await fetch('/api/catha/inventory/export')
      
      if (!response.ok) {
        throw new Error('Failed to export inventory')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `bar_inventory_${new Date().toISOString().split('T')[0]}.xlsx`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Inventory exported successfully!', {
        description: 'Your inventory data has been downloaded as an Excel file.',
      })
    } catch (error: any) {
      console.error('Error exporting inventory:', error)
      toast.error('Failed to export inventory', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Header title="Inventory Management" subtitle="Track and manage your stock" />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
        {/* Top toolbar - Desktop */}
        <div className="hidden md:flex items-center justify-between rounded-2xl bg-gradient-to-br from-white via-white to-amber-50/30 border border-border/60 px-5 py-4 shadow-lg">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Stock Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor on-hand quantities, low stock alerts, and stock value in real time.
            </p>
          </div>
          <div className="flex gap-3">
            {canView && (
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            )}
            {canAdd && <AddStockModal />}
          </div>
        </div>

        {/* Top toolbar - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="rounded-xl bg-white border border-border/60 px-4 py-3 shadow-sm">
            <h2 className="text-base font-bold text-foreground">Stock Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor quantities & low stock alerts
            </p>
          </div>
          <div className="flex gap-2">
            {canView && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 rounded-xl border-border/70 bg-white shadow-sm text-xs h-10"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            )}
            {canAdd && <AddStockModal />}
          </div>
        </div>

        {/* KPI cards */}
        <InventoryStats />

        {/* Table */}
        <InventoryTable />
      </div>
    </>
  )
}

