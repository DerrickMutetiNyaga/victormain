"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Warehouse, Truck, Search, Package, MapPin, Calendar, FileText, Hash, TrendingUp, TrendingDown, History, Eye, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

type SizeBreakdown = { original: number; distributed: number; remaining: number }

interface FlavourRow {
  key: string
  label: string
  total250ml: SizeBreakdown
  total500ml: SizeBreakdown
  total1L: SizeBreakdown
  total2L: SizeBreakdown
  totalBottles: { original: number; distributed: number; remaining: number }
}

interface BatchSummary {
  _id: string
  id: string
  batchNumber: string
  flavor: string
  productType: string
  date: string
  total250ml: SizeBreakdown
  total500ml: SizeBreakdown
  total1L: SizeBreakdown
  total2L: SizeBreakdown
  totalBottles: { original: number; distributed: number; remaining: number }
  status: "Available" | "Sold Out"
  /** Packaged − distributed, per flavour line */
  byFlavour?: FlavourRow[]
  packagingOutputs: Array<{
    _id: string
    packageNumber: string
    packagingDate: string
    packagingLine: string
  }>
}

interface ProductDetail {
  size: "250ml" | "500ml" | "1L" | "2L"
  originalQuantity: number
  distributedQuantity: number
  remainingQuantity: number
}

