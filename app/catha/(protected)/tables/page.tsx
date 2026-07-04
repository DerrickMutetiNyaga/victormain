"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Grid3X3, Loader2, Users, Clock, CheckCircle2, XCircle, AlertCircle, MapPin, Wine, Sparkles, Star, Upload, X, Layout, List } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { LayoutDesigner } from "@/components/bar/layout-designer"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

interface TableData {
  id: number
  name?: string
  status: 'available' | 'occupied' | 'reserved'
  guests?: number
  waiter?: string | null
  orderTotal?: number
  capacity?: number
  location?: string
  imageUrl?: string
  shape?: 'circle' | 'square' | 'rectangle' | 'oval' | 'hexagon' | 'octagon'
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
}

export default function TablesPage() {
  const { canAdd, canEdit, canDelete } = useCathaPermissions("tables")
  const [tables, setTables] = useState<TableData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<TableData | null>(null)
  const [deleteTableId, setDeleteTableId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'layout'>('list')
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    status: 'available' as 'available' | 'occupied' | 'reserved',
    capacity: 4,
    location: '',
    imageUrl: '',
    shape: 'circle' as 'circle' | 'square' | 'rectangle' | 'oval' | 'hexagon' | 'octagon',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch tables from API
  const fetchTables = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/catha/tables')
      const data = await response.json()
      
      if (data.success) {
        // Initialize tables with default layout properties if missing
        const tablesWithLayout = (data.tables || []).map((table: any) => ({
          ...table,
          shape: table.shape || 'circle',
          position: table.position || null,
          size: table.size || { width: 80, height: 80 },
          rotation: table.rotation || 0,
        }))
        setTables(tablesWithLayout)
      } else {
        toast.error('Failed to load tables')
      }
    } catch (error) {
      console.error('Error fetching tables:', error)
      toast.error('Failed to load tables')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTables()
  }, [])

  const handleOpenDialog = (table?: TableData) => {
    if (table) {
      setEditingTable(table)
      setFormData({
        id: table.id,
        name: table.name || `Table ${table.id}`,
        status: table.status,
        capacity: table.capacity || 4,
        location: table.location || '',
        imageUrl: table.imageUrl || '',
        shape: table.shape || 'circle',
      })
    } else {
      setEditingTable(null)
      // Get next available table number
      const maxId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) : 0
      setFormData({
        id: maxId + 1,
        name: `Table ${maxId + 1}`,
        status: 'available',
        capacity: 4,
        location: '',
        imageUrl: '',
        shape: 'circle',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingTable(null)
    setFormData({
      id: 0,
      name: '',
      status: 'available',
      capacity: 4,
      location: '',
      imageUrl: '',
      shape: 'circle',
    })
    setImageFile(null)
    setImagePreview('')
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type', {
          description: 'Please upload a JPEG, PNG, WebP, or GIF image.',
        })
        return
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        toast.error('File too large', {
          description: 'Maximum file size is 5MB.',
        })
        return
      }

      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    setFormData({ ...formData, imageUrl: '' })
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.imageUrl || null

    try {
      setIsUploading(true)
      const uploadFormData = new FormData()
      uploadFormData.append('file', imageFile)

      const response = await fetch('/api/catha/upload-image', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload image')
      }

      const data = await response.json()
      return data.url
    } catch (error: any) {
      console.error('Image upload error:', error)
      toast.error('Image upload failed', {
        description: error.message || 'Failed to upload image. Please try again.',
      })
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      // Upload image first if there's a new image file
      let imageUrl = formData.imageUrl
      if (imageFile) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        } else {
          // If upload failed, don't proceed
          return
        }
      }

      if (editingTable) {
        // Update existing table
        const response = await fetch('/api/catha/tables', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            id: formData.id,
            name: formData.name,
            status: formData.status,
            capacity: formData.capacity,
            location: formData.location || null,
            imageUrl: imageUrl || null,
            shape: formData.shape,
          }),
        })

        const data = await response.json()
        if (data.success) {
          toast.success('Table updated successfully')
          fetchTables()
          handleCloseDialog()
        } else {
          toast.error(data.error || 'Failed to update table')
        }
      } else {
        // Create new table
        const response = await fetch('/api/catha/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            id: formData.id,
            name: formData.name,
            status: formData.status,
            capacity: formData.capacity,
            location: formData.location || null,
            imageUrl: imageUrl || null,
            shape: formData.shape,
          }),
        })

        const data = await response.json()
        if (data.success) {
          toast.success('Table created successfully')
          fetchTables()
          handleCloseDialog()
        } else {
          toast.error(data.error || 'Failed to create table')
        }
      }
    } catch (error) {
      console.error('Error saving table:', error)
      toast.error('Failed to save table')
    }
  }

  const handleDelete = (tableId: number) => {
    setDeleteTableId(tableId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTableId) return

    try {
      const response = await fetch(`/api/catha/tables?id=${deleteTableId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Table deleted successfully')
        fetchTables()
      } else {
        toast.error(data.error || 'Failed to delete table')
      }
    } catch (error) {
      console.error('Error deleting table:', error)
      toast.error('Failed to delete table')
    } finally {
      setIsDeleteDialogOpen(false)
      setDeleteTableId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-[#FFF8E7] text-[#9DC183] border-[#9DC183]'
      case 'occupied':
        return 'bg-[#FF6B6B] text-white border-[#F44336]'
      case 'reserved':
        return 'bg-[#FFA94D] text-white border-[#FF9800]'
      default:
        return 'bg-[#D3D3D3] text-[#B0B0B0] border-[#9E9E9E]'
    }
  }

  const availableCount = tables.filter(t => t.status === 'available').length
  const occupiedCount = tables.filter(t => t.status === 'occupied').length
  const reservedCount = tables.filter(t => t.status === 'reserved').length

  return (
    <>
      <Header title="Table Management" subtitle="Create and manage your shop tables" />
      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-amber-50/30 to-stone-50 min-h-screen">
        {/* Stats Cards - Liquor Shop Premium Design */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2 border-stone-300 bg-gradient-to-br from-stone-50 to-amber-50/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-stone-700">Total Tables</CardTitle>
                <Grid3X3 className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-700">{tables.length}</div>
              <p className="text-xs text-stone-600 mt-1 font-medium">Active tables</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg hover:shadow-xl hover:shadow-emerald-200/50 transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-emerald-700">Available</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-700">{availableCount}</div>
              <p className="text-xs text-emerald-600 mt-1 font-medium">Ready for customers</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-red-400 bg-gradient-to-br from-red-50 to-rose-50 shadow-lg hover:shadow-xl hover:shadow-red-200/50 transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-red-700">Occupied</CardTitle>
                <Users className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-red-700">{occupiedCount}</div>
              <p className="text-xs text-red-600 mt-1 font-medium">Currently in use</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg hover:shadow-xl hover:shadow-amber-200/50 transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-amber-700">Reserved</CardTitle>
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-700">{reservedCount}</div>
              <p className="text-xs text-amber-600 mt-1 font-medium">Booked ahead</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-50/50 via-stone-50 to-amber-50/50 rounded-2xl p-6 border-2 border-amber-200/50 shadow-lg">
          <div>
            <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-700 via-amber-600 to-stone-700 bg-clip-text text-transparent">
              Tables
            </h2>
            <p className="text-stone-600 font-medium mt-1">Create and manage your shop tables</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border-2 border-amber-200">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(
                  viewMode === 'list' && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === 'layout' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('layout')}
                className={cn(
                  viewMode === 'layout' && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                <Layout className="h-4 w-4 mr-2" />
                Layout
              </Button>
            </div>
            {canAdd && (
              <Button 
                onClick={() => handleOpenDialog()} 
                className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 font-semibold"
                size="lg"
              >
                <Plus className="h-5 w-5" />
                Add Table
              </Button>
            )}
          </div>
        </div>

        {/* Tables Grid - Liquor Shop Premium Design */}
        <Card className="border-2 border-amber-200/50 bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-amber-50/50 via-stone-50 to-amber-50/50 border-b-2 border-amber-200/50">
            <CardTitle className="text-2xl font-black bg-gradient-to-r from-amber-700 via-amber-600 to-stone-700 bg-clip-text text-transparent">
              {viewMode === 'layout' ? 'Bar Layout Designer' : 'Table Layout'}
            </CardTitle>
            <CardDescription className="text-base font-medium text-stone-600">
              {viewMode === 'layout' ? 'Design your bar layout visually' : 'Visual overview of all your shop tables'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {viewMode === 'layout' ? (
              <LayoutDesigner 
                tables={tables} 
                onTablesUpdate={(updatedTables) => {
                  // Just update local state, don't fetch from DB (positions aren't saved yet)
                  setTables(updatedTables)
                }} 
              />
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-amber-600" />
                  <p className="text-stone-600 font-medium">Loading tables...</p>
                </div>
              </div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-gradient-to-br from-amber-50 to-stone-50 rounded-2xl border-2 border-dashed border-amber-300">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500 blur-3xl opacity-20 rounded-full"></div>
                  <Grid3X3 className="h-16 w-16 text-amber-500 relative" />
                </div>
                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-700 to-stone-700 bg-clip-text text-transparent">
                  No tables yet
                </h3>
                <p className="text-stone-600 mb-6 max-w-md">
                  Create your first table to start managing your shop seating
                </p>
                {canAdd && (
                  <Button 
                    onClick={() => handleOpenDialog()}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create First Table
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Visual Grid View - Modern Kitchen Design */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className={cn(
                        "relative group rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer overflow-hidden",
                        "flex flex-col items-center justify-between p-5 min-h-[200px]",
                        "shadow-[0_4px_10px_rgba(0,0,0,0.08)]",
                        table.status === "available" &&
                          "bg-gradient-to-br from-[#FFF8E7] via-[#FEF9E7] to-[#FFF8E7] border-2 border-emerald-400/50",
                        table.status === "occupied" &&
                          "bg-gradient-to-br from-red-50 via-rose-50 to-red-50 border-2 border-red-400",
                        table.status === "reserved" &&
                          "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-400",
                      )}
                      onClick={() => handleOpenDialog(table)}
                    >
                      {/* Decorative Background Pattern - Liquor Shop Style */}
                      <div className="absolute inset-0 opacity-5">
                        <div className={cn(
                          "absolute top-0 left-0 w-16 h-16 rounded-full blur-xl",
                          table.status === "available" && "bg-emerald-400",
                          table.status === "occupied" && "bg-red-400",
                          table.status === "reserved" && "bg-amber-400",
                        )}></div>
                        <div className={cn(
                          "absolute bottom-0 right-0 w-20 h-20 rounded-full blur-2xl",
                          table.status === "available" && "bg-emerald-300",
                          table.status === "occupied" && "bg-red-300",
                          table.status === "reserved" && "bg-amber-300",
                        )}></div>
                      </div>

                      {/* Top Icons - Premium Accents */}
                      <div className="absolute top-3 left-3 z-10">
                        <Sparkles className={cn(
                          "h-4 w-4",
                          table.status === "available" && "text-emerald-500",
                          table.status === "occupied" && "text-red-500",
                          table.status === "reserved" && "text-amber-500",
                        )} />
                      </div>
                      <div className="absolute top-3 right-3 z-10">
                        <Star className={cn(
                          "h-3.5 w-3.5",
                          table.status === "available" && "text-amber-400",
                          table.status === "occupied" && "text-red-400",
                          table.status === "reserved" && "text-amber-500",
                        )} />
                      </div>

                      {/* Table Icon - Large Center */}
                      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full">
                        <div className="relative mb-4">
                          {/* Table Illustration */}
                          <div className="relative">
                            <div className={cn(
                              "w-24 h-24 rounded-full border-4 flex items-center justify-center shadow-lg bg-white/95 overflow-hidden relative",
                              table.status === "available" && "border-emerald-400",
                              table.status === "occupied" && "border-red-400",
                              table.status === "reserved" && "border-amber-400",
                            )}>
                              {/* Table Image */}
                              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                                <Image
                                  src={table.imageUrl || '/placeholder.jpg'}
                                  alt={`Table ${table.id}`}
                                  width={80}
                                  height={80}
                                  className="object-cover rounded-full"
                                  unoptimized
                                />
                              </div>
                            </div>
                            {/* Table Number Badge - Prominent Circle */}
                            <div className={cn(
                              "absolute -top-2 -right-2 w-14 h-14 rounded-full border-4 flex items-center justify-center font-black text-xl shadow-xl",
                              table.status === "available" && "bg-amber-500 border-amber-600 text-white",
                              table.status === "occupied" && "bg-red-500 border-red-600 text-white",
                              table.status === "reserved" && "bg-amber-600 border-amber-700 text-white",
                            )}>
                              {table.id}
                            </div>
                          </div>
                        </div>
                        
                        {/* Table Name */}
                        <div className={cn(
                          "text-sm font-black mb-3 text-center line-clamp-1 px-3 py-1.5 rounded-lg w-full bg-white/90",
                          table.status === "available" && "text-amber-700 border border-amber-300/50",
                          table.status === "occupied" && "text-red-700 border border-red-300/50",
                          table.status === "reserved" && "text-amber-700 border border-amber-300/50",
                        )}>
                          {table.name || `Table ${table.id}`}
                        </div>
                      </div>

                      {/* Bottom Info Bar */}
                      <div className="relative z-10 w-full mt-auto space-y-2">
                        {/* Status Indicator - Pill Shape */}
                        <div className={cn(
                          "flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase shadow-md bg-white/95",
                          table.status === "available" && "text-emerald-700 border-2 border-emerald-400",
                          table.status === "occupied" && "text-red-700 border-2 border-red-400",
                          table.status === "reserved" && "text-amber-700 border-2 border-amber-400",
                        )}>
                          {table.status === "available" && <CheckCircle2 className="h-4 w-4" />}
                          {table.status === "occupied" && <Users className="h-4 w-4" />}
                          {table.status === "reserved" && <Clock className="h-4 w-4" />}
                          <span>{table.status}</span>
                        </div>

                        {/* Capacity & Location Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-white/90",
                            table.status === "available" && "text-amber-700",
                            table.status === "occupied" && "text-red-700",
                            table.status === "reserved" && "text-amber-700",
                          )}>
                            <Users className="h-3.5 w-3.5" />
                            <span>{table.guests || 0}/{table.capacity || 4}</span>
                          </div>
                          
                          {table.location && (
                            <div className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-white/90",
                              table.status === "available" && "text-amber-700",
                              table.status === "occupied" && "text-red-700",
                              table.status === "reserved" && "text-amber-700",
                            )}>
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[60px]">{table.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons on Hover */}
                      {(canEdit || canDelete) && (
                        <div className="absolute inset-0 bg-black/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20 backdrop-blur-sm">
                          {canEdit && (
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenDialog(table)
                              }}
                              className="h-11 w-11 bg-white hover:bg-amber-50 shadow-xl border-2 border-amber-400"
                            >
                              <Edit2 className="h-5 w-5 text-amber-600" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(table.id)
                              }}
                              className="h-11 w-11 shadow-xl border-2 border-red-400 bg-red-500 hover:bg-red-600"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Detailed Table View */}
                <div className="mt-8 border-t-2 border-amber-200/50 pt-6">
                  <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-amber-700 to-stone-700 bg-clip-text text-transparent">
                    Table Details
                  </h3>
                  <div className="rounded-xl border-2 border-amber-200/50 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gradient-to-r from-amber-50 to-stone-50">
                        <TableRow>
                          <TableHead className="font-bold text-amber-700">Table #</TableHead>
                          <TableHead className="font-bold text-amber-700">Name</TableHead>
                          <TableHead className="font-bold text-amber-700">Status</TableHead>
                          <TableHead className="font-bold text-amber-700">Capacity</TableHead>
                          <TableHead className="font-bold text-amber-700">Location</TableHead>
                          <TableHead className="font-bold text-amber-700">Guests</TableHead>
                          <TableHead className="font-bold text-amber-700">Waiter</TableHead>
                          <TableHead className="text-right font-bold text-amber-700">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tables.map((table) => (
                          <TableRow 
                            key={table.id}
                            className="hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-stone-50/50 transition-colors"
                          >
                            <TableCell className="font-bold text-lg">{table.id}</TableCell>
                            <TableCell className="font-semibold">{table.name || `Table ${table.id}`}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "border-2 font-bold",
                                  getStatusColor(table.status)
                                )}
                              >
                                {table.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">{table.capacity || 4}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {table.location ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                                  {table.location}
                                </Badge>
                              ) : (
                                <span className="text-stone-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-stone-700">{table.guests || 0}</span>
                            </TableCell>
                            <TableCell>
                              {table.waiter ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                  {table.waiter}
                                </Badge>
                              ) : (
                                <span className="text-stone-500">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDialog(table)}
                                    className="h-9 w-9 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(table.id)}
                                    className="h-9 w-9 hover:bg-red-100 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50/30">
          <DialogHeader className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-rose-500/10 -m-6 mb-4 p-6 rounded-t-lg border-b-2 border-orange-200/50">
            <DialogTitle className="text-2xl font-black bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 bg-clip-text text-transparent">
              {editingTable ? 'Edit Table' : 'Create New Table'}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-muted-foreground">
              {editingTable ? 'Update table information' : 'Add a new table to your restaurant'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="id" className="text-sm font-bold text-orange-700 flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Table Number
              </Label>
              <Input
                id="id"
                type="number"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value) || 0 })}
                disabled={!!editingTable}
                min={1}
                className="border-2 border-orange-200 focus:border-orange-500 focus:ring-orange-500/20 bg-white font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold text-amber-700 flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Table Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Table 1"
                className="border-2 border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'available' | 'occupied' | 'reserved') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="border-2 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-emerald-200">
                  <SelectItem value="available" className="focus:bg-emerald-50 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Available
                    </span>
                  </SelectItem>
                  <SelectItem value="occupied" className="focus:bg-rose-50 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Occupied
                    </span>
                  </SelectItem>
                  <SelectItem value="reserved" className="focus:bg-amber-50 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Reserved
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity" className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Capacity
              </Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 4 })}
                min={1}
                max={20}
                className="border-2 border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-bold text-amber-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Location (Optional)
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Main Hall, Patio, VIP"
                className="border-2 border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shape" className="text-sm font-bold text-purple-700 flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Table Shape
              </Label>
              <Select
                value={formData.shape}
                onValueChange={(value: 'circle' | 'square' | 'rectangle' | 'oval' | 'hexagon' | 'octagon') =>
                  setFormData({ ...formData, shape: value })
                }
              >
                <SelectTrigger className="border-2 border-purple-200 focus:border-purple-500 focus:ring-purple-500/20 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-purple-200">
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="rectangle">Rectangle</SelectItem>
                  <SelectItem value="oval">Oval</SelectItem>
                  <SelectItem value="hexagon">Hexagon</SelectItem>
                  <SelectItem value="octagon">Octagon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image" className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Table Image (Optional)
              </Label>
              <div className="space-y-3">
                {(imagePreview || formData.imageUrl) && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-amber-200">
                    <Image
                      src={imagePreview || formData.imageUrl || '/placeholder.jpg'}
                      alt="Table preview"
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={removeImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="border-2 border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 bg-white cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                    disabled={isUploading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a table image (JPEG, PNG, WebP, or GIF, max 5MB)
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t-2 border-orange-200/50">
            <Button 
              variant="outline" 
              onClick={handleCloseDialog}
              className="border-2 border-gray-300 hover:bg-gray-50 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                editingTable ? 'Update Table' : 'Create Table'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-2 border-red-200 bg-gradient-to-br from-white to-red-50/30">
          <AlertDialogHeader className="bg-gradient-to-r from-red-600/10 to-rose-600/10 -m-6 mb-4 p-6 rounded-t-lg border-b-2 border-red-200/50">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-2xl font-black text-red-700">
                  Are you sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium text-muted-foreground mt-1">
                  This action cannot be undone. This will permanently delete table <span className="font-bold text-red-600">{deleteTableId}</span> and all associated data.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4 border-t-2 border-red-200/50">
            <AlertDialogCancel className="border-2 border-gray-300 hover:bg-gray-50 font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

