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

interface BatchSummary {
  _id: string
  id: string
  batchNumber: string
  flavor: string
  productType: string
  date: string
  total500ml: { original: number; distributed: number; remaining: number }
  total1L: { original: number; distributed: number; remaining: number }
  total2L: { original: number; distributed: number; remaining: number }
  totalBottles: { original: number; distributed: number; remaining: number }
  status: "Available" | "Sold Out"
  packagingOutputs: Array<{
    _id: string
    packageNumber: string
    packagingDate: string
    packagingLine: string
  }>
}

interface ProductDetail {
  size: "500ml" | "1L" | "2L"
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

  const totalBatches = batches.length
  const totalBottles = batches.reduce((sum, b) => sum + b.totalBottles.remaining, 0)
  const soldOutBatches = batches.filter((b) => b.status === "Sold Out").length
  const availableBatches = batches.filter((b) => b.status === "Available").length

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Finished Goods Warehouse</h1>
            <p className="text-sm text-muted-foreground">Track batches and product inventory</p>
          </div>
        </div>
        <Link href="/jaba/distribution/create">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
            <Truck className="mr-2 h-4 w-4" />
            Create Delivery Note
          </Button>
        </Link>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                            <div className="grid grid-cols-3 gap-3 mt-4">
                              {/* 500ml */}
                              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Package className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">500ml</span>
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Original:</span>
                                    <span className="font-bold text-blue-900 dark:text-blue-100">{batch.total500ml.original.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Distributed:</span>
                                    <span className="font-semibold text-blue-700 dark:text-blue-400">{batch.total500ml.distributed.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-blue-200 dark:border-blue-900/30">
                                    <span className="font-semibold text-blue-800 dark:text-blue-300">Remaining:</span>
                                    <span className="font-bold text-lg text-blue-900 dark:text-blue-100">{batch.total500ml.remaining.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 1L */}
                              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Package className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">1L</span>
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Original:</span>
                                    <span className="font-bold text-purple-900 dark:text-purple-100">{batch.total1L.original.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Distributed:</span>
                                    <span className="font-semibold text-purple-700 dark:text-purple-400">{batch.total1L.distributed.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-purple-200 dark:border-purple-900/30">
                                    <span className="font-semibold text-purple-800 dark:text-purple-300">Remaining:</span>
                                    <span className="font-bold text-lg text-purple-900 dark:text-purple-100">{batch.total1L.remaining.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 2L */}
                              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Package className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">2L</span>
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Original:</span>
                                    <span className="font-bold text-indigo-900 dark:text-indigo-100">{batch.total2L.original.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">Distributed:</span>
                                    <span className="font-semibold text-indigo-700 dark:text-indigo-400">{batch.total2L.distributed.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-indigo-200 dark:border-indigo-900/30">
                                    <span className="font-semibold text-indigo-800 dark:text-indigo-300">Remaining:</span>
                                    <span className="font-bold text-lg text-indigo-900 dark:text-indigo-100">{batch.total2L.remaining.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Total Summary */}
                            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Bottles</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Original</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{batch.totalBottles.original.toLocaleString()}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Distributed</p>
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{batch.totalBottles.distributed.toLocaleString()}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 dark:text-slate-500">Remaining</p>
                                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{batch.totalBottles.remaining.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Package Numbers */}
                            {batch.packagingOutputs && batch.packagingOutputs.length > 0 && (
                              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                                <Package className="h-3.5 w-3.5" />
                                <span>Packages: {batch.packagingOutputs.map(po => po.packageNumber).join(", ")}</span>
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
          <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 flex-wrap">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                  <Hash className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <span className="break-words">Batch Details - {selectedBatch}</span>
                  {selectedBatchSummary && (
                    <div className="text-sm font-normal text-muted-foreground mt-1">
                      {selectedBatchSummary.flavor} • {selectedBatchSummary.productType}
                    </div>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-6">
              {selectedBatchSummary && (
                <>
                  {/* Batch Summary Stats */}
                  <div className="grid grid-cols-3 gap-3">
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

                  {/* Products Table */}
                  <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                              Product
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Size</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
                              Original
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              Distributed
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                              Remaining
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-green-500 dark:text-green-400" />
                              Status
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBatchProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12">
                              <div className="flex flex-col items-center gap-2">
                                <Package className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-muted-foreground font-medium">No products found for this batch</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedBatchProducts.map((product, idx) => (
                            <TableRow
                              key={product.size}
                              className={cn(
                                "hover:bg-gradient-to-r hover:from-amber-50/70 hover:to-amber-50/30 dark:hover:from-amber-950/30 dark:hover:to-amber-950/10 transition-all border-b border-slate-200 dark:border-slate-800",
                                idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                              )}
                            >
                              <TableCell className="py-4 px-4">
                                <div>
                                  <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                    {selectedBatchSummary?.flavor}
                                  </span>
                                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{selectedBatchSummary?.productType}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <Badge className="font-semibold text-xs px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  {product.size}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <span className="font-bold text-base text-green-700 dark:text-green-400">
                                  {product.originalQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <span className="font-semibold text-base text-blue-700 dark:text-blue-400">
                                  {product.distributedQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                                  {product.remainingQuantity.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <div className="flex items-center gap-1">
                                  <Package className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
