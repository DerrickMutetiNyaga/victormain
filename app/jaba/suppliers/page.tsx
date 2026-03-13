"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Plus, Search, Package, Building2, Phone, Mail, Users, LayoutGrid, List, History, Calendar, FileText, Trash2, Loader2, Save, X, Download, Tag } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Supplier {
  _id: string
  id: string
  name: string
  category: string
  contactPerson: string
  phone: string
  email?: string
  address?: string
  itemsSupplied: string[]
  type: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

interface SupplyHistoryItem {
  id: string
  itemName: string
  supplier: string
  quantity: number
  unit: string
  date: Date
  type: "Restock" | "Usage"
  batchNumber?: string
  lotNumber?: string
  cost?: number
}

export default function SuppliersPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null })
  const [editFormData, setEditFormData] = useState({
    name: "",
    category: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    itemsSupplied: [] as string[],
  })
  const [newItem, setNewItem] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [supplierHistory, setSupplierHistory] = useState<SupplyHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  useEffect(() => {
    fetchSuppliers()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/jaba/categories')
      const data = await response.json()
      if (response.ok) {
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name")
      return
    }

    setIsSavingCategory(true)
    try {
      const response = await fetch('/api/jaba/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add category')
      }

      toast.success(`Category "${newCategoryName}" added successfully!`)
      setNewCategoryName("")
      setShowAddCategory(false)
      await fetchCategories()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/jaba/suppliers')
      
      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from suppliers API:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }
      
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await responseClone.text()
        console.error('Failed to parse JSON response:', text.substring(0, 200))
        throw new Error('Invalid JSON response from server')
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch suppliers')
      }
      
      setSuppliers(data.suppliers || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error fetching suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [suppliers, searchQuery])

  // Fetch supplier history when selected
  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierHistory(selectedSupplier)
    } else {
      setSupplierHistory([])
    }
  }, [selectedSupplier])

  const fetchSupplierHistory = async (supplierName: string) => {
    try {
      setLoadingHistory(true)
      const response = await fetch(`/api/jaba/supplier-history?supplier=${encodeURIComponent(supplierName)}`)
      const data = await response.json()
      
      if (response.ok) {
        // Convert date strings to Date objects and map to SupplyHistoryItem format
        const history = (data.history || []).map((item: any) => ({
          id: item._id || item.id,
          itemName: item.itemName || 'N/A',
          supplier: item.supplierName || supplierName,
          quantity: item.quantity || 0,
          unit: item.unit || 'N/A',
          date: item.date ? new Date(item.date) : new Date(),
          type: item.type || 'Restock',
          batchNumber: item.batchNumber,
          lotNumber: item.lotNumber,
          cost: item.cost,
        }))
        setSupplierHistory(history)
      } else {
        setSupplierHistory([])
      }
    } catch (error) {
      console.error('Error fetching supplier history:', error)
      setSupplierHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const selectedSupplierHistory = supplierHistory

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setEditCategory(supplier.category)
    setEditFormData({
      name: supplier.name,
      category: supplier.category,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email || "",
      address: supplier.address || "",
      itemsSupplied: supplier.itemsSupplied || [],
    })
    setNewItem("")
    setShowEditDialog(true)
  }

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingSupplier) return

    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const updateData = {
        id: editingSupplier._id,
        name: formData.get('name') as string,
        category: editCategory || (formData.get('category') as string),
        contactPerson: formData.get('contactPerson') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string || "",
        address: formData.get('address') as string || "",
        itemsSupplied: editFormData.itemsSupplied,
      }

      const response = await fetch('/api/jaba/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from suppliers API:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await responseClone.text()
        console.error('Failed to parse JSON response:', text.substring(0, 200))
        throw new Error('Invalid JSON response from server')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update supplier')
      }

      toast.success(`Supplier "${updateData.name}" updated successfully!`)
      setShowEditDialog(false)
      setEditingSupplier(null)
      await fetchSuppliers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update supplier')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (supplier: Supplier) => {
    setDeleteConfirmDialog({ open: true, supplier })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmDialog.supplier) return

    const supplier = deleteConfirmDialog.supplier
    setIsDeleting(supplier._id)
    setDeleteConfirmDialog({ open: false, supplier: null })

    try {
      const response = await fetch(`/api/jaba/suppliers?id=${supplier._id}`, {
        method: 'DELETE',
      })

      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from suppliers API:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await responseClone.text()
        console.error('Failed to parse JSON response:', text.substring(0, 200))
        throw new Error('Invalid JSON response from server')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete supplier')
      }

      toast.success(`Supplier "${supplier.name}" deleted successfully!`)
      await fetchSuppliers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete supplier')
    } finally {
      setIsDeleting(null)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Raw Material":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "Packaging":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "Others":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Suppliers</h1>
            <p className="text-sm text-muted-foreground">Manage external suppliers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
        <Link href="/jaba/suppliers/add">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </Link>
        </div>
      </header>

      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Suppliers</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">{suppliers.length}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Building2 className="h-3 w-3" />
                    <span>External suppliers</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">External Suppliers</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">{suppliers.length}</p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <Package className="h-3 w-3" />
                    <span>External vendors</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50">
                  <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
                    {new Set(suppliers.map(d => d.contactPerson)).size}
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
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
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

        {/* Suppliers List */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              All Suppliers ({filteredSuppliers.length})
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
                              <Building2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              Name
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Category</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-500 dark:text-green-400" />
                              Contact
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                              Items Supplied
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSuppliers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12">
                              <div className="flex flex-col items-center gap-2">
                                <Building2 className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-muted-foreground font-medium">No suppliers found</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSuppliers.map((supplier, idx) => (
                            <TableRow
                              key={supplier.id}
                              className={cn(
                                "hover:bg-gradient-to-r hover:from-blue-50/70 hover:to-blue-50/30 dark:hover:from-blue-950/30 dark:hover:to-blue-950/10 transition-all border-b border-slate-200 dark:border-slate-800 group",
                                idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                              )}
                            >
                              <TableCell className="py-4 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex-shrink-0">
                                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                    {supplier.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <Badge className={cn("font-semibold text-xs px-2.5 py-1", getCategoryColor(supplier.category))}>
                                  {supplier.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <div className="flex items-start gap-2">
                                  <Phone className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{supplier.contactPerson}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{supplier.phone}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <div className="flex flex-col gap-1">
                                  {supplier.itemsSupplied.slice(0, 2).map((item, idx) => (
                                    <span key={idx} className="text-xs font-medium text-slate-700 dark:text-slate-300">{item}</span>
                                  ))}
                                  {supplier.itemsSupplied.length > 2 && (
                                    <span className="text-xs text-slate-500 dark:text-slate-500">
                                      +{supplier.itemsSupplied.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-9 px-3 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    onClick={() => setSelectedSupplier(supplier.name)}
                                  >
                                    <History className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
                                    History
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-9 w-9 p-0 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                    onClick={() => handleEdit(supplier)}
                                  >
                                    <Edit className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => handleDeleteClick(supplier)}
                                    disabled={isDeleting === supplier._id}
                                  >
                                    {isDeleting === supplier._id ? (
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
                    {filteredSuppliers.length === 0 ? (
                      <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Building2 className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground font-medium">No suppliers found</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <Card
                          key={supplier.id}
                          className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                        >
                          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-blue-200 dark:border-blue-900/50 pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1">
                                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    {supplier.name}
                                  </CardTitle>
                                  <Badge className={cn("font-medium text-xs px-2 py-0.5 w-fit", getCategoryColor(supplier.category))}>
                                    {supplier.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 space-y-4">
                            {/* Contact Info */}
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Contact Person</p>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{supplier.contactPerson}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <Phone className="h-3 w-3" />
                                <span>{supplier.phone}</span>
                              </div>
                              {supplier.email && (
                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{supplier.email}</span>
                                </div>
                              )}
                            </div>

                            {/* Items Supplied */}
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2 mb-2">
                                <Package className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Items Supplied</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {supplier.itemsSupplied.slice(0, 3).map((item, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5 border-slate-300 dark:border-slate-700">
                                    {item}
                                  </Badge>
                                ))}
                                {supplier.itemsSupplied.length > 3 && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 border-slate-300 dark:border-slate-700">
                                    +{supplier.itemsSupplied.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex-1 h-9 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                onClick={() => setSelectedSupplier(supplier.name)}
                              >
                                <History className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
                                History
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex-1 h-9 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => handleEdit(supplier)}
                              >
                                <Edit className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" />
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex-1 h-9 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => handleDeleteClick(supplier)}
                                disabled={isDeleting === supplier._id}
                              >
                                {isDeleting === supplier._id ? (
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

        {/* Supply History Modal */}
        <Dialog open={selectedSupplier !== null} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
          <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <div className="flex items-center justify-between">
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 flex-wrap">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                  <History className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="break-words">Supply History - {selectedSupplier}</span>
              </DialogTitle>
                {selectedSupplierHistory.length > 0 && (
                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/jaba/supplier-history/export?supplier=${encodeURIComponent(selectedSupplier!)}`)
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
                          : `supplier_history_${selectedSupplier}_${new Date().toISOString().split('T')[0]}.xlsx`
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
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30"
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
              ) : selectedSupplierHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <History className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-medium">No supply history found for this supplier</p>
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
                              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 dark:text-purple-400" />
                              <span className="hidden sm:inline">Item</span>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">Quantity</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">Type</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-2 sm:px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 dark:text-amber-400" />
                              <span className="hidden sm:inline">Details</span>
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSupplierHistory.map((item, idx) => (
                          <TableRow
                            key={item.id}
                            className={cn(
                              "hover:bg-gradient-to-r transition-all border-b border-slate-200 dark:border-slate-800 group",
                              item.type === "Restock"
                                ? "hover:from-green-50/70 hover:to-green-50/30 dark:hover:from-green-950/30 dark:hover:to-green-950/10"
                                : "hover:from-blue-50/70 hover:to-blue-50/30 dark:hover:from-blue-950/30 dark:hover:to-blue-950/10",
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                            )}
                          >
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                              <div className="flex flex-col min-w-[80px]">
                                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {item.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                  {item.date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                              <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 break-words">
                                {item.itemName}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                  {item.quantity}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                  {item.unit}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                              <Badge className={cn(
                                "font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 flex items-center gap-1 whitespace-nowrap",
                                item.type === "Restock"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              )}>
                                {item.type === "Restock" ? (
                                  <>
                                    <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span className="hidden sm:inline">Restock</span>
                                  </>
                                ) : (
                                  <>
                                    <History className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span className="hidden sm:inline">Usage</span>
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4">
                              <div className="flex flex-col gap-0.5 sm:gap-1 min-w-[100px]">
                                {item.batchNumber && (
                                  <span className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 break-words">
                                    <span className="hidden sm:inline">Batch: </span>
                                    <span className="sm:hidden">B: </span>
                                    {item.batchNumber}
                                  </span>
                                )}
                                {item.lotNumber && (
                                  <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 break-words">
                                    <span className="hidden sm:inline">Lot: </span>
                                    <span className="sm:hidden">L: </span>
                                    {item.lotNumber}
                                  </span>
                                )}
                                {item.cost && (
                                  <span className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    ${item.cost.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
            <DialogHeader className="pb-4 border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Edit className="h-5 w-5 text-white" />
      </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Supplier</DialogTitle>
              </div>
              {editingSupplier && (
                <p className="text-sm text-muted-foreground mt-1 ml-12">Update supplier information</p>
              )}
            </DialogHeader>
            {editingSupplier && (
              <form onSubmit={handleSaveEdit} className="space-y-6 pt-2">
                {/* Basic Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Supplier Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Input
                          name="name"
                          defaultValue={editFormData.name}
                          required
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Category <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                        </label>
                        <Select value={editCategory} onValueChange={setEditCategory} required>
                          <SelectTrigger className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 h-11">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Raw/Packaging Materials">Raw/Packaging Materials</SelectItem>
                            <SelectItem value="Raw Material">Raw Material</SelectItem>
                            <SelectItem value="Packaging">Packaging</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
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
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
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
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Email</label>
                        <Input
                          name="email"
                          type="email"
                          defaultValue={editFormData.email}
                          className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Address</label>
                      <Textarea
                        name="address"
                        defaultValue={editFormData.address}
                        className="border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Items Supplied Card */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-b border-purple-200 dark:border-purple-900/50 pb-3">
                    <CardTitle className="text-base font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Items Supplied
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Enter item name"
                        className="flex-1 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (newItem.trim() && !editFormData.itemsSupplied.includes(newItem.trim())) {
                              setEditFormData({
                                ...editFormData,
                                itemsSupplied: [...editFormData.itemsSupplied, newItem.trim()],
                              })
                              setNewItem("")
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (newItem.trim() && !editFormData.itemsSupplied.includes(newItem.trim())) {
                            setEditFormData({
                              ...editFormData,
                              itemsSupplied: [...editFormData.itemsSupplied, newItem.trim()],
                            })
                            setNewItem("")
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-700 h-11 px-4"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {editFormData.itemsSupplied.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editFormData.itemsSupplied.map((item, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="px-3 py-1.5 border-slate-300 dark:border-slate-700 flex items-center gap-2"
                          >
                            {item}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditFormData({
                                  ...editFormData,
                                  itemsSupplied: editFormData.itemsSupplied.filter((_, i) => i !== index),
                                })
                              }}
                              className="h-5 w-5 p-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false)
                      setEditingSupplier(null)
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, supplier: null })}>
          <DialogContent className="max-w-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-2 border-red-300 dark:border-red-700 shadow-2xl">
            <DialogHeader className="pb-4 border-b-2 border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 -m-6 mb-4 p-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 shadow-lg">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100">Delete Supplier</DialogTitle>
              </div>
            </DialogHeader>
            {deleteConfirmDialog.supplier && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{deleteConfirmDialog.supplier.name}"</span>?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  This action cannot be undone. All supplier information will be permanently deleted.
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteConfirmDialog({ open: false, supplier: null })}
                    disabled={isDeleting === deleteConfirmDialog.supplier._id}
                    className="border-2 border-slate-300 dark:border-slate-700 h-11 px-6 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting === deleteConfirmDialog.supplier._id}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30 text-white h-11 px-6 font-semibold"
                  >
                    {isDeleting === deleteConfirmDialog.supplier._id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Supplier
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Tag className="h-5 w-5" style={{ color: '#00a35c' }} />
                Add Category
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newCategoryName" className="text-sm font-medium">
                  Category Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newCategoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className="h-10"
                  onFocus={(e) => e.currentTarget.style.borderColor = '#00a35c'}
                  onBlur={(e) => e.currentTarget.style.borderColor = ''}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCategory()
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddCategory(false)
                    setNewCategoryName("")
                  }}
                  disabled={isSavingCategory}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={isSavingCategory}
                  style={{ backgroundColor: '#00a35c' }}
                >
                  {isSavingCategory ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
