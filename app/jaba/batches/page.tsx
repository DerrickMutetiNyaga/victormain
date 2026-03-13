"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Edit, Truck, Plus, Search, Filter, Factory, TrendingUp, Package, CheckSquare, Calendar, Hash, Tag, LayoutGrid, List, Droplet, Loader2, X, Save, ClipboardCheck, Boxes, Warehouse, Lock, ChevronDown, ChevronUp, PackageX } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useJabaPermissions } from "@/hooks/use-jaba-permissions"

interface Batch {
  _id: string
  id: string
  batchNumber: string
  date: string
  flavor: string
  productCategory: string
  totalLitres: number
  bottles500ml: number
  bottles1L: number
  bottles2L: number
  status: "Processing" | "Processed" | "QC Pending" | "Completed" | "Ready for Distribution" | "QC Passed - Ready for Packaging" | "QC Failed" | "Partially Packaged"
  qcStage?: "initial" | "final"
  qcStatus: "Pending" | "Pass" | "Fail" | "In Progress"
  supervisor: string
  shift: "Morning" | "Afternoon" | "Night"
  productionStartTime?: string
  productionEndTime?: string
  mixingDuration?: number
  processingHours?: number
  expectedLoss?: number
  actualLoss?: number
  temperature?: number
  ingredients: { material: string; quantity: number; unit: string; unitCost: number; totalCost: number; lotNumber?: string; supplier?: string }[]
  documents?: string[]
  packagingTeam?: string[]
  packagingTime?: string
  locked?: boolean
  outputSummary: {
    totalBottles: number
    remainingLitres: number
    breakdown: { size: string; quantity: number; litres: number }[]
  }
  packagedLitres?: number
}

// Helper function to get shift badge colors
const getShiftColors = (shift: "Morning" | "Afternoon" | "Night") => {
  switch (shift) {
    case "Morning":
      return "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50"
    case "Afternoon":
      return "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/50"
    case "Night":
      return "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50"
    default:
      return "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
  }
}