export default function FinishedGoodsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch batches from database
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/jaba/finished-goods')
        if (!response.ok) {
          throw new Error('Failed to fetch batches')
        }
        const data = await response.json()
        setBatches(data.batches || [])
        console.log('[Finished Goods Page] Fetched batches:', data.batches?.length || 0)
      } catch (error: any) {
        console.error('[Finished Goods Page] Error fetching batches:', error)
        toast.error('Failed to load batches', {
          description: error.message || 'Please try again later',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBatches()
  }, [])

  const filteredBatches = batches.filter((batch) =>
    batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.flavor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.productType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get detailed products for selected batch
  const selectedBatchSummary = selectedBatch
    ? batches.find((b) => b.batchNumber === selectedBatch)
    : null

  const selectedBatchProducts: ProductDetail[] = selectedBatchSummary
    ? [
        {
          size: "250ml",
          originalQuantity: selectedBatchSummary.total250ml.original,
          distributedQuantity: selectedBatchSummary.total250ml.distributed,
          remainingQuantity: selectedBatchSummary.total250ml.remaining,
        },
        {
          size: "500ml",
          originalQuantity: selectedBatchSummary.total500ml.original,
          distributedQuantity: selectedBatchSummary.total500ml.distributed,
          remainingQuantity: selectedBatchSummary.total500ml.remaining,
        },
        {
          size: "1L",
          originalQuantity: selectedBatchSummary.total1L.original,
          distributedQuantity: selectedBatchSummary.total1L.distributed,
          remainingQuantity: selectedBatchSummary.total1L.remaining,
        },
        {
          size: "2L",
          originalQuantity: selectedBatchSummary.total2L.original,
          distributedQuantity: selectedBatchSummary.total2L.distributed,
          remainingQuantity: selectedBatchSummary.total2L.remaining,
        },
      ].filter((p) => p.originalQuantity > 0)
    : []

  /** Modal table: per flavour × size when API provides byFlavour */
  const modalInventoryRows: Array<{
    flavour: string
    size: string
    originalQuantity: number
    distributedQuantity: number
    remainingQuantity: number
  }> = selectedBatchSummary
    ? (() => {
        const bf = selectedBatchSummary.byFlavour
        if (bf && bf.length > 0) {
          const fromFlavour = bf.flatMap((f) => {
            const parts = [
              { size: "250ml", t: f.total250ml },
              { size: "500ml", t: f.total500ml },
              { size: "1L", t: f.total1L },
              { size: "2L", t: f.total2L },
            ].filter(
              (x) => x.t.original > 0 || x.t.distributed > 0 || x.t.remaining > 0
            )
            return parts.map((p) => ({
              flavour: f.label,
              size: p.size,
              originalQuantity: p.t.original,
              distributedQuantity: p.t.distributed,
              remainingQuantity: p.t.remaining,
            }))
          })
          if (fromFlavour.length > 0) return fromFlavour
        }
        return selectedBatchProducts.map((p) => ({
          flavour: selectedBatchSummary!.flavor,
          size: p.size,
          originalQuantity: p.originalQuantity,
          distributedQuantity: p.distributedQuantity,
          remainingQuantity: p.remainingQuantity,
        }))
      })()
    : []

  const totalBatches = batches.length
  const totalBottles = batches.reduce((sum, b) => sum + b.totalBottles.remaining, 0)
  const soldOutBatches = batches.filter((b) => b.status === "Sold Out").length
  const availableBatches = batches.filter((b) => b.status === "Available").length

  const sizeCard = (
    label: string,
    short: string,
    t: SizeBreakdown,
    colors: { border: string; bg: string; text: string; accent: string; borderT: string }
  ) => (
    <div
      key={short}
      className={cn("p-3 rounded-lg border", colors.border, colors.bg)}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Package className={cn("h-3.5 w-3.5", colors.accent)} />
        <span className={cn("text-xs font-semibold uppercase", colors.text)}>{label}</span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400">Original:</span>
          <span className={cn("font-bold", colors.text)}>{t.original.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400">Distributed:</span>
          <span className={cn("font-semibold", colors.accent)}>{t.distributed.toLocaleString()}</span>
        </div>
        <div className={cn("flex justify-between text-xs pt-1 border-t", colors.borderT)}>
          <span className={cn("font-semibold", colors.text)}>Remaining:</span>
          <span className={cn("font-bold text-lg", colors.text)}>{t.remaining.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shrink-0">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground sm:text-xl">Finished Goods Warehouse</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Track batches and product inventory</p>
          </div>
        </div>
        <Link href="/jaba/distribution/create" className="w-full sm:w-auto shrink-0">
          <Button className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30 sm:w-auto">
            <Truck className="mr-2 h-4 w-4" />
            Create Delivery Note
          </Button>
        </Link>
      </header>

      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Total Batches</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">{totalBatches}</p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Hash className="h-3 w-3" />
                    <span>Active batches</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Hash className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Total Bottles</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">{totalBottles.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <Warehouse className="h-3 w-3" />
                    <span>In stock</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <Warehouse className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Sold Out</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">{soldOutBatches}</p>
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <XCircle className="h-3 w-3" />
                    <span>Batches</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Available</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">{availableBatches}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Batches</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 shadow-md">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <Input
                placeholder="Search batches, flavors, or product types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500 h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Batches List */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                <Hash className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              All Batches ({filteredBatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">Loading batches...</p>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Warehouse className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-medium">
                      {searchQuery ? "No batches match your search" : "No packaged batches found"}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-muted-foreground/70">
                        Batches will appear here once they have been packaged
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                filteredBatches.map((batch, idx) => {
                  const isSoldOut = batch.status === "Sold Out"
                  
                  return (
                    <Card
                      key={batch.batchNumber}
                      className={cn(
                        "border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer",
                        isSoldOut
                          ? "border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/50 to-rose-50/30 dark:from-red-950/20 dark:to-rose-950/10"
                          : "border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10"
                      )}
                      onClick={() => setSelectedBatch(batch.batchNumber)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={cn(
                                "p-2.5 rounded-lg border-2",
                                isSoldOut
                                  ? "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-900/30"
                                  : "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-900/30"
                              )}>
                                <Hash className={cn(
                                  "h-5 w-5",
                                  isSoldOut
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                )} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                    {batch.batchNumber}
                                  </h3>
                                  <Badge className={cn(
                                    "font-semibold text-xs px-2.5 py-1",
                                    isSoldOut
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  )}>
                                    {isSoldOut && <XCircle className="h-3 w-3 mr-1 inline" />}
                                    {!isSoldOut && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                                    {batch.status}
                                  </Badge>
                                </div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  {batch.flavor} • {batch.productType}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500">
                                  {new Date(batch.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                            </div>

                            {/* Quantity Summary by Size */}
                            {(() => {
                              const show250 =
                                batch.total250ml.original > 0 ||
                                batch.total250ml.distributed > 0 ||
                                batch.total250ml.remaining > 0
                              return (
                                <div
                                  className={cn(
                                    "grid gap-3 mt-4",
                                    show250
                                      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                                  )}
                                >
                                  {show250 &&
                                    sizeCard("250ml", "250ml", batch.total250ml, {
                                      border: "border-sky-200 dark:border-sky-900/30",
                                      bg: "bg-sky-50 dark:bg-sky-950/20",
                                      text: "text-sky-800 dark:text-sky-200",
                                      accent: "text-sky-600 dark:text-sky-400",
                                      borderT: "border-sky-200 dark:border-sky-900/30",
                                    })}
                                  {sizeCard("500ml", "500ml", batch.total500ml, {
                                    border: "border-blue-200 dark:border-blue-900/30",
                                    bg: "bg-blue-50 dark:bg-blue-950/20",
                                    text: "text-blue-900 dark:text-blue-100",
                                    accent: "text-blue-600 dark:text-blue-400",
                                    borderT: "border-blue-200 dark:border-blue-900/30",
                                  })}
                                  {sizeCard("1L", "1L", batch.total1L, {
                                    border: "border-purple-200 dark:border-purple-900/30",
                                    bg: "bg-purple-50 dark:bg-purple-950/20",
                                    text: "text-purple-900 dark:text-purple-100",
                                    accent: "text-purple-600 dark:text-purple-400",
                                    borderT: "border-purple-200 dark:border-purple-900/30",
                                  })}
                                  {sizeCard("2L", "2L", batch.total2L, {
                                    border: "border-indigo-200 dark:border-indigo-900/30",
                                    bg: "bg-indigo-50 dark:bg-indigo-950/20",
                                    text: "text-indigo-900 dark:text-indigo-100",
                                    accent: "text-indigo-600 dark:text-indigo-400",
                                    borderT: "border-indigo-200 dark:border-indigo-900/30",
                                  })}
                                </div>
                              )
                            })()}

                            {/* By flavour: packaged stock remaining */}
                            {batch.byFlavour && batch.byFlavour.length > 0 && (
                              <div className="mt-4 rounded-lg border border-violet-200/80 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20 p-3 sm:p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-3">
                                  By flavour (bottles remaining)
                                </p>
                                <div className="space-y-2.5">
                                  {batch.byFlavour.map((f) => (
                                    <div
                                      key={f.key}
                                      className="rounded-md border border-violet-200/60 bg-white/90 dark:border-violet-900/50 dark:bg-slate-900/50 px-3 py-2.5"
                                    >
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 break-words">
                                          {f.label}
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className="w-fit shrink-0 border-teal-300 text-teal-800 dark:border-teal-700 dark:text-teal-200"
                                        >
                                          {f.totalBottles.remaining.toLocaleString()} left
                                        </Badge>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                                        {f.total250ml.remaining > 0 && (
                                          <span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">250ml:</span>{" "}
                                            {f.total250ml.remaining.toLocaleString()}
                                          </span>
                                        )}
                                        {f.total500ml.remaining > 0 && (
                                          <span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">500ml:</span>{" "}
                                            {f.total500ml.remaining.toLocaleString()}
                                          </span>
                                        )}
                                        {f.total1L.remaining > 0 && (
                                          <span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">1L:</span>{" "}
                                            {f.total1L.remaining.toLocaleString()}
                                          </span>
                                        )}
                                        {f.total2L.remaining > 0 && (
                                          <span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">2L:</span>{" "}
                                            {f.total2L.remaining.toLocaleString()}
                                          </span>
                                        )}
                                        {f.totalBottles.remaining === 0 && (
                                          <span className="text-amber-700 dark:text-amber-300">No bottles left for this flavour</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Total Summary */}
                            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Bottles</span>
                                </div>
                                <div className="flex flex-wrap items-end justify-between gap-4 sm:justify-end">
                                  <div className="text-right min-w-[4.5rem]">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Original</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{batch.totalBottles.original.toLocaleString()}</p>
                                  </div>
                                  <div className="text-right min-w-[4.5rem]">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Distributed</p>
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{batch.totalBottles.distributed.toLocaleString()}</p>
                                  </div>
                                  <div className="text-right min-w-[4.5rem]">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Remaining</p>
                                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{batch.totalBottles.remaining.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Package Numbers */}
                            {batch.packagingOutputs && batch.packagingOutputs.length > 0 && (
                              <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <Package className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span className="break-words min-w-0">
                                  <span className="font-medium">Packages:</span>{" "}
                                  {batch.packagingOutputs.map((po) => po.packageNumber).join(", ")}
                                </span>
                              </div>
                            )}

                            {/* View Details Button */}
                            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                              <Button
                                variant="ghost"
                                className="w-full hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedBatch(batch.batchNumber)
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                                View Batch Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Batch Details Modal */}
        <Dialog open={selectedBatch !== null} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="left-[50%] top-[50%] w-[calc(100vw-1rem)] max-w-[min(100vw-1rem,72rem)] max-h-[min(90dvh,900px)] translate-x-[-50%] translate-y-[-50%] overflow-y-auto overflow-x-hidden p-4 sm:p-6 sm:max-w-6xl gap-4">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-base sm:text-xl font-bold flex items-start gap-2">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30 shrink-0">
                  <Hash className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="break-words block">Batch Details — {selectedBatch}</span>
                  {selectedBatchSummary && (
                    <div className="text-xs sm:text-sm font-normal text-muted-foreground mt-1 break-words">
                      {selectedBatchSummary.flavor} • {selectedBatchSummary.productType}
                    </div>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-5 sm:space-y-6">
              {selectedBatchSummary && (
                <>
                  {/* Batch Summary Stats */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Original</p>
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {selectedBatchSummary.totalBottles.original.toLocaleString()}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Total bottles produced</p>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Distributed</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {selectedBatchSummary.totalBottles.distributed.toLocaleString()}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Bottles sold/distributed</p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Warehouse className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Remaining</p>
                        </div>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                          {selectedBatchSummary.totalBottles.remaining.toLocaleString()}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Bottles in stock</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Products Table — scroll horizontally on narrow screens */}
                  <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
                    <Table className="min-w-[640px] sm:min-w-0">
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              Flavour
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-3 sm:px-4">Size</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />
                              Original
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                              Distributed
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              Remaining
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />
                              Status
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modalInventoryRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12">
                              <div className="flex flex-col items-center gap-2">
                                <Package className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-muted-foreground font-medium">No products found for this batch</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          modalInventoryRows.map((product, idx) => (
                            <TableRow
                              key={`${product.flavour}-${product.size}-${idx}`}
                              className={cn(
                                "hover:bg-gradient-to-r hover:from-amber-50/70 hover:to-amber-50/30 dark:hover:from-amber-950/30 dark:hover:to-amber-950/10 transition-all border-b border-slate-200 dark:border-slate-800",
                                idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                              )}
                            >
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4 max-w-[200px]">
                                <div>
                                  <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 break-words">
                                    {product.flavour}
                                  </span>
                                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{selectedBatchSummary?.productType}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4">
                                <Badge className="font-semibold text-xs px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  {product.size}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4 tabular-nums">
                                <span className="font-bold text-sm sm:text-base text-green-700 dark:text-green-400">
                                  {product.originalQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4 tabular-nums">
                                <span className="font-semibold text-sm sm:text-base text-blue-700 dark:text-blue-400">
                                  {product.distributedQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4 tabular-nums">
                                <span className="font-bold text-base sm:text-lg text-amber-700 dark:text-amber-400">
                                  {product.remainingQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-3 sm:py-4 sm:px-4">
                                <div className="flex items-center gap-1">
                                  <Package className="h-3.5 w-3.5 text-green-500 dark:text-green-400 shrink-0" />
                                  <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Packaged
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
