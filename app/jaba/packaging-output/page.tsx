"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Plus, Search, Boxes, FileText, Users, Calendar, TrendingUp, AlertCircle, CheckCircle2, Clock, Grid3x3, Table as TableIcon, Package, Factory, Activity, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PackagingOutput {
  _id: string
  id: string
  batchId: string
  batchNumber: string
  packageNumber: string
  volumeAllocated: number
  packagedLitres: number
  packagingDate: string | Date
  packagingLine: string
  supervisor: string
  teamMembers: string[]
  containers: Array<{
    size: string
    quantity: string | number
    customSize?: string
  }>
  defects: number
  defectReasons: string
  machineEfficiency?: number
  safetyChecks: boolean
  createdAt: string | Date
}

interface PackagingSession {
  id: string
  sessionId: string
  batchNumber: string
  date: Date
  totalLitresUsed: number
  output250ml: number
  output500ml: number
  output1L: number
  output2L: number
  otherSizes?: Array<{ size: string; quantity: number }>
  teamMembers: string[]
  defects: number
  efficiency: number
  machineEfficiency: number
  status: string
  supervisor: string
  packagingLine: string
  defectReasons?: string
}

export default function PackagingSessionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [packagingOutputs, setPackagingOutputs] = useState<PackagingOutput[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch packaging outputs from database
  useEffect(() => {
    console.log('[Packaging Output Page] Component mounted, fetching data...')
    fetchPackagingOutputs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchPackagingOutputs = async () => {
    try {
      console.log('[Packaging Output Page] Starting fetch...')
      setLoading(true)
      
      const response = await fetch('/api/jaba/packaging-output', {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('[Packaging Output Page] Fetch response status:', response.status, response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Packaging Output Page] Response not OK:', errorText)
        toast.error(`Failed to load: ${response.status} ${response.statusText}`)
        setLoading(false)
        return
      }
      
      const data = await response.json()
      console.log('[Packaging Output Page] ✅ API Response received')
      console.log('[Packaging Output Page] Data keys:', Object.keys(data))
      console.log('[Packaging Output Page] Packaging outputs count:', data.packagingOutputs?.length || 0)
      
      if (data.packagingOutputs && Array.isArray(data.packagingOutputs)) {
        console.log('[Packaging Output Page] ✅ Setting packaging outputs:', data.packagingOutputs.length)
        // Log first few items for debugging
        if (data.packagingOutputs.length > 0) {
          console.log('[Packaging Output Page] First packaging output:', {
            _id: data.packagingOutputs[0]._id,
            batchNumber: data.packagingOutputs[0].batchNumber,
            packageNumber: data.packagingOutputs[0].packageNumber,
            containers: data.packagingOutputs[0].containers?.length || 0,
            packagedLitres: data.packagingOutputs[0].packagedLitres,
          })
        } else {
          console.log('[Packaging Output Page] ⚠️ No packaging outputs in database')
        }
        setPackagingOutputs(data.packagingOutputs)
      } else {
        console.error('[Packaging Output Page] ❌ Invalid data format:', data)
        toast.error('Invalid data format received from server')
        setPackagingOutputs([])
      }
    } catch (error: any) {
      console.error('[Packaging Output Page] ❌ Error fetching packaging outputs:', error)
      console.error('[Packaging Output Page] Error details:', error.message, error.stack)
      toast.error(`Error: ${error.message || 'Failed to load packaging sessions'}`)
      setPackagingOutputs([])
    } finally {
      setLoading(false)
      console.log('[Packaging Output Page] Fetch completed, loading set to false')
    }
  }

  // Transform API data to match the expected format
  const packagingSessions: PackagingSession[] = useMemo(() => {
    console.log('[Packaging Output Page] Transforming packaging outputs:', packagingOutputs.length)
    
    // Sort by createdAt (most recent first) to ensure latest appear first
    const sortedOutputs = [...packagingOutputs].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA // Descending order (newest first)
    })
    
    return sortedOutputs.map((output) => {
      // Calculate output by size from containers
      let output250ml = 0
      let output500ml = 0
      let output1L = 0
      let output2L = 0
      const otherSizes: Array<{ size: string; quantity: number }> = []

      // Check if containers exist and is an array
      if (output.containers && Array.isArray(output.containers)) {
        output.containers.forEach((container) => {
          const quantity = typeof container.quantity === 'string' ? parseFloat(container.quantity) || 0 : container.quantity || 0
          if (container.size === "250ml") {
            output250ml += quantity
          } else if (container.size === "500ml") {
            output500ml += quantity
          } else if (container.size === "1L") {
            output1L += quantity
          } else if (container.size === "2L") {
            output2L += quantity
          } else if (container.customSize) {
            otherSizes.push({ size: container.customSize, quantity })
          }
        })
      } else {
        console.warn('[Packaging Output Page] No containers array found for output:', output._id || output.id)
      }

      // Calculate efficiency: (packagedLitres / volumeAllocated * 100)
      // This shows what percentage of the allocated volume was actually packaged
      // If machineEfficiency is provided, use that; otherwise calculate from packaged/allocated ratio
      let efficiency = 0
      if (output.machineEfficiency && output.machineEfficiency > 0) {
        // Use machine efficiency if provided (user-entered value)
        efficiency = output.machineEfficiency
      } else if (output.volumeAllocated > 0) {
        // Calculate from packaged vs allocated volume
        efficiency = Math.round((output.packagedLitres / output.volumeAllocated) * 100 * 10) / 10
      }
      
      console.log('[Packaging Output Page] Efficiency calculation:', {
        packagedLitres: output.packagedLitres,
        volumeAllocated: output.volumeAllocated,
        machineEfficiency: output.machineEfficiency,
        calculatedEfficiency: efficiency
      })

      // Determine status based on data
      let status = "Completed" // Default to completed since it's saved
      if (output.defects > 0) {
        status = "In Progress"
      }

      const packagingDate = output.packagingDate instanceof Date 
        ? output.packagingDate 
        : new Date(output.packagingDate)

      const session = {
        id: output._id || output.id,
        sessionId: output.packageNumber || `PKG-${output.batchNumber}`,
        batchNumber: output.batchNumber,
        date: packagingDate,
        totalLitresUsed: output.packagedLitres || 0,
        output250ml,
        output500ml,
        output1L,
        output2L,
        otherSizes: otherSizes.length > 0 ? otherSizes : undefined,
        teamMembers: output.teamMembers || [],
        defects: output.defects || 0,
        efficiency,
        machineEfficiency: output.machineEfficiency || efficiency,
        status,
        supervisor: output.supervisor || "N/A",
        packagingLine: output.packagingLine || "N/A",
        defectReasons: output.defectReasons || undefined,
      }
      
      console.log('[Packaging Output Page] Transformed session:', session.sessionId, 'from output:', output._id || output.id)
      return session
    })
  }, [packagingOutputs])
  
  // Log transformed sessions
  useEffect(() => {
    console.log('[Packaging Output Page] Total transformed sessions:', packagingSessions.length)
    if (packagingSessions.length > 0) {
      console.log('[Packaging Output Page] First session:', packagingSessions[0])
    }
  }, [packagingSessions])

  const filteredSessions = useMemo(() => {
    return packagingSessions.filter((session) => {
    const matchesSearch = session.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.batchNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || session.status === statusFilter
    return matchesSearch && matchesStatus
  })
  }, [packagingSessions, searchQuery, statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "In Progress":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "Pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Packaging Sessions</h1>
          <p className="text-sm text-muted-foreground">Manage packaging sessions after production</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={fetchPackagingOutputs}
            disabled={loading}
            className="border-slate-300 dark:border-slate-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        <Link href="/jaba/packaging-output/add">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
            <Plus className="mr-2 h-4 w-4" />
            Create Packaging Session
          </Button>
        </Link>
        </div>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950">
        {/* Debug Info - Remove after fixing */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <p className="text-xs font-mono">
                Debug: Loading={loading.toString()}, Outputs={packagingOutputs.length}, Sessions={packagingSessions.length}
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Loading State */}
        {loading ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                <p className="text-muted-foreground font-medium">Loading packaging sessions...</p>
              </div>
            </CardContent>
          </Card>
        ) : packagingSessions.length === 0 && packagingOutputs.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center gap-3">
                <Boxes className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-muted-foreground font-medium">No packaging sessions found</p>
                <p className="text-sm text-muted-foreground">Create a packaging session from the batches page</p>
                <Link href="/jaba/batches">
                  <Button variant="outline" className="mt-2">
                    Go to Batches
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : packagingSessions.length === 0 && packagingOutputs.length > 0 ? (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <p className="text-muted-foreground font-medium">Data transformation issue</p>
                <p className="text-sm text-muted-foreground">
                  Found {packagingOutputs.length} packaging output(s) but couldn't transform them. Check console for details.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Total Sessions</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">{packagingSessions.length}</p>
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <Boxes className="h-3 w-3" />
                    <span>Packaging records</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50">
                  <Boxes className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">
                    {packagingSessions.filter((s) => s.status === "Completed").length}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <Boxes className="h-3 w-3" />
                    <span>Sessions</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <Boxes className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Total Defects</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                    {packagingSessions.reduce((sum, s) => sum + s.defects, 0)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Boxes className="h-3 w-3" />
                    <span>Rejected bottles</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Boxes className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Avg Efficiency</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                    {packagingSessions.length > 0
                      ? Math.round((packagingSessions.reduce((sum, s) => sum + s.efficiency, 0) / packagingSessions.length) * 10) / 10
                      : 0}%
                  </p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Boxes className="h-3 w-3" />
                    <span>Packaging rate</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <Boxes className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by session ID or batch number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary border-0"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-secondary border-0">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Packaging Sessions Grid/Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/10 border border-red-200 dark:border-red-800/50">
                <Boxes className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              Packaging Sessions ({filteredSessions.length})
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="h-9"
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-9"
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Table
              </Button>
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                    <Boxes className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-medium text-lg">No packaging sessions found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
                </div>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSessions.map((session) => {
                const totalOutput = session.output250ml + session.output500ml + session.output1L + session.output2L + (session.otherSizes?.reduce((sum, s) => sum + s.quantity, 0) || 0)
                const StatusIcon = session.status === "Completed" ? CheckCircle2 : session.status === "In Progress" ? Clock : AlertCircle

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      "border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
                      session.status === "Completed" && "border-green-200 dark:border-green-800/50",
                      session.status === "In Progress" && "border-blue-200 dark:border-blue-800/50",
                      session.status === "Pending" && "border-amber-200 dark:border-amber-800/50"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base font-bold text-foreground mb-1">
                            {session.sessionId}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-medium">{session.batchNumber}</p>
                        </div>
                        <Badge className={cn("font-medium text-xs", getStatusColor(session.status))}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {session.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {session.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      {/* Litres Used */}
                      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Litres Used</span>
                          <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{session.totalLitresUsed}L</span>
                        </div>
                      </div>

                      {/* Output Breakdown */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Output</p>
                        <div className="grid grid-cols-4 gap-2">
                          {session.output250ml > 0 && (
                            <div className="p-3 rounded-lg bg-gradient-to-br from-fuchsia-100 to-fuchsia-200 dark:from-fuchsia-900/40 dark:to-fuchsia-800/30 border-2 border-fuchsia-300 dark:border-fuchsia-700 text-center shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-base font-bold text-fuchsia-900 dark:text-fuchsia-100">{session.output250ml}</p>
                              <p className="text-[10px] font-semibold text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-wide">250ml</p>
                            </div>
                          )}
                          {session.output500ml > 0 && (
                            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/30 border-2 border-purple-300 dark:border-purple-700 text-center shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-base font-bold text-purple-900 dark:text-purple-100">{session.output500ml}</p>
                              <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">500ml</p>
                            </div>
                          )}
                          {session.output1L > 0 && (
                            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30 border-2 border-emerald-300 dark:border-emerald-700 text-center shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{session.output1L}</p>
                              <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">1L</p>
                            </div>
                          )}
                          {session.output2L > 0 && (
                            <div className="p-3 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 border-2 border-amber-300 dark:border-amber-700 text-center shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-base font-bold text-amber-900 dark:text-amber-100">{session.output2L}</p>
                              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">2L</p>
                            </div>
                          )}
                        </div>
                        {session.otherSizes && session.otherSizes.length > 0 && (
                          <p className="text-xs text-muted-foreground">+{session.otherSizes.length} other sizes</p>
                        )}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <p className="text-xs text-muted-foreground">
                            Total: <span className="font-bold text-foreground">{totalOutput} bottles</span>
                          </p>
                        </div>
                      </div>

                      {/* Team Members */}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            {session.teamMembers.slice(0, 2).join(", ")}
                            {session.teamMembers.length > 2 && ` +${session.teamMembers.length - 2} more`}
                          </p>
                        </div>
                      </div>

                      {/* Metrics Row */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-center p-2 rounded-md bg-slate-50 dark:bg-slate-900/50">
                          <p className="text-xs text-muted-foreground mb-1">Defects</p>
                          <Badge className={cn(
                            "text-xs font-bold",
                            session.defects > 0 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          )}>
                            {session.defects}
                          </Badge>
                        </div>
                        <div className="text-center p-2 rounded-md bg-slate-50 dark:bg-slate-900/50">
                          <p className="text-xs text-muted-foreground mb-1">Efficiency</p>
                          <Badge className={cn(
                            "text-xs font-bold",
                            session.efficiency >= 95 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            session.efficiency >= 90 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {session.efficiency}%
                          </Badge>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Line:</span>
                          <span className="font-medium text-foreground">{session.packagingLine}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Supervisor:</span>
                          <span className="font-medium text-foreground truncate ml-2">{session.supervisor}</span>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-red-50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10 px-6 py-4">
                <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                    <TableIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Packaging Sessions Table View
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border-b-2 border-slate-300 dark:border-slate-700">
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Session ID
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Boxes className="h-3.5 w-3.5" />
                            Batch Number
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            Date
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4">
                          Litres Used
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4 min-w-[280px]">
                          Output
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            Team
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4 text-center">
                          Defects
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Efficiency
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 px-6 py-4 text-center">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session, idx) => {
                        const totalOutput = session.output250ml + session.output500ml + session.output1L + session.output2L + (session.otherSizes?.reduce((sum, s) => sum + s.quantity, 0) || 0)
                        const StatusIcon = session.status === "Completed" ? CheckCircle2 : session.status === "In Progress" ? Clock : AlertCircle
                        return (
                          <TableRow
                            key={session.id}
                            className={cn(
                              "group transition-all duration-200 border-b border-slate-200 dark:border-slate-800",
                              "hover:bg-gradient-to-r hover:from-red-50/80 hover:via-red-50/40 hover:to-transparent dark:hover:from-red-950/30 dark:hover:via-red-950/15 dark:hover:to-transparent",
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/30 dark:bg-slate-900/30"
                            )}
                          >
                            <TableCell className="px-6 py-4">
                              <div className="font-semibold text-sm text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                {session.sessionId}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {session.batchNumber}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{session.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                                <span className="text-base font-bold text-blue-900 dark:text-blue-100">{session.totalLitresUsed}</span>
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">L</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {session.output250ml > 0 && (
                                    <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-fuchsia-100 to-fuchsia-200 dark:from-fuchsia-900/40 dark:to-fuchsia-800/30 border-2 border-fuchsia-300 dark:border-fuchsia-700 shadow-md hover:shadow-lg transition-shadow">
                                      <p className="text-base font-bold text-fuchsia-900 dark:text-fuchsia-100 leading-tight">{session.output250ml}</p>
                                      <p className="text-[10px] font-semibold text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-wide mt-0.5">250ml</p>
                                    </div>
                                  )}
                                  {session.output500ml > 0 && (
                                    <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/30 border-2 border-purple-300 dark:border-purple-700 shadow-md hover:shadow-lg transition-shadow">
                                      <p className="text-base font-bold text-purple-900 dark:text-purple-100 leading-tight">{session.output500ml}</p>
                                      <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide mt-0.5">500ml</p>
                                    </div>
                                  )}
                                  {session.output1L > 0 && (
                                    <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30 border-2 border-emerald-300 dark:border-emerald-700 shadow-md hover:shadow-lg transition-shadow">
                                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-100 leading-tight">{session.output1L}</p>
                                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mt-0.5">1L</p>
                                    </div>
                                  )}
                                  {session.output2L > 0 && (
                                    <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 border-2 border-amber-300 dark:border-amber-700 shadow-md hover:shadow-lg transition-shadow">
                                      <p className="text-base font-bold text-amber-900 dark:text-amber-100 leading-tight">{session.output2L}</p>
                                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mt-0.5">2L</p>
                                    </div>
                                  )}
                                  {session.otherSizes && session.otherSizes.length > 0 && (
                                    <span className="text-xs text-muted-foreground font-medium">+{session.otherSizes.length} more</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                  <span className="text-xs font-medium text-muted-foreground">Total:</span>
                                  <span className="text-sm font-bold text-foreground">{totalOutput.toLocaleString()} bottles</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                {session.teamMembers.slice(0, 2).map((member, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                                    <span className="text-slate-700 dark:text-slate-300">{member}</span>
                                  </div>
                                ))}
                                {session.teamMembers.length > 2 && (
                                  <span className="text-xs text-muted-foreground font-medium ml-3.5">+{session.teamMembers.length - 2} more</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Badge className={cn(
                                "font-semibold text-xs px-2.5 py-1",
                                session.defects > 0 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                              )}>
                                {session.defects}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Badge className={cn(
                                "font-semibold text-xs px-2.5 py-1 border",
                                session.efficiency >= 95 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800" :
                                session.efficiency >= 90 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                              )}>
                                <TrendingUp className="h-3 w-3 mr-1 inline" />
                                {session.efficiency}%
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Badge className={cn("font-semibold text-xs px-2.5 py-1 border", getStatusColor(session.status))}>
                                <StatusIcon className="h-3 w-3 mr-1 inline" />
                                {session.status}
                              </Badge>
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
          </>
        )}
      </div>

    </>
  )
}