export default function BatchesPage() {
  const { canCreate, canEdit, canDelete } = useJabaPermissions("batches")
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [flavorFilter, setFlavorFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [flavors, setFlavors] = useState<{ _id: string; name: string }[]>([])
  const [showFlavorDialog, setShowFlavorDialog] = useState(false)
  const [editingFlavor, setEditingFlavor] = useState<{ _id: string; name: string } | null>(null)
  const [newFlavorName, setNewFlavorName] = useState("")
  const [isSavingFlavor, setIsSavingFlavor] = useState(false)
  const [showProcessedDialog, setShowProcessedDialog] = useState(false)
  const [selectedBatchForProcessing, setSelectedBatchForProcessing] = useState<string | null>(null)
  const [processedFormData, setProcessedFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    producedVolume: "",
    supervisor: "",
    varianceReason: "",
  })

  useEffect(() => {
    fetchBatches()
    fetchFlavors()
  }, [])

  const fetchFlavors = async () => {
    try {
      console.log('[Batches Page] Fetching flavors...')
      const response = await fetch('/api/jaba/flavors')
      const data = await response.json()
      console.log('[Batches Page] Flavors API response:', data)
      if (response.ok) {
        console.log('[Batches Page] Setting flavors:', data.flavors)
        setFlavors(data.flavors || [])
      } else {
        console.error('[Batches Page] Failed to fetch flavors:', data.error)
        toast.error(`Failed to fetch flavors: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Batches Page] Error fetching flavors:', error)
      toast.error('Failed to fetch flavors. Please check your connection.')
    }
  }

  const handleAddFlavor = async () => {
    if (!newFlavorName.trim()) {
      toast.error("Please enter a flavor name")
      return
    }

    setIsSavingFlavor(true)
    try {
      const response = await fetch('/api/jaba/flavors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFlavorName.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add flavor')
      }

      toast.success(`Flavor "${newFlavorName}" added successfully!`)
      setNewFlavorName("")
      await fetchFlavors()
      setShowFlavorDialog(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add flavor')
    } finally {
      setIsSavingFlavor(false)
    }
  }

  const handleEditFlavor = async () => {
    if (!editingFlavor || !newFlavorName.trim()) {
      toast.error("Please enter a flavor name")
      return
    }

    setIsSavingFlavor(true)
    try {
      const response = await fetch('/api/jaba/flavors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingFlavor._id, name: newFlavorName.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update flavor')
      }

      toast.success(`Flavor updated successfully!`)
      setEditingFlavor(null)
      setNewFlavorName("")
      await fetchFlavors()
      setShowFlavorDialog(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update flavor')
    } finally {
      setIsSavingFlavor(false)
    }
  }

  const handleDeleteFlavor = async (flavorId: string, flavorName: string) => {
    if (!confirm(`Are you sure you want to delete "${flavorName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/jaba/flavors?id=${flavorId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete flavor')
      }

      toast.success(`Flavor "${flavorName}" deleted successfully!`)
      await fetchFlavors()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete flavor')
    }
  }

  const openEditDialog = (flavor: { _id: string; name: string }) => {
    setEditingFlavor(flavor)
    setNewFlavorName(flavor.name)
    setShowFlavorDialog(true)
  }

  const openAddDialog = () => {
    setEditingFlavor(null)
    setNewFlavorName("")
    setShowFlavorDialog(true)
  }

  const fetchBatches = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/jaba/batches')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch batches')
      }
      
      setBatches(data.batches || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error fetching batches:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenProcessedDialog = (batchId: string) => {
    const batch = batches.find(b => (b._id || b.id) === batchId)
    if (batch) {
      setSelectedBatchForProcessing(batchId)
      setProcessedFormData({
        date: new Date().toISOString().split("T")[0],
        producedVolume: "",
        supervisor: batch.supervisor || "",
        varianceReason: "",
      })
      setShowProcessedDialog(true)
    }
  }

  const handleMarkAsProcessed = async () => {
    if (!selectedBatchForProcessing) return

    // Validate form
    if (!processedFormData.date || !processedFormData.producedVolume || !processedFormData.supervisor) {
      toast.error("Please fill in all required fields")
      return
    }

    if (isNaN(Number(processedFormData.producedVolume)) || Number(processedFormData.producedVolume) <= 0) {
      toast.error("Produced volume must be a positive number")
      return
    }

    // Check if produced volume differs from expected and require reason
    const selectedBatch = batches.find(b => (b._id || b.id) === selectedBatchForProcessing)
    const expectedVolume = selectedBatch?.expectedLitres || selectedBatch?.totalLitres || 0
    const producedVolume = Number(processedFormData.producedVolume)
    
    if (Math.abs(producedVolume - expectedVolume) > 0.01 && !processedFormData.varianceReason.trim()) {
      toast.error("Please provide a reason for the production variance (expected vs actual volume difference)")
      return
    }

    try {
      const response = await fetch(`/api/jaba/batches/${selectedBatchForProcessing}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'Processed',
          totalLitres: Number(processedFormData.producedVolume),
          supervisor: processedFormData.supervisor.trim(),
          productionDate: processedFormData.date,
          productionVarianceReason: processedFormData.varianceReason.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark batch as processed')
      }

      toast.success('Batch marked as processed!')
      setShowProcessedDialog(false)
      setSelectedBatchForProcessing(null)
      setProcessedFormData({
        date: new Date().toISOString().split("T")[0],
        producedVolume: "",
        supervisor: "",
        varianceReason: "",
      })
      await fetchBatches() // Refresh the batches list
    } catch (error: any) {
      console.error('Error marking batch as processed:', error)
      toast.error(error.message || 'Failed to mark batch as processed')
    }
  }

  const [availableFlavors, setAvailableFlavors] = useState<string[]>([])
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false)
  const [packagingOutputs, setPackagingOutputs] = useState<any[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])

  // Update available flavors when flavors state changes
  useEffect(() => {
    setAvailableFlavors(flavors.map(f => f.name).sort())
  }, [flavors])

  // Fetch packaging outputs and delivery notes to calculate available stock
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        // Fetch packaging outputs
        const packagingResponse = await fetch('/api/jaba/packaging-output')
        const packagingData = await packagingResponse.json()
        if (packagingResponse.ok && packagingData.packagingOutputs) {
          setPackagingOutputs(packagingData.packagingOutputs)
        }

        // Fetch delivery notes
        const deliveryNotesResponse = await fetch('/api/jaba/delivery-notes')
        const deliveryNotesData = await deliveryNotesResponse.json()
        if (deliveryNotesResponse.ok && deliveryNotesData.deliveryNotes) {
          setDeliveryNotes(deliveryNotesData.deliveryNotes)
        }
      } catch (error) {
        console.error('Error fetching stock data:', error)
      }
    }
    fetchStockData()
  }, [])

  // Calculate available stock for a batch (packaged - distributed)
  const getAvailableStock = (batch: Batch): number => {
    const batchNumber = batch.batchNumber
    const batchId = batch._id?.toString() || batch.id
    
    // Calculate total packaged by size
    let totalPackaged500ml = 0
    let totalPackaged1L = 0
    let totalPackaged2L = 0
    
    packagingOutputs.forEach((output: any) => {
      if (output.batchId === batchId && output.containers && Array.isArray(output.containers)) {
        output.containers.forEach((container: any) => {
          const qty = parseFloat(container.quantity) || 0
          if (container.size === '500ml') {
            totalPackaged500ml += qty
          } else if (container.size === '1L') {
            totalPackaged1L += qty
          } else if (container.size === '2L') {
            totalPackaged2L += qty
          }
        })
      }
    })
    
    // Calculate already distributed by size
    let totalDistributed500ml = 0
    let totalDistributed1L = 0
    let totalDistributed2L = 0
    
    deliveryNotes.forEach((note: any) => {
      if (note.items && Array.isArray(note.items)) {
        note.items.forEach((item: any) => {
          if (item.batchNumber === batchNumber) {
            const qty = parseFloat(item.quantity) || 0
            if (item.size === '500ml') {
              totalDistributed500ml += qty
            } else if (item.size === '1L') {
              totalDistributed1L += qty
            } else if (item.size === '2L') {
              totalDistributed2L += qty
            }
          }
        })
      }
    })
    
    // Calculate available (packaged - distributed)
    const available500ml = Math.max(0, totalPackaged500ml - totalDistributed500ml)
    const available1L = Math.max(0, totalPackaged1L - totalDistributed1L)
    const available2L = Math.max(0, totalPackaged2L - totalDistributed2L)
    
    return available500ml + available1L + available2L
  }

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesSearch = batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.flavor.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFlavor = flavorFilter === "all" || batch.flavor === flavorFilter
      const matchesStatus = statusFilter === "all" || batch.status === statusFilter
      return matchesSearch && matchesFlavor && matchesStatus
    })
  }, [batches, searchQuery, flavorFilter, statusFilter])

  // Helper to convert ISO string to Date for display
  const getDate = (dateString: string) => {
    return new Date(dateString)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "Ready for Distribution":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      case "Processed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "QC Passed - Ready for Packaging":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "Partially Packaged":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "QC Failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "QC Pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "Processing":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    }
  }

  // Calculate statistics
  const totalBatches = batches.length
  const totalLitres = batches.reduce((sum, b) => sum + b.totalLitres, 0)
  const completedBatches = batches.filter((b) => b.status === "Completed" || b.status === "Ready for Distribution").length
  const qcPendingBatches = batches.filter((b) => b.status === "QC Pending").length
  const processingBatches = batches.filter((b) => b.status === "Processing").length

  if (loading) {
    return (
      <>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Batch Production</h1>
            <p className="text-sm text-muted-foreground">Manage and track production batches</p>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="text-muted-foreground">Loading batches...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Batch Production</h1>
            <p className="text-sm text-muted-foreground">Manage and track production batches</p>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchBatches}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">Batch Production</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">Manage and track production batches</p>
        </div>
        {canCreate && (
          <Link href="/jaba/batches/add">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
          </Link>
        )}
      </header>

      <div className="p-6 max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-h-screen">
        {/* Collapsible Overview Section */}
        <div className="mb-8">
          {/* Clickable Header */}
          <button
            onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 mb-2"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Overview</h2>
              {!isOverviewExpanded && (
                <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                  — {totalBatches} Batches • {totalLitres.toLocaleString()}L • {processingBatches + qcPendingBatches} In Progress
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOverviewExpanded ? (
                <ChevronUp className="h-5 w-5 text-slate-500 dark:text-slate-400 transition-transform duration-300" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400 transition-transform duration-300" />
              )}
            </div>
          </button>

          {/* Collapsible Content */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isOverviewExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Total Batches</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalBatches}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                      <Factory className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Total Production</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {totalLitres.toLocaleString()}L
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Completed</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedBatches}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">In Progress</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {processingBatches + qcPendingBatches}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                      <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 leading-tight">Filters & Search</h2>
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by batch number or flavor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500"
                  />
                </div>
                <Select value={flavorFilter} onValueChange={setFlavorFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by Flavor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Flavors</SelectItem>
                    {availableFlavors.map((flavor) => (
                      <SelectItem key={flavor} value={flavor}>{flavor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Processed">Processed</SelectItem>
                    <SelectItem value="QC Pending">QC Pending</SelectItem>
                    <SelectItem value="QC Passed - Ready for Packaging">QC Passed - Ready for Packaging</SelectItem>
                    <SelectItem value="Partially Packaged">Partially Packaged</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Ready for Distribution">Ready for Distribution</SelectItem>
                    <SelectItem value="QC Failed">QC Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Dialog open={showFlavorDialog} onOpenChange={setShowFlavorDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddDialog} variant="outline" className="h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Tag className="mr-2 h-4 w-4" />
                      Manage Flavors
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">Manage Flavors</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Add/Edit Form */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 leading-tight">
                        {editingFlavor ? 'Edit Flavor' : 'Add New Flavor'}
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter flavor name (e.g., dawa, pineapple)"
                          value={newFlavorName}
                          onChange={(e) => setNewFlavorName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (editingFlavor ? handleEditFlavor() : handleAddFlavor())}
                          className="flex-1 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        />
                        <Button
                          onClick={editingFlavor ? handleEditFlavor : handleAddFlavor}
                          disabled={isSavingFlavor || !newFlavorName.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white h-10"
                        >
                          {isSavingFlavor ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {editingFlavor ? 'Update' : 'Add'}
                        </Button>
                        {editingFlavor && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingFlavor(null)
                              setNewFlavorName("")
                            }}
                            className="h-10 border-slate-200 dark:border-slate-700"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Flavors List */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 leading-tight">All Flavors ({flavors.length})</h3>
                      {flavors.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No flavors available. Add your first flavor!</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {flavors.map((flavor) => (
                            <div
                              key={flavor._id}
                              className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{flavor.name}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(flavor)}
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                                  title="Edit flavor"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteFlavor(flavor._id, flavor.name)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Delete flavor"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* View Toggle */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">View:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "table"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <List className="h-4 w-4 mr-1.5" />
                Table
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "grid"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Grid
              </Button>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white border-0 shadow-sm text-xs px-3 py-1">
            {filteredBatches.length} batch{filteredBatches.length !== 1 ? "es" : ""}
          </Badge>
        </div>

        {/* Table View */}
        {viewMode === "table" && (
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 py-4">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-2">
                <Factory className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Production Batches
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({filteredBatches.length})</span>
              </CardTitle>
            </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3">
                      Batch Number
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3">
                      Product
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3">
                      Volume
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3">Date</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 px-6">
                        <div className="flex flex-col items-center gap-3">
                          <Factory className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No batches found</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBatches.map((batch, idx) => (
                      <TableRow 
                        key={batch.id} 
                        className={cn(
                          "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800",
                          idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/30 dark:bg-slate-800/20"
                        )}
                      >
                        {/* Batch Number */}
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{batch.batchNumber}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Infusion Jaba</span>
                          </div>
                        </TableCell>

                        {/* Product */}
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{batch.flavor}</span>
                            <Badge className={`${getShiftColors(batch.shift)} border text-xs font-medium w-fit`}>
                              {batch.shift}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* Volume */}
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{batch.totalLitres}L</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {batch.status === "Processing" ? "(Expected)" : "(Produced)"}
                              </span>
                            </div>
                            {(() => {
                              const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                              const availableStock = getAvailableStock(batch)
                              const isSoldOut = remainingLitres === 0 && availableStock === 0
                              
                              if (isSoldOut) {
                                return (
                                  <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 shadow-sm">
                                    <PackageX className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">SOLD OUT</span>
                                  </div>
                                )
                              }
                              
                              if (remainingLitres !== undefined && remainingLitres < batch.totalLitres && remainingLitres > 0) {
                                return (
                                  <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
                                    <Warehouse className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Remaining</span>
                                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">{remainingLitres.toFixed(2)}L</span>
                                  </div>
                                )
                              }
                              
                              return null
                            })()}
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {batch.supervisor}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight">{getDate(batch.date).toLocaleDateString()}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {getDate(batch.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {(() => {
                            const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                            const availableStock = getAvailableStock(batch)
                            const isSoldOut = remainingLitres === 0 && availableStock === 0
                            
                            return (
                              <Badge className={cn(
                                "text-xs font-medium",
                                isSoldOut
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                                  : getStatusColor(batch.status)
                              )}>
                                {isSoldOut ? "SOLD OUT" : batch.status}
                              </Badge>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Workflow Actions */}
                            {batch.status === "Processing" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenProcessedDialog(batch._id || batch.id)}
                                className="h-8 w-8 p-0 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 rounded-lg font-medium"
                                title="Mark as Processed"
                              >
                                <CheckSquare className="h-4 w-4" />
                              </Button>
                            )}
                            {(batch.status === "Processed" || batch.status === "QC Pending") && (
                              <Link href={`/jaba/qc/checklist?batchId=${batch._id || batch.id}&stage=initial`}>
                                <Button
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                                  title="Start Quality Control"
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {/* Show packaging button if QC passed, Processed (skip QC), or partially packaged */}
                            {((batch.status === "QC Passed - Ready for Packaging" || batch.status === "Processed" || batch.status === "Partially Packaged" || (batch.qcStatus === "Pass" && batch.status !== "Ready for Distribution")) && 
                              (batch.outputSummary?.remainingLitres === undefined || batch.outputSummary.remainingLitres > 0)) && (
                              <Link href={`/jaba/packaging-output/add?batchId=${batch._id || batch.id}`}>
                                <Button
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                                  title="Go to Packaging"
                                >
                                  <Boxes className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {/* Show distribution button ONLY if has available stock (packaged - distributed > 0) */}
                            {((batch.status === "Ready for Distribution" || batch.status === "Partially Packaged") && 
                              getAvailableStock(batch) > 0) && (
                              <Link href={`/jaba/distribution/create?batch=${batch._id || batch.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-lg"
                                  title="Create Distribution"
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            
                            {/* Standard Actions */}
                            <Link href={`/jaba/batches/${batch._id || batch.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {(() => {
                              const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                              const availableStock = getAvailableStock(batch)
                              const isSoldOut = remainingLitres === 0 && availableStock === 0
                              const isLocked = batch.status === "Processed" || batch.locked || isSoldOut
                              
                              if (isLocked) {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="h-8 w-8 p-0 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                                    title={isSoldOut ? "Batch sold out" : "Batch locked after processing"}
                                  >
                                    <Lock className="h-4 w-4" />
                                  </Button>
                                )
                              }
                              
                              return canEdit ? (
                                <Link href={`/jaba/batches/edit/${batch._id || batch.id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                    title="Edit Batch"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
                              ) : null
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Grid/Card View */}
        {viewMode === "grid" && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredBatches.length === 0 ? (
              <Card className="col-span-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
                <CardContent className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Factory className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No batches found</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Try adjusting your filters</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredBatches.map((batch) => {
                const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                const availableStock = getAvailableStock(batch)
                const isSoldOut = remainingLitres === 0 && availableStock === 0
                
                return (
                <Card
                  key={batch.id}
                  className={cn(
                    "border shadow-sm hover:shadow-md transition-shadow rounded-xl overflow-hidden",
                    isSoldOut
                      ? "border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 border-l-4 border-l-red-400 dark:border-l-red-600"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  )}
                >
                  {/* Card Header */}
                  <CardHeader className={cn(
                    "border-b px-5 py-4",
                    isSoldOut
                      ? "border-red-200 dark:border-red-800 bg-slate-50 dark:bg-slate-800/50"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                          {batch.batchNumber}
                        </CardTitle>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Infusion Jaba</span>
                      </div>
                      <Badge className={cn(
                        "text-xs font-medium shrink-0",
                        isSoldOut
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                          : getStatusColor(batch.status)
                      )}>
                        {isSoldOut ? "SOLD OUT" : batch.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Product Section */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Product</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{batch.flavor}</p>
                        <Badge className={`${getShiftColors(batch.shift)} border text-xs font-medium`}>
                          {batch.shift}
                        </Badge>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>

                    {/* Volume Info */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        {batch.status === "Processing" ? "Expected Volume" : "Produced Volume"}
                      </p>
                      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">{batch.totalLitres}L</p>
                      {(() => {
                        const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                        const availableStock = getAvailableStock(batch)
                        const isSoldOut = remainingLitres === 0 && availableStock === 0
                        
                        if (isSoldOut) {
                          return (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 shadow-sm">
                              <PackageX className="h-4 w-4 text-red-600 dark:text-red-400" />
                              <span className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">SOLD OUT</span>
                            </div>
                          )
                        }
                        
                        if (remainingLitres !== undefined && remainingLitres < batch.totalLitres && remainingLitres > 0) {
                          return (
                            <div className="mt-3 inline-flex flex-col gap-1 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
                              <div className="flex items-center gap-1.5">
                                <Warehouse className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Remaining</span>
                              </div>
                              <span className="text-lg font-semibold text-amber-900 dark:text-amber-100 leading-tight">{remainingLitres.toFixed(2)}L</span>
                            </div>
                          )
                        }
                        
                        return null
                      })()}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">Supervisor</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{batch.supervisor}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">Date</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                          {getDate(batch.date).toLocaleDateString()}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                          {getDate(batch.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Workflow Actions */}
                      {batch.status === "Processing" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenProcessedDialog(batch._id || batch.id)}
                          className="flex-1 h-9 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-medium"
                          title="Mark as Processed"
                        >
                          <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                          Processed
                        </Button>
                      )}
                      {(batch.status === "Processed" || batch.status === "QC Pending") && (
                        <Link href={`/jaba/qc/checklist?batchId=${batch._id || batch.id}&stage=initial`} className="flex-1">
                        <Button
                          size="sm"
                            className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                            QC
                        </Button>
                      </Link>
                      )}
                      {/* Show packaging button if QC passed, Processed (skip QC), or partially packaged */}
                      {((batch.status === "QC Passed - Ready for Packaging" || batch.status === "Processed" || batch.status === "Partially Packaged" || (batch.qcStatus === "Pass" && batch.status !== "Ready for Distribution")) && 
                        (batch.outputSummary?.remainingLitres === undefined || batch.outputSummary.remainingLitres > 0)) && (
                        <Link href={`/jaba/packaging-output/add?batchId=${batch._id || batch.id}`} className="flex-1">
                          <Button
                            size="sm"
                            className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                          >
                            <Boxes className="h-3.5 w-3.5 mr-1.5" />
                            Packaging
                          </Button>
                        </Link>
                      )}
                      {/* Show distribution button ONLY if has available stock (packaged - distributed > 0) - HIDDEN if sold out */}
                      {(() => {
                        const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                        const availableStock = getAvailableStock(batch)
                        const isSoldOut = remainingLitres === 0 && availableStock === 0
                        
                        return !isSoldOut && 
                          ((batch.status === "Ready for Distribution" || batch.status === "Partially Packaged") && 
                          getAvailableStock(batch) > 0)
                      })() && (
                        <Link href={`/jaba/distribution/create?batch=${batch._id || batch.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-9 border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-lg text-xs font-medium"
                          >
                            <Truck className="h-3.5 w-3.5 mr-1.5" />
                            Distribution
                          </Button>
                        </Link>
                      )}
                      
                      {/* Standard Actions */}
                      <Link href={`/jaba/batches/${batch._id || batch.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1.5" />
                          View
                        </Button>
                      </Link>
                      {(() => {
                        const remainingLitres = batch.outputSummary?.remainingLitres ?? 0
                        const availableStock = getAvailableStock(batch)
                        const isSoldOut = remainingLitres === 0 && availableStock === 0
                        const isLocked = batch.status === "Processed" || batch.locked || isSoldOut
                        
                        if (isLocked) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="flex-1 h-9 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50 text-xs font-medium"
                              title={isSoldOut ? "Batch sold out" : "Batch locked after processing"}
                            >
                              <Lock className="h-3.5 w-3.5 mr-1.5" />
                              {isSoldOut ? "Sold Out" : "Locked"}
                            </Button>
                          )
                        }
                        
                        return canEdit ? (
                          <Link href={`/jaba/batches/edit/${batch._id || batch.id}`} className="flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              Edit
                            </Button>
                          </Link>
                        ) : null
                      })()}
                    </div>
                  </CardContent>
                </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Mark as Processed Dialog */}
      <Dialog open={showProcessedDialog} onOpenChange={setShowProcessedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Mark Batch as Processed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="processedDate" className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                Production Date <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Input
                id="processedDate"
                type="date"
                value={processedFormData.date}
                onChange={(e) => setProcessedFormData({ ...processedFormData, date: e.target.value })}
                className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                required
              />
            </div>
            {selectedBatchForProcessing && (() => {
              const batch = batches.find(b => (b._id || b.id) === selectedBatchForProcessing)
              const expected = batch?.expectedLitres || batch?.totalLitres || 0
              return (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 leading-relaxed">
                    Expected Production Volume: <span className="text-base font-semibold">{expected}L</span>
                  </p>
                </div>
              )
            })()}
            <div className="space-y-2">
              <Label htmlFor="producedVolume" className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                Actual Produced Volume (Litres) <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Input
                id="producedVolume"
                type="number"
                placeholder="0"
                value={processedFormData.producedVolume}
                onChange={(e) => {
                  const newVolume = e.target.value
                  setProcessedFormData({ ...processedFormData, producedVolume: newVolume })
                }}
                className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                min="0"
                step="0.01"
                required
              />
              {selectedBatchForProcessing && (() => {
                const batch = batches.find(b => (b._id || b.id) === selectedBatchForProcessing)
                const expected = batch?.expectedLitres || batch?.totalLitres || 0
                const produced = Number(processedFormData.producedVolume) || 0
                const difference = produced - expected
                if (produced > 0 && Math.abs(difference) > 0.01) {
                  return (
                    <div className={cn(
                      "p-3 rounded-lg border text-sm",
                      difference < 0 
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                        : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    )}>
                      <p className="font-medium leading-relaxed">
                        Variance: <span className={cn(
                          difference < 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        )}>
                          {difference > 0 ? '+' : ''}{difference.toFixed(2)}L
                        </span>
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-2">
                          ({((difference / expected) * 100).toFixed(1)}%)
                        </span>
                      </p>
                    </div>
                  )
                }
                return null
              })()}
            </div>
            {selectedBatchForProcessing && (() => {
              const batch = batches.find(b => (b._id || b.id) === selectedBatchForProcessing)
              const expected = batch?.expectedLitres || batch?.totalLitres || 0
              const produced = Number(processedFormData.producedVolume) || 0
              const hasVariance = Math.abs(produced - expected) > 0.01
              
              if (hasVariance && produced > 0) {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="varianceReason" className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                      Reason for Variance <span className="text-red-600 dark:text-red-400">*</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-2">
                        (Required when actual differs from expected)
                      </span>
                    </Label>
                    <Textarea
                      id="varianceReason"
                      placeholder="Explain why the produced volume differs from expected (e.g., material loss, equipment issues, measurement adjustments, etc.)"
                      value={processedFormData.varianceReason}
                      onChange={(e) => setProcessedFormData({ ...processedFormData, varianceReason: e.target.value })}
                      className="min-h-[100px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                      required
                    />
                  </div>
                )
              }
              return null
            })()}
            <div className="space-y-2">
              <Label htmlFor="processedSupervisor" className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                Supervisor Name <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Input
                id="processedSupervisor"
                placeholder="Supervisor name"
                value={processedFormData.supervisor}
                onChange={(e) => setProcessedFormData({ ...processedFormData, supervisor: e.target.value })}
                className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowProcessedDialog(false)
                  setSelectedBatchForProcessing(null)
      setProcessedFormData({
        date: new Date().toISOString().split("T")[0],
        producedVolume: "",
        supervisor: "",
        varianceReason: "",
      })
                }}
                className="flex-1 h-10 border-slate-200 dark:border-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkAsProcessed}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-10"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Mark as Processed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
