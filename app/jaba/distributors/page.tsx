"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Truck, Search, Building2, Phone, Mail, MapPin, Users, LayoutGrid, List, Package, TrendingUp, Calendar, History, FileText, X, Edit, Trash2, Loader2, Save, Download } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Distributor {
  _id: string
  id: string
  name: string
  contactPerson: string
  phone: string
  email?: string
  address?: string
  region?: string
  volumeMonthly?: number
  deliveryFrequency?: string
  notes?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export default function DistributorsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; distributor: Distributor | null }>({ open: false, distributor: null })
  const [editFormData, setEditFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    region: "",
    volumeMonthly: "",
    deliveryFrequency: "",
    notes: "",
  })
  const [distributorHistory, setDistributorHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchDistributors()
  }, [])

  const fetchDistributors = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('[Distributors Page] Fetching distributors...')
      
      let response: Response
      try {
        response = await fetch('/api/jaba/distributors', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (networkError: any) {
        console.error('[Distributors Page] Network error:', networkError)
        throw new Error(`Network error: ${networkError.message || 'Failed to connect to server'}`)
      }
      
      if (!response.ok) {
        let errorData: any = { error: 'Unknown error' }
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('[Distributors Page] Failed to parse error response:', parseError)
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[Distributors Page] API error:', errorData)
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to fetch distributors`)
      }
      
      let data: any
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('[Distributors Page] Failed to parse response:', parseError)
        throw new Error('Invalid JSON response from server')
      }
      
      console.log('[Distributors Page] Received data:', data)
      
      if (!data.distributors) {
        throw new Error('Invalid response format: missing distributors array')
      }
      
      setDistributors(data.distributors || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('[Distributors Page] Error fetching distributors:', err)
      toast.error(`Failed to load distributors: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredDistributors = useMemo(() => {
    return distributors.filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [distributors, searchQuery])

  const totalVolume = useMemo(() => {
    return distributors.reduce((sum, d) => sum + (d.volumeMonthly || 0), 0)
  }, [distributors])

  const uniqueRegions = useMemo(() => {
    return new Set(distributors.map(d => d.region).filter(Boolean)).size
  }, [distributors])

  // Fetch distributor history when selected
  useEffect(() => {
    if (selectedDistributor) {
      fetchDistributorHistory(selectedDistributor)
    } else {
      setDistributorHistory([])
    }
  }, [selectedDistributor])

  const fetchDistributorHistory = async (distributorName: string) => {
    try {
      setLoadingHistory(true)
      const response = await fetch(`/api/jaba/distributor-history?distributor=${encodeURIComponent(distributorName)}`)
      const data = await response.json()
      
      if (response.ok) {
        // Convert date strings to Date objects
        const history = (data.history || []).map((item: any) => ({
          ...item,
          date: item.date ? new Date(item.date) : new Date(),
          timeOut: item.timeOut ? new Date(item.timeOut) : undefined,
          timeDelivered: item.timeDelivered ? new Date(item.timeDelivered) : undefined,
        }))
        setDistributorHistory(history)
      } else {
        setDistributorHistory([])
      }
    } catch (error) {
      console.error('Error fetching distributor history:', error)
      setDistributorHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const selectedDistributorHistory = distributorHistory

  const handleEdit = (distributor: Distributor) => {
    setEditingDistributor(distributor)
    setEditFormData({
      name: distributor.name,
      contactPerson: distributor.contactPerson,
      phone: distributor.phone,
      email: distributor.email || "",
      address: distributor.address || "",
      region: distributor.region || "",
      volumeMonthly: distributor.volumeMonthly?.toString() || "",
      deliveryFrequency: distributor.deliveryFrequency || "",
      notes: distributor.notes || "",
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingDistributor) return

    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const updateData = {
        id: editingDistributor._id,
        name: formData.get('name') as string,
        contactPerson: formData.get('contactPerson') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string || "",
        address: formData.get('address') as string || "",
        region: formData.get('region') as string || "",
        volumeMonthly: formData.get('volumeMonthly') as string || "0",
        deliveryFrequency: formData.get('deliveryFrequency') as string || "",
        notes: formData.get('notes') as string || "",
      }

      const response = await fetch('/api/jaba/distributors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update distributor')
      }

      toast.success(`Distributor "${updateData.name}" updated successfully!`)
      setShowEditDialog(false)
      setEditingDistributor(null)
      await fetchDistributors()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update distributor')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (distributor: Distributor) => {
    setDeleteConfirmDialog({ open: true, distributor })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmDialog.distributor) return

    const distributor = deleteConfirmDialog.distributor
    setIsDeleting(distributor._id)
    setDeleteConfirmDialog({ open: false, distributor: null })

    try {
      const response = await fetch(`/api/jaba/distributors?id=${distributor._id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete distributor')
      }

      toast.success(`Distributor "${distributor.name}" deleted successfully!`)
      await fetchDistributors()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete distributor')
    } finally {
      setIsDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading distributors...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <X className="h-8 w-8 text-red-600 dark:text-red-400" />
              <p className="text-lg font-semibold text-red-900 dark:text-red-100">Failed to load distributors</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={fetchDistributors} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Distributors</h1>
            <p className="text-sm text-muted-foreground">Manage internal distribution partners</p>
          </div>
        </div>
        <Link href="/jaba/distributors/add">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
            <Plus className="mr-2 h-4 w-4" />
            Add Distributor
          </Button>
        </Link>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Total Distributors</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">{distributors.length}</p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <Truck className="h-3 w-3" />
                    <span>Internal network</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <Truck className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Monthly Volume</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">{totalVolume.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Package className="h-3 w-3" />
                    <span>Units per month</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Active Regions</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">{uniqueRegions}</p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <MapPin className="h-3 w-3" />
                    <span>Coverage areas</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50">
                  <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Active Contacts</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                    {new Set(distributors.map(d => d.contactPerson)).size}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Users className="h-3 w-3" />
                    <span>Contact persons</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />
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
                placeholder="Search distributors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">View:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "table"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-muted-foreground hover:text-foreground"
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
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Grid
              </Button>
            </div>
          </div>
        </div>

        {/* Distributors List */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              All Distributors ({filteredDistributors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {viewMode === "table" ? (
                <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-green-500 dark:text-green-400" />
                            Name
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                            Region
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            Contact
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                            Monthly Volume
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                            Frequency
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDistributors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                              <Truck className="h-12 w-12 text-muted-foreground/50" />
                              <p className="text-muted-foreground font-medium">No distributors found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDistributors.map((distributor, idx) => (
                          <TableRow
                            key={distributor._id}
                            className={cn(
                              "hover:bg-gradient-to-r hover:from-green-50/70 hover:to-green-50/30 dark:hover:from-green-950/30 dark:hover:to-green-950/10 transition-all border-b border-slate-200 dark:border-slate-800 group",
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                            )}
                          >
                            <TableCell className="py-4 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 flex-shrink-0">
                                  <Truck className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                  {distributor.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <Badge className="font-semibold text-xs px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                {distributor.region || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <div className="flex items-start gap-2">
                                <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{distributor.contactPerson}</span>
                                  <span className="text-xs text-slate-600 dark:text-slate-400">{distributor.phone}</span>
                                  {distributor.email && (
                                    <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Mail className="h-3 w-3" />
                                      {distributor.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                  {distributor.volumeMonthly?.toLocaleString() || "N/A"}
                                </span>
                                {distributor.volumeMonthly && (
                                  <span className="text-xs text-slate-600 dark:text-slate-400">units</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <Badge className="font-semibold text-xs px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                                {distributor.deliveryFrequency || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-9 px-3 hover:bg-green-50 dark:hover:bg-green-950/30"
                                  onClick={() => setSelectedDistributor(distributor.name)}
                                >
                                  <History className="h-4 w-4 mr-1.5 text-green-600 dark:text-green-400" />
                                  History
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-9 w-9 p-0 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  onClick={() => handleEdit(distributor)}
                                >
                                  <Edit className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => handleDeleteClick(distributor)}
                                  disabled={isDeleting === distributor._id}
                                >
                                  {isDeleting === distributor._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredDistributors.length === 0 ? (
                    <Card className="col-span-full">
                      <CardContent className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Truck className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-medium">No distributors found</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredDistributors.map((distributor) => (
                      <Card
                        key={distributor._id}
                        className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                      >
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-200 dark:border-green-900/50 pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                                <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex flex-col gap-1.5 flex-1">
                                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                                  {distributor.name}
                                </CardTitle>
                                <Badge className="font-medium text-xs px-2 py-0.5 w-fit bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                  {distributor.region || "N/A"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-4">
                          {/* Contact Info */}
                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Contact Person</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{distributor.contactPerson}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <Phone className="h-3 w-3" />
                              <span>{distributor.phone}</span>
                            </div>
                            {distributor.email && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{distributor.email}</span>
                              </div>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-2">
                            {distributor.volumeMonthly && (
                              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Monthly Volume</p>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-100">{distributor.volumeMonthly.toLocaleString()}</p>
                              </div>
                            )}
                            {distributor.deliveryFrequency && (
                              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30">
                                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Frequency</p>
                                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">{distributor.deliveryFrequency}</p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="flex-1 h-9 hover:bg-green-50 dark:hover:bg-green-950/30"
                              onClick={() => setSelectedDistributor(distributor.name)}
                            >
                              <History className="h-4 w-4 mr-1.5 text-green-600 dark:text-green-400" />
                              History
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="flex-1 h-9 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              onClick={() => handleEdit(distributor)}
                            >
                              <Edit className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" />
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="flex-1 h-9 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => handleDeleteClick(distributor)}
                              disabled={isDeleting === distributor._id}
                            >
                              {isDeleting === distributor._id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-red-600 dark:text-red-400" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1.5 text-red-600 dark:text-red-400" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distributor History Modal */}
        <Dialog open={selectedDistributor !== null} onOpenChange={(open) => !open && setSelectedDistributor(null)}>
          <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 flex-wrap">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                    <History className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="break-words">Delivery History - {selectedDistributor}</span>
                </DialogTitle>
                {selectedDistributorHistory.length > 0 && (
                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/jaba/distributor-history/export?distributor=${encodeURIComponent(selectedDistributor!)}`)
                        if (!response.ok) {
                          throw new Error('Failed to export history')
                        }
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        const contentDisposition = response.headers.get('Content-Disposition')
                        const filename = contentDisposition 
                          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
                          : `distributor_history_${selectedDistributor}_${new Date().toISOString().split('T')[0]}.xlsx`
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                        toast.success('History exported successfully!')
                      } catch (error: any) {
                        console.error('Error exporting history:', error)
                        toast.error('Failed to export history')
                      }
                    }}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="mt-4 overflow-x-auto">
              {loadingHistory ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">Loading history...</p>
                </div>
              ) : selectedDistributorHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <History className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-medium">No delivery history found for this distributor</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-2 sm:px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 dark:text-blue-400" />
                              <span className="hidden sm:inline">Date</span>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 dark:text-purple-400" />
                              <span className="hidden sm:inline">Note ID</span>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 dark:text-amber-400" />
                              <span className="hidden sm:inline">Batch</span>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">Items</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">Status</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500 dark:text-indigo-400" />
                              <span className="hidden sm:inline">Details</span>
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDistributorHistory.map((item, idx) => {
                          const totalItems = item.items.reduce((sum, i) => sum + i.quantity, 0)
                          return (
                            <TableRow
                              key={item.id}
                              className={cn(
                                "hover:bg-gradient-to-r transition-all border-b border-slate-200 dark:border-slate-800 group",
                                item.status === "Delivered"
                                  ? "hover:from-green-50/70 hover:to-green-50/30 dark:hover:from-green-950/30 dark:hover:to-green-950/10"
                                  : item.status === "In Transit"
                                  ? "hover:from-blue-50/70 hover:to-blue-50/30 dark:hover:from-blue-950/30 dark:hover:to-blue-950/10"
                                  : "hover:from-amber-50/70 hover:to-amber-50/30 dark:hover:from-amber-950/30 dark:hover:to-amber-950/10",
                                idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                              )}
                            >
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <div className="flex flex-col min-w-[80px]">
                                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {item.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  {item.timeOut && (
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                      {item.timeOut.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                  {item.noteId}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                  {item.batchNumber}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <div className="flex flex-col gap-0.5 sm:gap-1">
                                  {item.items.map((itemDetail, itemIdx) => (
                                    <div key={itemIdx} className="flex items-center gap-1 text-xs sm:text-sm">
                                      <span className="font-semibold text-slate-900 dark:text-slate-100">{itemDetail.quantity}</span>
                                      <span className="text-slate-600 dark:text-slate-400">× {itemDetail.size}</span>
                                    </div>
                                  ))}
                                  <span className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                                    Total: {totalItems} units
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <Badge className={cn(
                                  "font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 whitespace-nowrap",
                                  item.status === "Delivered"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : item.status === "In Transit"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                )}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-[100px]">
                                  {item.driver && (
                                    <span className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">
                                      <span className="hidden sm:inline">Driver: </span>
                                      <span className="sm:hidden">D: </span>
                                      {item.driver}
                                    </span>
                                  )}
                                  {item.vehicle && (
                                    <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
                                      <span className="hidden sm:inline">Vehicle: </span>
                                      <span className="sm:hidden">V: </span>
                                      {item.vehicle}
                                    </span>
                                  )}
                                  {item.deliveryLocation && (
                                    <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 break-words">
                                      <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5" />
                                      {item.deliveryLocation}
                                    </span>
                                  )}
                                  {item.timeDelivered && (
                                    <span className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-400">
                                      Delivered: {item.timeDelivered.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-2xl">
            <DialogHeader className="pb-4 border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <Edit className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Distributor</DialogTitle>
              </div>
              {editingDistributor && (
                <p className="text-sm text-muted-foreground mt-1 ml-12">Update distributor information</p>
              )}
            </DialogHeader>
            {editingDistributor && (
              <form onSubmit={handleSaveEdit} className="space-y-6 pt-2">
                {/* Basic Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Distributor Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="name"
                          defaultValue={editFormData.name}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Region</label>
                        <Input
                          name="region"
                          defaultValue={editFormData.region}
                          placeholder="e.g., Northeast, West Coast"
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                        Contact Person <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                      </label>
                      <Input
                        name="contactPerson"
                        defaultValue={editFormData.contactPerson}
                        required
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Phone <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="phone"
                          defaultValue={editFormData.phone}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Email</label>
                        <Input
                          name="email"
                          type="email"
                          defaultValue={editFormData.email}
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Address</label>
                      <Textarea
                        name="address"
                        defaultValue={editFormData.address}
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Distribution Details Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-b border-purple-200 dark:border-purple-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Distribution Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Monthly Volume</label>
                        <Input
                          name="volumeMonthly"
                          type="number"
                          defaultValue={editFormData.volumeMonthly}
                          placeholder="0"
                          min="0"
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Delivery Frequency</label>
                        <Input
                          name="deliveryFrequency"
                          defaultValue={editFormData.deliveryFrequency}
                          placeholder="e.g., Weekly, Daily"
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Notes</label>
                      <Textarea
                        name="notes"
                        defaultValue={editFormData.notes}
                        placeholder="Additional notes about this distributor..."
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false)
                      setEditingDistributor(null)
                    }}
                    disabled={isSaving}
                    className="border-2 border-slate-300 dark:border-slate-700 h-11 px-6 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/30 text-white h-11 px-6 font-semibold"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, distributor: null })}>
          <DialogContent className="max-w-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-red-300 dark:border-red-700 shadow-2xl">
            <DialogHeader className="pb-4 border-b-2 border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 shadow-lg">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100">Delete Distributor</DialogTitle>
              </div>
            </DialogHeader>
            {deleteConfirmDialog.distributor && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{deleteConfirmDialog.distributor.name}"</span>?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  This action cannot be undone. All distributor information will be permanently deleted.
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteConfirmDialog({ open: false, distributor: null })}
                    disabled={isDeleting === deleteConfirmDialog.distributor._id}
                    className="border-2 border-slate-300 dark:border-slate-700 h-11 px-6 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting === deleteConfirmDialog.distributor._id}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30 text-white h-11 px-6 font-semibold"
                  >
                    {isDeleting === deleteConfirmDialog.distributor._id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Distributor
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
