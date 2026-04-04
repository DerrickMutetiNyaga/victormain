"use client"

import { use, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, FileText, Package, ClipboardCheck, Truck, Hash, Calendar, User, Clock, Thermometer, TrendingDown, CheckCircle2, XCircle, AlertCircle, Download, Factory, FlaskConical, BarChart3, MapPin, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function BatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [batch, setBatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [packagingOutputs, setPackagingOutputs] = useState<any[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch batch data
        const batchResponse = await fetch(`/api/jaba/batches/${id}`)
        if (!batchResponse.ok) {
          throw new Error('Failed to fetch batch')
        }
        const batchData = await batchResponse.json()
        setBatch(batchData.batch)

        // Fetch packaging outputs for this batch
        try {
          const packagingResponse = await fetch(`/api/jaba/packaging-output?batchId=${id}`)
          if (packagingResponse.ok) {
            const packagingData = await packagingResponse.json()
            setPackagingOutputs(packagingData.outputs || [])
          }
        } catch (e) {
          console.error('Error fetching packaging outputs:', e)
        }

        // Fetch delivery notes for this batch (filter by batchNumber in items)
        try {
          const deliveryResponse = await fetch('/api/jaba/delivery-notes')
          if (deliveryResponse.ok) {
            const deliveryData = await deliveryResponse.json()
            const relatedDeliveries = deliveryData.deliveryNotes?.filter((dn: any) => 
              dn.items?.some((item: any) => item.batchNumber === batchData.batch?.batchNumber)
            ) || []
            setDeliveryNotes(relatedDeliveries)
          }
        } catch (e) {
          console.error('Error fetching delivery notes:', e)
        }
      } catch (err: any) {
        console.error('Error fetching batch:', err)
        setError(err.message || 'Failed to load batch')
        toast.error('Failed to load batch details')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchBatchData()
    }
  }, [id])

  if (loading) {
    return (
      <>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center gap-4">
            <Link href="/jaba/batches">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Loading Batch...</h1>
            </div>
          </div>
        </header>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Loading batch details...</p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (error || !batch) {
    return (
      <>
        <div className="p-6">
          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/40 border-2 border-red-200 dark:border-red-900/30">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-lg font-semibold text-red-900 dark:text-red-100">
                  {error || "Batch not found"}
                </p>
                <Link href="/jaba/batches">
                  <button className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-lg shadow-red-500/30 transition-all">
                    Back to Batches
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900/30"
      case "Ready for Distribution":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
      case "QC Pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
      case "Processing":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-900/30"
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
    }
  }

  const getQCStatusColor = (status: string) => {
    switch (status) {
      case "Pass":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900/30"
      case "Fail":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-900/30"
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
    }
  }

  // Helper function to parse date strings
  const parseDate = (date: any): Date => {
    if (date instanceof Date) return date
    if (typeof date === 'string') return new Date(date)
    return new Date()
  }

  const totalMaterialCost = batch.ingredients?.reduce((sum: number, ing: any) => sum + (ing.totalCost || 0), 0) || 0
  const batchDate = parseDate(batch.date)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-4">
          <Link href="/jaba/batches">
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <Hash className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{batch.batchNumber}</h1>
              <p className="text-sm text-muted-foreground font-medium">
                {batch.displayFlavorLabel || batch.flavor} • {batch.productCategory}
                {batch.batchType === "flavoured" && (
                  <span className="ml-2 text-xs rounded-md border border-violet-300 px-1.5 py-0.5 text-violet-800 dark:text-violet-200">
                    Flavoured output
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <Badge className={cn("font-semibold text-sm px-3 py-1.5 border-2", getStatusColor(batch.status))}>
          {batch.status}
        </Badge>
      </header>

      <div className="p-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {(batch.flavourOutputs?.length > 0 ||
          batch.parentBatch ||
          batch.batchType === "neutral" ||
          batch.legacyFlavourFirstBatch) && (
          <Card className="mb-6 border-violet-200/80 dark:border-violet-900/40 bg-white/90 dark:bg-slate-900/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FlaskConical className="h-5 w-5 text-violet-600" />
                Infusion & traceability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.parentBatch && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Neutral parent batch</p>
                  <Link
                    href={`/jaba/batches/${batch.parentBatch.id}`}
                    className="text-base font-semibold text-violet-700 dark:text-violet-300 hover:underline"
                  >
                    {batch.parentBatch.batchNumber}
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1">
                    {batch.parentBatch.flavor} · Produced {batch.parentBatch.totalLitres}L · Remaining neutral{" "}
                    {(batch.parentBatch.neutralRemainingLitres ?? batch.parentBatch.outputSummary?.remainingLitres ?? 0).toFixed(2)}L
                  </p>
                </div>
              )}
              {!batch.parentBatch && batch.batchType === "neutral" && (
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Neutral produced</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{batch.totalLitres}L</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Allocated to flavours</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {(batch.infusedAllocatedLitres ?? 0).toFixed(2)}L
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Remaining neutral</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {(batch.neutralRemainingLitres ?? batch.outputSummary?.remainingLitres ?? 0).toFixed(2)}L
                    </p>
                  </div>
                </div>
              )}
              {batch.legacyFlavourFirstBatch && (
                <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
                  Legacy batch: flavour was assigned at creation. New production should use neutral base batches, then Infuse on the batch list.
                </p>
              )}
              {batch.flavourOutputs?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Flavoured outputs</p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Output</TableHead>
                          <TableHead className="text-xs">Flavour</TableHead>
                          <TableHead className="text-xs">Volume</TableHead>
                          <TableHead className="text-xs">Infusion date</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batch.flavourOutputs.map((row: any) => (
                          <TableRow key={row._id || row.id}>
                            <TableCell className="font-mono text-sm">
                              <Link href={`/jaba/batches/${row._id || row.id}`} className="text-violet-700 dark:text-violet-300 hover:underline">
                                {row.batchNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm">{row.flavor}</TableCell>
                            <TableCell className="text-sm">
                              {(row.infusedQuantityLitres ?? row.totalLitres).toFixed(2)}L
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.infusionDate
                                ? parseDate(row.infusionDate).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Bottles</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{batch.outputSummary.totalBottles.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mt-2">
                    <Package className="h-3 w-3" />
                    <span>Produced</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Total Litres</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{batch.totalLitres}L</p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mt-2">
                    <FlaskConical className="h-3 w-3" />
                    <span>Volume</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <FlaskConical className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Material Cost</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">${totalMaterialCost.toFixed(0)}</p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mt-2">
                    <BarChart3 className="h-3 w-3" />
                    <span>Total</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "shadow-lg hover:shadow-xl transition-shadow",
            batch.qcStatus === "Pass"
              ? "border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20"
              : batch.qcStatus === "Fail"
              ? "border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-900/20"
              : "border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20"
          )}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    batch.qcStatus === "Pass" ? "text-green-700 dark:text-green-300" :
                    batch.qcStatus === "Fail" ? "text-red-700 dark:text-red-300" :
                    "text-amber-700 dark:text-amber-300"
                  )}>QC Status</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    batch.qcStatus === "Pass" ? "text-green-900 dark:text-green-100" :
                    batch.qcStatus === "Fail" ? "text-red-900 dark:text-red-100" :
                    "text-amber-900 dark:text-amber-100"
                  )}>{batch.qcStatus}</p>
                  <div className={cn(
                    "flex items-center gap-2 text-xs mt-2",
                    batch.qcStatus === "Pass" ? "text-green-600 dark:text-green-400" :
                    batch.qcStatus === "Fail" ? "text-red-600 dark:text-red-400" :
                    "text-amber-600 dark:text-amber-400"
                  )}>
                    <ClipboardCheck className="h-3 w-3" />
                    <span>Quality Check</span>
                  </div>
                </div>
                <div className={cn(
                  "rounded-xl p-3 border",
                  batch.qcStatus === "Pass" ? "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800/50" :
                  batch.qcStatus === "Fail" ? "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800/50" :
                  "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800/50"
                )}>
                  <ClipboardCheck className={cn(
                    "h-6 w-6",
                    batch.qcStatus === "Pass" ? "text-green-600 dark:text-green-400" :
                    batch.qcStatus === "Fail" ? "text-red-600 dark:text-red-400" :
                    "text-amber-600 dark:text-amber-400"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 p-1.5 h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="packaging" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <Package className="h-4 w-4 mr-2" />
              Packaging
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <Factory className="h-4 w-4 mr-2" />
              Materials
            </TabsTrigger>
            <TabsTrigger value="qc" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              QC Results
            </TabsTrigger>
            <TabsTrigger value="distribution" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <Truck className="h-4 w-4 mr-2" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 px-4 py-2">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50">
                  <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                      <Hash className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Batch Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Hash className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Batch Number:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{batch.batchNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Date:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{batchDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Product Category:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.productCategory}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Flavor:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.flavor}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                      Supervisor:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.supervisor}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      Shift:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.shift}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      QC Status:
                    </span>
                    <Badge className={cn("font-semibold text-xs px-2.5 py-1 border-2", getQCStatusColor(batch.qcStatus))}>
                      {batch.qcStatus}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-b border-purple-200 dark:border-purple-900/50">
                  <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                      <Factory className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    Production Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Expected vs Actual Production */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-2 border-purple-200 dark:border-purple-900/50 mb-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Expected Volume:
                        </span>
                        <div className="flex items-center gap-2">
                          {!batch.expectedLitres && batch.status === "Processed" && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 italic">(Not recorded - batch created before this feature)</span>
                          )}
                          <span className="font-bold text-lg text-blue-700 dark:text-blue-400">
                            {batch.expectedLitres ? `${batch.expectedLitres}L` : (batch.status === "Processing" ? `${batch.totalLitres}L` : "N/A")}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Actual Produced:
                        </span>
                        <span className="font-bold text-lg text-green-700 dark:text-green-400">
                          {batch.totalLitres}L
                        </span>
                      </div>
                      {(() => {
                        // For processed batches, if expectedLitres doesn't exist, we can't calculate variance
                        // But if it exists, show the comparison
                        const expected = batch.expectedLitres
                        const actual = batch.totalLitres || 0
                        
                        if (!expected && batch.status === "Processed") {
                          return (
                            <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                              <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                                Expected volume was not recorded for this batch. Variance cannot be calculated.
                              </p>
                            </div>
                          )
                        }
                        
                        if (expected) {
                          const difference = actual - expected
                          const hasVariance = Math.abs(difference) > 0.01
                          
                          if (hasVariance) {
                            return (
                              <>
                                <div className="flex justify-between items-center pt-2 border-t border-purple-200 dark:border-purple-800">
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Variance:
                                  </span>
                                  <span className={cn(
                                    "font-bold text-base",
                                    difference < 0 
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-blue-700 dark:text-blue-400"
                                  )}>
                                    {difference > 0 ? '+' : ''}{difference.toFixed(2)}L
                                    <span className="text-xs font-normal ml-1">
                                      ({((difference / expected) * 100).toFixed(1)}%)
                                    </span>
                                  </span>
                                </div>
                                {batch.productionVarianceReason && (
                                  <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reason for Variance:</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 p-2 rounded border border-purple-200 dark:border-purple-800">
                                      {batch.productionVarianceReason}
                                    </p>
                                  </div>
                                )}
                              </>
                            )
                          } else {
                            return (
                              <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                                <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                                  ✓ Production matches expected volume
                                </p>
                              </div>
                            )
                          }
                        }
                        return null
                      })()}
                    </div>
                  </div>
                  {batch.productionStartTime && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Start Time:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{parseDate(batch.productionStartTime).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {batch.productionEndTime && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        End Time:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{parseDate(batch.productionEndTime).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {batch.mixingDuration && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        Mixing Duration:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.mixingDuration} min</span>
                    </div>
                  )}
                  {batch.processingHours && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        Processing Hours:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.processingHours}h</span>
                    </div>
                  )}
                  {batch.temperature && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-red-600 dark:text-red-400" />
                        Temperature:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.temperature}°C</span>
                    </div>
                  )}
                  {batch.expectedLoss && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Expected Loss:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.expectedLoss.toFixed(2)}%</span>
                    </div>
                  )}
                  {batch.actualLoss && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        Actual Loss:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{batch.actualLoss.toFixed(2)}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                    <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex flex-col">
                    <span>Output Summary</span>
                    <span className="text-xs font-normal text-muted-foreground mt-0.5">
                      Packaging status and remaining inventory
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 border-2 border-green-200 dark:border-green-900/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                        <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Total Bottles:
                      </span>
                      <span className="font-bold text-2xl text-green-900 dark:text-green-100">{(batch.outputSummary?.totalBottles || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(batch.outputSummary?.breakdown || []).map((item: any, idx: number) => {
                      const colors = [
                        { icon: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
                        { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20" },
                        { icon: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
                      ]
                      const color = colors[idx % colors.length]
                      return (
                        <div key={item.size} className={cn("p-4 rounded-lg border border-slate-200 dark:border-slate-800", color.bg)}>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className={cn("h-4 w-4", color.icon)} />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.size}</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.quantity.toLocaleString()} pcs</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{item.litres}L</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Remaining Litres:
                      </span>
                      <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                        {(() => {
                          // Remaining litres should never exceed totalLitres (actual produced)
                          // If remainingLitres is greater than totalLitres, it's likely using old expected value
                          const actualProduced = batch.totalLitres || 0
                          const remaining = batch.outputSummary?.remainingLitres
                          
                          // If remaining is undefined or greater than actual produced, use actual produced
                          // Otherwise, use the remaining value (which decreases as packaging happens)
                          if (!remaining || remaining > actualProduced) {
                            return `${actualProduced}L`
                          }
                          return `${remaining}L`
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                      Volume available for packaging. Decreases as packaging sessions are completed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Packaging Output Tab */}
          <TabsContent value="packaging" className="space-y-6">
            <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                    <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  Packaging Output
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    // Calculate distributed quantities from delivery notes
                    let distributed500ml = 0
                    let distributed1L = 0
                    let distributed2L = 0
                    
                    deliveryNotes.forEach((note: any) => {
                      if (note.items && Array.isArray(note.items)) {
                        note.items.forEach((item: any) => {
                          if (item.batchNumber === batch.batchNumber) {
                            const qty = parseFloat(item.quantity) || 0
                            if (item.size === '500ml') {
                              distributed500ml += qty
                            } else if (item.size === '1L') {
                              distributed1L += qty
                            } else if (item.size === '2L') {
                              distributed2L += qty
                            }
                          }
                        })
                      }
                    })
                    
                    // Calculate remaining quantities
                    const initial500ml = batch.bottles500ml || 0
                    const initial1L = batch.bottles1L || 0
                    const initial2L = batch.bottles2L || 0
                    
                    const remaining500ml = Math.max(0, initial500ml - distributed500ml)
                    const remaining1L = Math.max(0, initial1L - distributed1L)
                    const remaining2L = Math.max(0, initial2L - distributed2L)
                    
                    return (
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase">500ml</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Initial:</span>
                                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{initial500ml.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-blue-200 dark:border-blue-800">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Remaining:</span>
                                <span className={cn(
                                  "text-lg font-bold",
                                  remaining500ml > 0 
                                    ? "text-green-700 dark:text-green-400" 
                                    : "text-slate-500 dark:text-slate-400"
                                )}>
                                  {remaining500ml.toLocaleString()}
                                </span>
                              </div>
                              {distributed500ml > 0 && (
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-xs text-slate-500 dark:text-slate-500">Distributed:</span>
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{distributed500ml.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 pt-2 border-t border-blue-200 dark:border-blue-800">bottles</p>
                          </CardContent>
                        </Card>
                        <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-900/20 shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase">1L</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Initial:</span>
                                <span className="text-lg font-bold text-purple-900 dark:text-purple-100">{initial1L.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-purple-200 dark:border-purple-800">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Remaining:</span>
                                <span className={cn(
                                  "text-lg font-bold",
                                  remaining1L > 0 
                                    ? "text-green-700 dark:text-green-400" 
                                    : "text-slate-500 dark:text-slate-400"
                                )}>
                                  {remaining1L.toLocaleString()}
                                </span>
                              </div>
                              {distributed1L > 0 && (
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-xs text-slate-500 dark:text-slate-500">Distributed:</span>
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{distributed1L.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-3 pt-2 border-t border-purple-200 dark:border-purple-800">bottles</p>
                          </CardContent>
                        </Card>
                        <Card className="border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/20 shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase">2L</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Initial:</span>
                                <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{initial2L.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-indigo-200 dark:border-indigo-800">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Remaining:</span>
                                <span className={cn(
                                  "text-lg font-bold",
                                  remaining2L > 0 
                                    ? "text-green-700 dark:text-green-400" 
                                    : "text-slate-500 dark:text-slate-400"
                                )}>
                                  {remaining2L.toLocaleString()}
                                </span>
                              </div>
                              {distributed2L > 0 && (
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-xs text-slate-500 dark:text-slate-500">Distributed:</span>
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{distributed2L.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-3 pt-2 border-t border-indigo-200 dark:border-indigo-800">bottles</p>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })()}
                  {batch.packagingTeam && batch.packagingTeam.length > 0 && (
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Packaging Team:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {batch.packagingTeam.map((member, idx) => (
                          <Badge key={idx} className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-medium px-3 py-1">
                            {member}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {batch.packagingTime && (
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Packaging Time:
                      </p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{parseDate(batch.packagingTime).toLocaleString()}</p>
                    </div>
                  )}
                  {packagingOutputs.length > 0 && (
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Packaging Sessions ({packagingOutputs.length}):
                      </p>
                      <div className="space-y-2">
                        {packagingOutputs.map((po: any) => (
                          <div key={po._id || po.id} className="text-sm text-blue-900 dark:text-blue-100">
                            {po.packageNumber || 'N/A'} - {po.packagedLitres || 0}L packaged
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
            <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/50 to-rose-50/30 dark:from-red-950/20 dark:to-rose-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border-b border-red-200 dark:border-red-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30">
                    <Factory className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Raw Materials Used
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">Material</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Quantity</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Unit Cost</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Total Cost</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Lot Number</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(batch.ingredients || []).map((ing: any, idx: number) => (
                        <TableRow
                          key={idx}
                          className={cn(
                            "hover:bg-gradient-to-r hover:from-red-50/70 hover:to-rose-50/30 dark:hover:from-red-950/30 dark:hover:to-rose-950/10 transition-all border-b border-slate-200 dark:border-slate-800",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                          )}
                        >
                          <TableCell className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">{ing.material}</TableCell>
                          <TableCell className="py-4 px-4 text-slate-700 dark:text-slate-300">{ing.quantity} {ing.unit || ''}</TableCell>
                          <TableCell className="py-4 px-4 text-slate-700 dark:text-slate-300">${(ing.unitCost || 0).toFixed(2)}</TableCell>
                          <TableCell className="py-4 px-4 font-semibold text-red-700 dark:text-red-400">${(ing.totalCost || 0).toFixed(2)}</TableCell>
                          <TableCell className="py-4 px-4 text-slate-600 dark:text-slate-400">{ing.lotNumber || "N/A"}</TableCell>
                          <TableCell className="py-4 px-4 text-slate-600 dark:text-slate-400">{ing.supplier || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 p-5 rounded-lg bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 border-2 border-red-200 dark:border-red-900/30">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-red-900 dark:text-red-100 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-red-600 dark:text-red-400" />
                      Total Material Cost:
                    </span>
                    <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                      ${totalMaterialCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QC Results Tab */}
          <TabsContent value="qc" className="space-y-6">
            {batch.qcChecklist && batch.qcChecklist.length > 0 ? (
              <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
                  <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                      <ClipboardCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    QC Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20">
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Status</p>
                        <Badge className={cn("font-semibold text-sm px-3 py-1.5 border-2", getQCStatusColor(batch.qcStatus || 'Pending'))}>
                          {batch.qcStatus || 'Pending'}
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20">
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Stage</p>
                        <p className="font-bold text-blue-900 dark:text-blue-100">{batch.qcStage || 'N/A'}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-900/20">
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">Date</p>
                        <p className="font-bold text-purple-900 dark:text-purple-100">{batchDate.toLocaleDateString()}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">Check Item</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Result</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batch.qcChecklist.map((item: any, idx: number) => (
                          <TableRow
                            key={idx}
                            className={cn(
                              "hover:bg-gradient-to-r hover:from-green-50/70 hover:to-emerald-50/30 dark:hover:from-green-950/30 dark:hover:to-emerald-950/10 transition-all border-b border-slate-200 dark:border-slate-800",
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                            )}
                          >
                            <TableCell className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">{item.item || item.check || 'N/A'}</TableCell>
                            <TableCell className="py-4 px-4">
                              {(() => {
                                // Determine result based on checked status and overall QC status
                                let result = 'Pending'
                                
                                // First check if result or status is explicitly set
                                if (item.result) {
                                  result = item.result
                                } else if (item.status) {
                                  result = item.status
                                } else if (item.checked !== undefined) {
                                  // If checked is true and overall QC status is Pass, show Pass
                                  if (item.checked && batch.qcStatus === 'Pass') {
                                    result = 'Pass'
                                  } else if (item.checked && batch.qcStatus === 'Fail') {
                                    result = 'Fail'
                                  } else if (!item.checked) {
                                    result = 'Pending'
                                  }
                                } else if (batch.qcStatus === 'Pass') {
                                  // If overall QC passed but no checked status, assume Pass
                                  result = 'Pass'
                                } else if (batch.qcStatus === 'Fail') {
                                  result = 'Fail'
                                }
                                
                                return (
                                  <Badge className={cn(
                                    "font-semibold text-xs px-2.5 py-1 border-2",
                                    result === "Pass" 
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900/30"
                                      : result === "Fail"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-900/30"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
                                  )}>
                                    {result}
                                  </Badge>
                                )
                              })()}
                            </TableCell>
                            <TableCell className="py-4 px-4 text-slate-600 dark:text-slate-400">{item.notes || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {batch.qcNotes && (
                    <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Additional Notes:
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{batch.qcNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-200 dark:border-amber-900/30">
                      <ClipboardCheck className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">No QC results available for this batch</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-6">
            {deliveryNotes.length > 0 ? (
              <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50">
                  <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                      <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Distribution Records ({deliveryNotes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">Note ID</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Distributor</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Date</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Items</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryNotes.map((note: any, idx: number) => (
                          <TableRow
                            key={note._id || note.id}
                            className={cn(
                              "hover:bg-gradient-to-r hover:from-blue-50/70 hover:to-indigo-50/30 dark:hover:from-blue-950/30 dark:hover:to-indigo-950/10 transition-all border-b border-slate-200 dark:border-slate-800",
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                            )}
                          >
                            <TableCell className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">{note.noteId || 'N/A'}</TableCell>
                            <TableCell className="py-4 px-4 font-medium text-slate-900 dark:text-slate-100">{note.distributorName || 'N/A'}</TableCell>
                            <TableCell className="py-4 px-4 text-slate-600 dark:text-slate-400">{parseDate(note.date || note.deliveryDate).toLocaleDateString()}</TableCell>
                            <TableCell className="py-4 px-4">
                              <div className="flex flex-col gap-1">
                                {(note.items || []).map((item: any, itemIdx: number) => (
                                  <Badge key={itemIdx} className="w-fit bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                                    {item.quantity}×{item.size || item.containerSize}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <Badge className={cn(
                                "font-semibold text-xs px-2.5 py-1 border-2",
                                note.status === "Delivered" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900/30" :
                                note.status === "In Transit" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/30" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
                              )}>
                                {note.status || 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-200 dark:border-amber-900/30">
                      <Truck className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">No distribution records for this batch</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-b border-purple-200 dark:border-purple-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Batch Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {batch.documents && batch.documents.length > 0 ? (
                  <div className="space-y-3">
                    {batch.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-2 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{doc}</span>
                        </div>
                        <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white font-semibold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900/40 border-2 border-slate-200 dark:border-slate-800">
                        <FileText className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">No documents available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
