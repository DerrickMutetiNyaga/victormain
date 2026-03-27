"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Search, AlertTriangle, Package, Warehouse, TrendingDown, TrendingUp, Box, Hash, Tag, Droplet, Calendar, Building2, LayoutGrid, List, FileBarChart, Loader2, Edit, Trash2, Save } from "lucide-react"
import Link from "next/link"
import { materialUsageLogs } from "@/lib/jaba-data"
import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"

interface RawMaterial {
  _id: string
  id: string
  name: string
  category: string
  currentStock: number
  unit: string
  minStock: number
  supplier: string
  lastRestocked?: string | Date
  reorderLevel: number
  preferredSupplier?: string
}

export default function RawMaterialsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [dbCategories, setDbCategories] = useState<{ _id: string; name: string }[]>([])
  const [editingCategory, setEditingCategory] = useState<{ _id: string; name: string } | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isDeletingCategory, setIsDeletingCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchRawMaterials()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/jaba/categories')
      const data = await response.json()
      if (response.ok) {
        setDbCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchRawMaterials = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/jaba/raw-materials')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch raw materials')
      }
      
      // Convert lastRestocked string to Date if it exists
      const materials = (data.materials || []).map((m: RawMaterial) => ({
        ...m,
        lastRestocked: m.lastRestocked ? new Date(m.lastRestocked) : undefined,
      }))
      
      setRawMaterials(materials)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error fetching raw materials:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter((material) => {
      const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "all" || material.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [rawMaterials, searchQuery, categoryFilter])

  const materialCategories = useMemo(() => {
    return Array.from(new Set(rawMaterials.map((m) => m.category)))
  }, [rawMaterials])

  // Use categories from database, fallback to unique categories from materials
  const availableCategories = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map(c => c.name)
    }
    return Array.from(new Set(rawMaterials.map((m) => m.category)))
  }, [dbCategories, rawMaterials])

  const getStockStatus = (material: typeof rawMaterials[0]) => {
    if (material.currentStock <= material.minStock) {
      return { label: "Low Stock", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" }
    } else if (material.currentStock <= material.minStock * 1.5) {
      return { label: "Warning", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" }
    }
    return { label: "In Stock", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" }
  }


  const [editCategory, setEditCategory] = useState("")

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material)
    setEditCategory(material.category)
    setShowEditDialog(true)
  }

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingMaterial) return

    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const updateData = {
        id: editingMaterial._id,
        name: formData.get('name') as string,
        category: editCategory || (formData.get('category') as string),
        currentStock: Number(formData.get('currentStock')),
        unit: formData.get('unit') as string,
        minStock: Number(formData.get('minStock')),
        supplier: formData.get('supplier') as string,
        reorderLevel: Number(formData.get('reorderLevel')),
        preferredSupplier: formData.get('preferredSupplier') as string || formData.get('supplier') as string,
      }

      const response = await fetch('/api/jaba/raw-materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update raw material')
      }

      toast.success(`Raw material "${updateData.name}" updated successfully!`)
      setShowEditDialog(false)
      setEditingMaterial(null)
      await fetchRawMaterials()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update raw material')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (material: RawMaterial) => {
    if (!confirm(`Are you sure you want to delete "${material.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(material._id)
    try {
      const response = await fetch(`/api/jaba/raw-materials?id=${material._id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete raw material')
      }

      toast.success(`Raw material "${material.name}" deleted successfully!`)
      await fetchRawMaterials()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete raw material')
    } finally {
      setIsDeleting(null)
    }
  }

  const lowStockCount = useMemo(() => rawMaterials.filter((m) => m.currentStock <= m.minStock).length, [rawMaterials])
  const warningStockCount = useMemo(() => rawMaterials.filter((m) => m.currentStock > m.minStock && m.currentStock <= m.minStock * 1.5).length, [rawMaterials])
  const totalStock = useMemo(() => rawMaterials.reduce((sum, m) => sum + m.currentStock, 0), [rawMaterials])
  const totalValue = useMemo(() => rawMaterials.reduce((sum, m) => sum + (m.currentStock * (m.reorderLevel * 0.1)), 0), [rawMaterials])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <p className="text-lg font-semibold text-red-900 dark:text-red-100">Failed to load raw materials</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={fetchRawMaterials} className="mt-4">
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
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Raw Materials</h1>
            <p className="text-sm text-muted-foreground">Manage raw materials inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowCategoryDialog(true)}
            className="border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <Tag className="mr-2 h-4 w-4" />
            Manage Categories
          </Button>
          <Link href="/jaba/raw-materials/add">
            <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
              <Plus className="mr-2 h-4 w-4" />
              Add Material
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Total Materials</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">{rawMaterials.length}</p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Package className="h-3 w-3" />
                    <span>Active items</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Low Stock</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">{lowStockCount}</p>
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Needs reorder</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Warning Level</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">{warningStockCount}</p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <TrendingDown className="h-3 w-3" />
                    <span>Monitor closely</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Stock</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                    {totalStock.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Warehouse className="h-3 w-3" />
                    <span>All units</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <Warehouse className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="materials" className="space-y-6">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <TabsTrigger value="materials" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
              <Package className="h-4 w-4 mr-2" />
              Materials
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
              <FileBarChart className="h-4 w-4 mr-2" />
              Usage Logs
            </TabsTrigger>
          </TabsList>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
        {/* Filters */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500 h-11"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500 h-11">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Badge className="bg-amber-600 text-white border-0 shadow-sm text-xs">
            {filteredMaterials.length} material{filteredMaterials.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Table View */}
        {viewMode === "table" && (
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Raw Materials Inventory ({filteredMaterials.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="font-sans">
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        Material Name
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        Category
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-green-500 dark:text-green-400" />
                        Stock Qty
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Unit</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Reorder Level</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                        Supplier
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        Last Restocked
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-medium">No materials found</p>
                          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMaterials.map((material, idx) => {
                      const stockStatus = getStockStatus(material)
                      return (
                        <TableRow
                          key={material.id}
                          className={cn(
                            "hover:bg-gradient-to-r hover:from-amber-50/70 hover:to-amber-50/30 dark:hover:from-amber-950/30 dark:hover:to-amber-950/10 transition-all border-b border-slate-200 dark:border-slate-800 group",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                          )}
                        >
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex-shrink-0">
                                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                {material.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Badge variant="outline" className="text-xs font-medium px-2.5 py-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                              {material.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 flex-shrink-0">
                                <Warehouse className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="font-semibold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                                {material.currentStock}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {material.unit}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {material.minStock}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {material.supplier}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {material.lastRestocked ? material.lastRestocked.toLocaleDateString() : "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Badge className={cn("font-semibold text-xs px-3 py-1.5 shadow-sm", stockStatus.color)}>
                              {stockStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(material)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                title="Edit material"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(material)}
                                disabled={isDeleting === material._id}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Delete material"
                              >
                                {isDeleting === material._id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-medium">No materials found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredMaterials.map((material) => {
                const stockStatus = getStockStatus(material)
                const stockPercentage = Math.min(100, (material.currentStock / (material.minStock * 2)) * 100)
                return (
                  <Card
                    key={material.id}
                    className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                  >
                    {/* Card Header */}
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                            <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {material.name}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 w-fit">
                              {material.category}
                            </Badge>
                          </div>
                        </div>
                        <Badge className={cn("font-semibold text-xs px-2.5 py-1 shadow-sm", stockStatus.color)}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4">
                      {/* Stock Information */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Warehouse className="h-4 w-4 text-green-500 dark:text-green-400" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Stock Level</p>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {material.currentStock}
                          </p>
                          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{material.unit}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              stockStatus.label === "Low Stock"
                                ? "bg-red-500"
                                : stockStatus.label === "Warning"
                                ? "bg-amber-500"
                                : "bg-green-500"
                            )}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2 text-xs text-slate-600 dark:text-slate-400">
                          <span>Min: {material.minStock} {material.unit}</span>
                          <span>Reorder: {material.reorderLevel} {material.unit}</span>
                        </div>
                      </div>

                      {/* Supplier & Date */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Supplier</p>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {material.supplier}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Last Restock</p>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {material.lastRestocked ? material.lastRestocked.toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(material)}
                          className="flex-1 border-blue-300 dark:border-blue-700 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        >
                          <Edit className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(material)}
                          disabled={isDeleting === material._id}
                          className="flex-1 border-red-300 dark:border-red-700 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          {isDeleting === material._id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1.5" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
          </TabsContent>

          {/* Usage Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-b border-indigo-200 dark:border-indigo-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30">
                    <FileBarChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Usage History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="font-sans">
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                            Material
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            Batch Used In
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Droplet className="h-4 w-4 text-green-500 dark:text-green-400" />
                            Quantity Used
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                            Remaining Stock
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                            Date
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                            Approved By
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialUsageLogs.slice(0, 50).map((log, idx) => (
                        <TableRow
                          key={log.id}
                          className={cn(
                            "hover:bg-gradient-to-r hover:from-indigo-50/70 hover:to-indigo-50/30 dark:hover:from-indigo-950/30 dark:hover:to-indigo-950/10 transition-all border-b border-slate-200 dark:border-slate-800 group",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                          )}
                        >
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex-shrink-0">
                                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                {log.materialName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                              <span className="font-medium text-sm text-slate-700 dark:text-slate-300">
                                {log.batchNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 flex-shrink-0">
                                <Droplet className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="font-semibold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                                {log.quantityUsed}
                              </span>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{log.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                              <span className="font-medium text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                                {log.remainingStock} {log.unit}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {log.date.toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-rose-500 dark:text-rose-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {log.approvedBy}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-2xl">
            <DialogHeader className="pb-4 border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                  <Edit className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Raw Material</DialogTitle>
              </div>
              {editingMaterial && (
                <p className="text-sm text-muted-foreground mt-1 ml-12">Update material information and stock levels</p>
              )}
            </DialogHeader>
            {editingMaterial && (
              <form onSubmit={handleSaveEdit} className="space-y-6 pt-2">
                {/* Basic Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Material Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="name"
                          defaultValue={editingMaterial.name}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                            Category <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                    onClick={() => {
                      setShowCategoryDialog(true)
                    }}
                            className="border-2 border-blue-300 dark:border-blue-700 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-7 text-xs"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Category
                          </Button>
                        </div>
                        <Select value={editCategory} onValueChange={setEditCategory} required>
                          <SelectTrigger className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {dbCategories.length > 0 ? (
                              dbCategories.map((cat) => (
                                <SelectItem key={cat._id} value={cat.name}>{cat.name}</SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="Base Spirit">Base Spirit</SelectItem>
                                <SelectItem value="Flavoring">Flavoring</SelectItem>
                                <SelectItem value="Base">Base</SelectItem>
                                <SelectItem value="Packaging">Packaging</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                      <Warehouse className="h-4 w-4" />
                      Stock Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Current Stock <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="currentStock"
                          type="number"
                          defaultValue={editingMaterial.currentStock}
                          required
                          min="0"
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Unit <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="unit"
                          defaultValue={editingMaterial.unit}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Min Stock <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="minStock"
                          type="number"
                          defaultValue={editingMaterial.minStock}
                          required
                          min="0"
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                        Reorder Level <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                      </label>
                      <Input
                        name="reorderLevel"
                        type="number"
                        defaultValue={editingMaterial.reorderLevel}
                        required
                        min="0"
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Supplier Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-b border-purple-200 dark:border-purple-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Supplier Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Supplier <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="supplier"
                          defaultValue={editingMaterial.supplier}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Preferred Supplier</label>
                        <Input
                          name="preferredSupplier"
                          defaultValue={editingMaterial.preferredSupplier || editingMaterial.supplier}
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
                        />
                      </div>
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
                      setEditingMaterial(null)
                    }}
                    disabled={isSaving}
                    className="border-2 border-slate-300 dark:border-slate-700 h-11 px-6 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 text-white h-11 px-6 font-semibold"
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

        {/* Category Management Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-2xl">
            <DialogHeader className="pb-4 border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                  <Tag className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Manage Categories</DialogTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-12">Add, edit, or delete material categories</p>
            </DialogHeader>
            
            <div className="space-y-4 pt-2">
              {/* Add/Edit Category Form */}
              <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50 pb-3">
                  <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!newCategoryName.trim()) {
                        toast.error("Please enter a category name")
                        return
                      }

                      setIsSavingCategory(true)
                      try {
                        const url = '/api/jaba/categories'
                        const method = editingCategory ? 'PUT' : 'POST'
                        const body = editingCategory
                          ? { id: editingCategory._id, name: newCategoryName.trim() }
                          : { name: newCategoryName.trim() }

                        const response = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(body),
                        })

                        const data = await response.json()
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to save category')
                        }

                        toast.success(`Category "${newCategoryName}" ${editingCategory ? 'updated' : 'added'} successfully!`)
                        setNewCategoryName("")
                        setEditingCategory(null)
                        await fetchCategories()
                        // If edit dialog is open, refresh categories there too
                        if (showEditDialog && editingMaterial) {
                          // Categories will be refreshed automatically via fetchCategories
                        }
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to save category')
                      } finally {
                        setIsSavingCategory(false)
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter category name"
                      className="flex-1 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                    <Button
                      type="submit"
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      className="bg-blue-600 hover:bg-blue-700 h-11 px-6"
                    >
                      {isSavingCategory ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    {editingCategory && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingCategory(null)
                          setNewCategoryName("")
                        }}
                        className="border-2 h-11 px-4"
                      >
                        Cancel
                      </Button>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Categories List */}
              <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50 pb-3">
                  <CardTitle className="text-base font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    All Categories ({dbCategories.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {dbCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No categories yet. Add your first category above!</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {dbCategories.map((category) => (
                        <div
                          key={category._id}
                          className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{category.name}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(category)
                                setNewCategoryName(category.name)
                              }}
                              className="h-7 w-7 p-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              title="Edit category"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
                                  return
                                }
                                setIsDeletingCategory(category._id)
                                try {
                                  const response = await fetch(`/api/jaba/categories?id=${category._id}`, {
                                    method: 'DELETE',
                                  })
                                  const data = await response.json()
                                  if (!response.ok) {
                                    throw new Error(data.error || 'Failed to delete category')
                                  }
                                  toast.success(`Category "${category.name}" deleted successfully!`)
                                  await fetchCategories()
                                } catch (error: any) {
                                  toast.error(error.message || 'Failed to delete category')
                                } finally {
                                  setIsDeletingCategory(null)
                                }
                              }}
                              disabled={isDeletingCategory === category._id}
                              className="h-7 w-7 p-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                              title="Delete category"
                            >
                              {isDeletingCategory === category._id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
