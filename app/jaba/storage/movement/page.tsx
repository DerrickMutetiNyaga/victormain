"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PackageSearch, Search, TrendingUp, TrendingDown, RefreshCw, Loader2, ArrowDownCircle, ArrowUpCircle, Minus, Calendar, User, Hash, Package, Filter, Download, Grid3x3, List, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface StockMovement {
  _id: string
  type: "IN" | "OUT" | "ADJUSTMENT" | "LOSS"
  productType: string
  batchId?: string
  batchNumber?: string
  packageNumber?: string
  quantity: number
  unit: string
  reason: string
  date: string
  user: string
  notes?: string
  source?: string
  distributorName?: string
}

export default function StockMovementPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  // Fetch movements from database
  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/jaba/stock-movements')
        if (!response.ok) {
          throw new Error('Failed to fetch movements')
        }
        const data = await response.json()
        setMovements(data.movements || [])
        console.log('[Stock Movement Page] Fetched movements:', data.movements?.length || 0)
      } catch (error: any) {
        console.error('[Stock Movement Page] Error fetching movements:', error)
        toast.error('Failed to load movements', {
          description: error.message || 'Please try again later',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMovements()
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "IN":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
      case "OUT":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
      case "ADJUSTMENT":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
      case "LOSS":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      default:
        return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <ArrowDownCircle className="h-4 w-4" />
      case "OUT":
        return <ArrowUpCircle className="h-4 w-4" />
      case "ADJUSTMENT":
        return <Minus className="h-4 w-4" />
      default:
        return <PackageSearch className="h-4 w-4" />
    }
  }

  // Filter movements
  const filteredMovements = movements.filter((movement) => {
    const matchesSearch = 
      movement.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.productType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.packageNumber?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = typeFilter === "all" || movement.type === typeFilter

    const matchesDate = (() => {
      if (dateFilter === "all") return true
      const movementDate = new Date(movement.date)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const thisWeek = new Date(today)
      thisWeek.setDate(thisWeek.getDate() - 7)
      const thisMonth = new Date(today)
      thisMonth.setMonth(thisMonth.getMonth() - 1)

      switch (dateFilter) {
        case "today":
          return movementDate >= today
        case "yesterday":
          return movementDate >= yesterday && movementDate < today
        case "week":
          return movementDate >= thisWeek
        case "month":
          return movementDate >= thisMonth
        default:
          return true
      }
    })()

    return matchesSearch && matchesType && matchesDate
  })

  // Calculate statistics
  const totalIn = filteredMovements
    .filter(m => m.type === "IN")
    .reduce((sum, m) => sum + m.quantity, 0)
  
  const totalOut = filteredMovements
    .filter(m => m.type === "OUT")
    .reduce((sum, m) => sum + m.quantity, 0)

  const totalAdjustments = filteredMovements
    .filter(m => m.type === "ADJUSTMENT")
    .reduce((sum, m) => sum + m.quantity, 0)

  const totalLoss = filteredMovements
    .filter(m => m.type === "LOSS")
    .reduce((sum, m) => sum + m.quantity, 0)

  const netMovement = totalIn - totalOut

  const refreshData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/jaba/stock-movements')
      if (!response.ok) {
        throw new Error('Failed to fetch movements')
      }
      const data = await response.json()
      setMovements(data.movements || [])
      toast.success('Data refreshed successfully')
    } catch (error: any) {
      toast.error('Failed to refresh data', {
        description: error.message || 'Please try again later',
      })
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setTypeFilter("all")
    setDateFilter("all")
  }

  const hasActiveFilters = searchQuery || typeFilter !== "all" || dateFilter !== "all"

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg">
            <PackageSearch className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Stock Movement</h1>
            <p className="text-sm text-muted-foreground">Track all inventory movements and transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
          onClick={refreshData}
          disabled={loading}
            className="gap-2"
        >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50/50 via-background to-slate-50/50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 shadow-md hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total In</p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{totalIn.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Items received</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <ArrowDownCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                  </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/50 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/10 shadow-md hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-400">Total Out</p>
                  <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{totalOut.toLocaleString()}</p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400/80">Items distributed</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/40">
                  <ArrowUpCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 shadow-md hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Adjustments</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalAdjustments.toLocaleString()}</p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">Stock corrections</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                  <Minus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-2 shadow-md hover:shadow-lg transition-all duration-200",
            netMovement >= 0
              ? "border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10"
              : "border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10"
          )}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={cn(
                    "text-sm font-medium",
                    netMovement >= 0
                      ? "text-indigo-700 dark:text-indigo-400"
                      : "text-amber-700 dark:text-amber-400"
                  )}>Net Movement</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    netMovement >= 0
                      ? "text-indigo-900 dark:text-indigo-100"
                      : "text-amber-900 dark:text-amber-100"
                  )}>{netMovement >= 0 ? '+' : ''}{netMovement.toLocaleString()}</p>
                  <p className={cn(
                    "text-xs",
                    netMovement >= 0
                      ? "text-indigo-600/80 dark:text-indigo-400/80"
                      : "text-amber-600/80 dark:text-amber-400/80"
                  )}>Net change</p>
                </div>
                <div className={cn(
                  "p-3 rounded-xl",
                  netMovement >= 0
                    ? "bg-indigo-100 dark:bg-indigo-900/40"
                    : "bg-amber-100 dark:bg-amber-900/40"
                )}>
                  <TrendingUp className={cn(
                    "h-6 w-6",
                    netMovement >= 0
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-amber-600 dark:text-amber-400"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search batches, products, users, packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px] h-10">
                  <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="IN">Incoming (IN)</SelectItem>
                  <SelectItem value="OUT">Outgoing (OUT)</SelectItem>
                    <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    <SelectItem value="LOSS">Loss</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[160px] h-10">
                  <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="Date" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-10 gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
                <div className="flex gap-1 border rounded-lg p-1 bg-slate-50 dark:bg-slate-900">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 px-3"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Movements Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Movement History
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredMovements.length} {filteredMovements.length === 1 ? 'record' : 'records'})
              </span>
            </h2>
          </div>

            {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Loading movements...</p>
              </div>
              </CardContent>
            </Card>
            ) : filteredMovements.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <PackageSearch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {hasActiveFilters
                      ? "No movements match your filters"
                      : "No movements found"}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-3"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMovements.map((movement, index) => {
                const isIn = movement.type === "IN"
                const movementDate = new Date(movement.date)
                const isToday = movementDate.toDateString() === new Date().toDateString()
                
                return (
                  <Card
                    key={`${movement._id}-${index}-${movement.date}-${movement.quantity}`}
                        className={cn(
                      "border-2 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden",
                      isIn
                        ? "border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/30 to-white dark:from-emerald-950/10 dark:to-slate-900"
                        : "border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/30 to-white dark:from-rose-950/10 dark:to-slate-900"
                        )}
                      >
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn("font-semibold text-xs px-3 py-1 border", getTypeColor(movement.type))}>
                              <span className="flex items-center gap-1.5">
                            {getTypeIcon(movement.type)}
                            {movement.type}
                              </span>
                          </Badge>
                            {isToday && (
                              <Badge variant="outline" className="text-xs">
                                Today
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                                {movementDate.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {movementDate.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            </p>
                            </div>
                          </div>

                        {/* Quantity */}
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-3xl font-bold",
                              isIn
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                            )}>
                              {isIn ? "+" : "−"}{movement.quantity.toLocaleString()}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground uppercase">
                                {movement.unit}
                              </span>
                          </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Product</p>
                            <p className="text-sm font-semibold">{movement.productType || "N/A"}</p>
                            </div>
                            {movement.batchNumber && (
                              <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  Batch
                                </p>
                              <p className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  {movement.batchNumber}
                              </p>
                              </div>
                            )}
                            {movement.packageNumber && (
                              <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  Package
                                </p>
                              <p className="text-sm font-mono font-semibold text-purple-600 dark:text-purple-400">
                                  {movement.packageNumber}
                                </p>
                              </div>
                            )}
                            <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                User
                              </p>
                            <p className="text-sm font-medium">{movement.user}</p>
                          </div>
                          </div>

                        {/* Reason */}
                        <div className="pt-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
                          <p className="text-sm">{movement.reason}</p>
                        </div>

                        {/* Additional Info */}
                          {(movement.notes || movement.distributorName) && (
                          <div className="pt-2 border-t space-y-2">
                              {movement.notes && (
                              <p className="text-xs text-muted-foreground">{movement.notes}</p>
                              )}
                              {movement.distributorName && (
                              <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                  <ArrowUpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                  To: {movement.distributorName}
                            </span>
                          </div>
                              )}
              </div>
            )}
                      </div>
          </CardContent>
        </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map((movement, index) => {
                        const isIn = movement.type === "IN"
                        const movementDate = new Date(movement.date)
                        
                        return (
                          <TableRow key={`${movement._id}-${index}-${movement.date}-${movement.quantity}`}>
                            <TableCell>
                              <Badge className={cn("font-semibold text-xs px-2 py-1 border", getTypeColor(movement.type))}>
                                <span className="flex items-center gap-1">
                                  {getTypeIcon(movement.type)}
                                  {movement.type}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">
                                  {movementDate.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {movementDate.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{movement.productType || "N/A"}</TableCell>
                            <TableCell>
                              {movement.batchNumber ? (
                                <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                                  {movement.batchNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {movement.packageNumber ? (
                                <span className="font-mono text-sm text-purple-600 dark:text-purple-400">
                                  {movement.packageNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "font-bold",
                                isIn
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              )}>
                                {isIn ? "+" : "−"}{movement.quantity.toLocaleString()} {movement.unit}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm truncate" title={movement.reason}>
                                {movement.reason}
                              </p>
                            </TableCell>
                            <TableCell className="font-medium">{movement.user}</TableCell>
                            <TableCell className="max-w-[200px]">
                              {movement.notes ? (
                                <p className="text-xs text-muted-foreground truncate" title={movement.notes}>
                                  {movement.notes}
                                </p>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                              {movement.distributorName && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  To: {movement.distributorName}
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
