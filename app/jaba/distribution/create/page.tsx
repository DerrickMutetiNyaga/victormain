"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { FileText, Save, Plus, X, Package, Hash, Truck, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  listFlavorSizePickupGroups,
  deriveFifoDeliveryNotePayload,
  collapseNoteItemsToStaffLines,
  staffFieldsToPickupGroupKey,
  type FlavorSizePickupRow,
} from "@/lib/jaba-delivery-note-fifo-allocation"

interface SelectedItem {
  id: string
  groupKey: string
  productName: string
  flavor: string
  productType: string
  size: "250ml" | "500ml" | "1L" | "2L"
  flavourLineId?: string
  /** Informational — server recomputes availability at save */
  availableBottles: number
  quantity: number
  pricePerUnit: number
}

function CreateDeliveryNotePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [distributorId, setDistributorId] = useState("")
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [vehicle, setVehicle] = useState("")
  const [driver, setDriver] = useState("")
  const [driverPhone, setDriverPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  /** All batches from API — required for correct FIFO ordering vs packaging outputs */
  const [allBatches, setAllBatches] = useState<any[]>([])
  const [packagingOutputs, setPackagingOutputs] = useState<any[]>([])
  /** Up to two batch document IDs to narrow the product list (optional). */
  const [batchFilter1, setBatchFilter1] = useState("")
  const [batchFilter2, setBatchFilter2] = useState("")
  const [deliveryNoteId, setDeliveryNoteId] = useState<string>("")
  const [loadingNoteId, setLoadingNoteId] = useState(true)
  const [distributors, setDistributors] = useState<any[]>([])
  const [loadingDistributors, setLoadingDistributors] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [loadingEditData, setLoadingEditData] = useState(false)
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])

  // Check for edit mode
  useEffect(() => {
    const editParam = searchParams.get('edit')
    if (editParam) {
      setIsEditMode(true)
      setEditingNoteId(editParam)
    }
  }, [searchParams])

  // Fetch delivery note data for editing
  useEffect(() => {
    const fetchEditData = async () => {
      if (!isEditMode || !editingNoteId) return

      try {
        setLoadingEditData(true)
        const response = await fetch('/api/jaba/delivery-notes')
        const data = await response.json()
        
        if (response.ok && data.deliveryNotes) {
          const noteToEdit = data.deliveryNotes.find((note: any) => 
            (note._id === editingNoteId || note.id === editingNoteId)
          )
          
          if (noteToEdit) {
            // Set delivery note ID (read-only in edit mode)
            setDeliveryNoteId(noteToEdit.noteId)
            
            // Set distributor
            setDistributorId(noteToEdit.distributorId)
            
            // Set vehicle, driver, phone, notes
            setVehicle(noteToEdit.vehicle || '')
            setDriver(noteToEdit.driver || '')
            setDriverPhone(noteToEdit.driverPhone || '')
            setNotes(noteToEdit.notes || '')
            
            // Map items to selectedItems format
            const collapsed = collapseNoteItemsToStaffLines(noteToEdit.items || [])
            const mappedItems: SelectedItem[] = collapsed.map((row, index: number) => {
              const displayName =
                row.productName ||
                (row.productType && row.flavor ? `${row.productType} of ${row.flavor}` : row.flavor || "Product")
              const gk = staffFieldsToPickupGroupKey({
                flavor: row.flavor || "",
                flavourLineId: row.flavourLineId,
                size: row.size,
              })
              return {
                id: `edit-${index}-${gk}`,
                groupKey: gk,
                productName: displayName,
                flavor: row.flavor || "",
                productType: row.productType || "Juice",
                size: row.size as SelectedItem["size"],
                flavourLineId: row.flavourLineId,
                availableBottles: 0,
                quantity: row.quantity,
                pricePerUnit: row.pricePerUnit || 0,
              }
            })
            
            setSelectedItems(mappedItems)
            toast.success('Delivery note data loaded for editing')
          } else {
            toast.error('Delivery note not found')
            router.push('/jaba/distribution')
          }
        } else {
          toast.error('Failed to load delivery note data')
        }
      } catch (error) {
        console.error('Error fetching edit data:', error)
        toast.error('Failed to load delivery note data')
      } finally {
        setLoadingEditData(false)
      }
    }

    fetchEditData()
  }, [isEditMode, editingNoteId, router])

  // Fetch next sequential delivery note ID from API (only if not in edit mode)
  useEffect(() => {
    if (isEditMode) return // Skip fetching new ID in edit mode

    const fetchNextId = async () => {
      try {
        setLoadingNoteId(true)
        // Use cache: 'no-store' to always get the latest next ID
        const response = await fetch('/api/jaba/delivery-notes/next-id', {
          cache: 'no-store',
        })
        const data = await response.json()
        
        if (response.ok && data.success && data.nextId) {
          console.log('[Distribution] Next delivery note ID:', data.nextId)
          setDeliveryNoteId(data.nextId)
        } else {
          console.warn('[Distribution] API response invalid, using DN-001')
          // Fallback to DN-001 if API fails
          setDeliveryNoteId('DN-001')
        }
      } catch (error) {
        console.error('Error fetching next delivery note ID:', error)
        // Fallback to DN-001 if API fails
        setDeliveryNoteId('DN-001')
      } finally {
        setLoadingNoteId(false)
      }
    }

    fetchNextId()
  }, [isEditMode])

  // Fetch distributors from API
  useEffect(() => {
    const fetchDistributors = async () => {
      try {
        setLoadingDistributors(true)
        const response = await fetch('/api/jaba/distributors')
        const data = await response.json()
        
        if (response.ok && data.distributors) {
          setDistributors(data.distributors)
        } else {
          toast.error('Failed to load distributors')
        }
      } catch (error) {
        console.error('Error fetching distributors:', error)
        toast.error('Failed to load distributors')
      } finally {
        setLoadingDistributors(false)
      }
    }

    fetchDistributors()
  }, [])

  const selectedDistributor = distributors.find((d) => (d._id || d.id) === distributorId)

  const focusedBatchIds = useMemo(() => {
    const a = batchFilter1.trim()
    const b = batchFilter2.trim()
    const out: string[] = []
    if (a) out.push(a)
    if (b && b !== a) out.push(b)
    return out
  }, [batchFilter1, batchFilter2])

  const isBatchFilterActive = focusedBatchIds.length > 0

  const batchId = (b: any) => String(b._id ?? b.id ?? "")

  const batchesForDropdown = useMemo(() => {
    return allBatches.filter((b: any) =>
      ["Ready for Distribution", "Partially Packaged", "Partially Allocated", "Fully Allocated"].includes(b.status) &&
      ((b.bottles250ml || 0) + (b.bottles500ml || 0) + (b.bottles1L || 0) + (b.bottles2L || 0) > 0)
    )
  }, [allBatches])

  const flavorSizeGroups = useMemo(() => {
    const allowed =
      focusedBatchIds.length > 0 ? new Set(focusedBatchIds.map((id) => String(id))) : null
    return listFlavorSizePickupGroups(packagingOutputs, allBatches, deliveryNotes, {
      excludeNoteId: isEditMode && editingNoteId ? editingNoteId : null,
      allowedBatchIds: allowed,
    })
  }, [packagingOutputs, allBatches, deliveryNotes, isEditMode, editingNoteId, focusedBatchIds])

  const selectedItemsWithFreshAvail = useMemo(() => {
    return selectedItems.map((item) => {
      const row = flavorSizeGroups.find((g) => g.groupKey === item.groupKey)
      const avail = row?.availableBottles ?? item.availableBottles
      return { ...item, availableBottles: avail }
    })
  }, [selectedItems, flavorSizeGroups])

  const fifoPreview = useMemo(() => {
    const lines = selectedItemsWithFreshAvail
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        flavor: i.flavor,
        productType: i.productType,
        productName: i.productName,
        size: i.size,
        flavourLineId: i.flavourLineId,
        quantity: i.quantity,
        pricePerUnit: i.pricePerUnit,
      }))
    if (lines.length === 0 || !packagingOutputs.length || !allBatches.length) return null
    try {
      return deriveFifoDeliveryNotePayload({
        staffLines: lines,
        packagingOutputs,
        batches: allBatches,
        deliveryNotes,
        excludeNoteId: isEditMode && editingNoteId ? editingNoteId : null,
      })
    } catch {
      return null
    }
  }, [selectedItemsWithFreshAvail, packagingOutputs, allBatches, deliveryNotes, isEditMode, editingNoteId])

  const previewItemsByBatch = useMemo(() => {
    if (!fifoPreview?.items?.length) return new Map<string, typeof fifoPreview.items>()
    const map = new Map<string, typeof fifoPreview.items>()
    for (const row of fifoPreview.items) {
      const k = row.batchNumber || "Unknown"
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(row)
    }
    return map
  }, [fifoPreview])

  const focusedBatchLabels = useMemo(
    () =>
      focusedBatchIds
        .map((id) => allBatches.find((b) => batchId(b) === id))
        .filter(Boolean)
        .map((b: any) => String(b.batchNumber)),
    [focusedBatchIds, allBatches]
  )

  // Fetch batches and packaging outputs; optional ?batch= pre-fills first filter
  useEffect(() => {
    const batchParam = searchParams.get("batch")
    if (batchParam) {
      setBatchFilter1(batchParam)
    }
    fetchData()
  }, [searchParams])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch batches that are ready for distribution
      const batchesResponse = await fetch('/api/jaba/batches')
      const batchesData = await batchesResponse.json()
      
      if (batchesResponse.ok && batchesData.batches) {
        setAllBatches(batchesData.batches)
      }

      // Fetch all packaging outputs
      const packagingResponse = await fetch('/api/jaba/packaging-output')
      const packagingData = await packagingResponse.json()
      
      if (packagingResponse.ok && packagingData.packagingOutputs) {
        // Log package numbers for debugging
        console.log('[Distribution] Fetched packaging outputs:', packagingData.packagingOutputs.length)
        packagingData.packagingOutputs.forEach((po: any) => {
          console.log(`[Distribution] Packaging Output - Batch: ${po.batchNumber}, Package: ${po.packageNumber || 'MISSING'}`)
        })
        setPackagingOutputs(packagingData.packagingOutputs)
      }

      // CRITICAL: Fetch delivery notes to calculate already distributed quantities
      const deliveryNotesResponse = await fetch('/api/jaba/delivery-notes')
      const deliveryNotesData = await deliveryNotesResponse.json()
      
      if (deliveryNotesResponse.ok && deliveryNotesData.deliveryNotes) {
        console.log('[Distribution] Fetched delivery notes:', deliveryNotesData.deliveryNotes.length)
        setDeliveryNotes(deliveryNotesData.deliveryNotes)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load distribution data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (flavorSizeGroups.length === 0) return
    setExpandedBatches(new Set(flavorSizeGroups.map((g) => g.groupKey)))
  }, [flavorSizeGroups])

  const toggleFlavorGroup = (groupKey: string) => {
    const next = new Set(expandedBatches)
    if (next.has(groupKey)) next.delete(groupKey)
    else next.add(groupKey)
    setExpandedBatches(next)
  }

  const addFlavorLine = (row: FlavorSizePickupRow) => {
    if (selectedItems.some((item) => item.groupKey === row.groupKey)) return
    const productName = `${row.productType} of ${row.displayFlavor}`
    const newItem: SelectedItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      groupKey: row.groupKey,
      productName,
      flavor: row.displayFlavor,
      productType: row.productType,
      size: row.size as SelectedItem["size"],
      flavourLineId: row.flavourLineId,
      availableBottles: row.availableBottles,
      quantity: 0,
      pricePerUnit: 0,
    }
    setSelectedItems([...selectedItems, newItem])
  }

  const removeSelectedItem = (id: string) => {
    setSelectedItems(selectedItems.filter((item) => item.id !== id))
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id !== id) return item
        const cap =
          flavorSizeGroups.find((g) => g.groupKey === item.groupKey)?.availableBottles ??
          item.availableBottles
        return { ...item, quantity: Math.min(Math.max(0, quantity), cap) }
      })
    )
  }

  const updateItemPricePerUnit = (id: string, pricePerUnit: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.id === id
          ? { ...item, pricePerUnit: Math.max(0, pricePerUnit) }
          : item
      )
    )
  }

  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalCost = selectedItems.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0)

  // Check if a product is already selected
  const isGroupSelected = (groupKey: string) => selectedItems.some((item) => item.groupKey === groupKey)

  // Handle generating delivery note
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateNote = async () => {
    if (!distributorId || selectedItems.length === 0 || totalQuantity === 0) {
      toast.error("Please select a distributor and add items with quantities")
      return
    }

    if (!deliveryNoteId || deliveryNoteId.trim() === '') {
      toast.error("Delivery note ID is missing. Please refresh the page.")
      return
    }

    setIsGenerating(true)
    try {
      const itemsWithQuantities = selectedItemsWithFreshAvail.filter((item) => item.quantity > 0)

      if (itemsWithQuantities.length === 0) {
        toast.error("Please add at least one item with quantity greater than 0")
        setIsGenerating(false)
        return
      }

      const staffPayload = itemsWithQuantities.map((item) => ({
        flavor: item.flavor,
        productType: item.productType,
        productName: item.productName,
        size: item.size,
        flavourLineId: item.flavourLineId,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
      }))

      if (isEditMode && editingNoteId) {
        // Update existing delivery note
        const response = await fetch('/api/jaba/delivery-notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingNoteId,
            noteId: deliveryNoteId.trim(),
            distributorId: distributorId,
            distributorName: selectedDistributor?.name || '',
            items: staffPayload,
            vehicle: vehicle.trim() || undefined,
            driver: driver.trim() || undefined,
            driverPhone: driverPhone.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorMessage = data.error || data.details || 'Failed to update delivery note'
          console.error('[Distribution] API Error:', errorMessage, data)
          throw new Error(errorMessage)
        }

        toast.success(`Delivery note ${deliveryNoteId} updated successfully!`)
        router.push('/jaba/distribution')
      } else {
        // Create new delivery note
        const response = await fetch('/api/jaba/delivery-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            noteId: deliveryNoteId.trim(),
            distributorId: distributorId,
            distributorName: selectedDistributor?.name || '',
            items: staffPayload,
            vehicle: vehicle.trim() || undefined,
            driver: driver.trim() || undefined,
            driverPhone: driverPhone.trim() || undefined,
            notes: notes.trim() || undefined,
            date: new Date().toISOString(),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorMessage = data.error || data.details || 'Failed to generate delivery note'
          console.error('[Distribution] API Error:', errorMessage, data)
          throw new Error(errorMessage)
        }

        toast.success(`Delivery note ${deliveryNoteId} generated successfully!`)
        router.push('/jaba/distribution')
      }
    } catch (error: any) {
      console.error('Error generating delivery note:', error)
      const errorMessage = error.message || 'Failed to generate delivery note'
      toast.error(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isEditMode ? 'Edit Delivery Note' : 'Create Delivery Note'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? 'Update delivery note details' : 'Select flavour, bottle size, quantity, and price'}
            </p>
          </div>
        </div>
        <Link href="/jaba/distribution">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Distributor Selection */}
            <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Select Distributor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {loadingEditData && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mr-2" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Loading delivery note data...</span>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="distributor" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Distributor *
                    </Label>
                    <Link href="/jaba/distributors/add">
                      <Button variant="outline" size="sm" className="h-8">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Distributor
                      </Button>
                    </Link>
                  </div>
                  <Select value={distributorId} onValueChange={setDistributorId} disabled={loadingDistributors || loadingEditData}>
                    <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500">
                      <SelectValue placeholder={loadingDistributors ? "Loading distributors..." : "Select distributor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.length > 0 ? (
                        distributors.map((dist) => (
                          <SelectItem key={dist._id || dist.id} value={dist._id || dist.id}>
                            {dist.name} {dist.region ? `(${dist.region})` : ''}
                        </SelectItem>
                        ))
                      ) : (
                        !loadingDistributors && (
                          <div className="px-2 py-2 text-sm text-muted-foreground space-y-2">
                            <p>No distributors available.</p>
                            <Link href="/jaba/distributors/add">
                              <Button size="sm" variant="outline">Create distributor</Button>
                            </Link>
                          </div>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {selectedDistributor && (
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 mt-3">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">{selectedDistributor.name}</p>
                      <p className="text-xs text-blue-800 dark:text-blue-200">{selectedDistributor.contactPerson} • {selectedDistributor.phone}</p>
                      {selectedDistributor.address && (
                        <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">{selectedDistributor.address}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Optional: narrow to one or two batches */}
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50/80 to-white dark:from-slate-900 dark:to-slate-950 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <CardTitle className="text-base font-bold text-card-foreground flex items-center gap-2">
                  <Hash className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  Batches to distribute from (optional, max 2)
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  Leave empty to list every batch that has packaged stock. Pick one or two batch numbers to focus the list and summaries below.
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Batch 1</Label>
                    <Select
                      value={batchFilter1 || "__none__"}
                      onValueChange={(v) => setBatchFilter1(v === "__none__" ? "" : v)}
                      disabled={loading}
                    >
                      <SelectTrigger className="h-11 border-2">
                        <SelectValue placeholder="Any batch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Any batch</SelectItem>
                        {batchesForDropdown.map((b) => (
                          <SelectItem key={batchId(b)} value={batchId(b)}>
                            {b.batchNumber}
                            {b.flavor ? ` — ${b.flavor}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Batch 2</Label>
                    <Select
                      value={batchFilter2 || "__none__"}
                      onValueChange={(v) => setBatchFilter2(v === "__none__" ? "" : v)}
                      disabled={loading}
                    >
                      <SelectTrigger className="h-11 border-2">
                        <SelectValue placeholder="Second batch (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {batchesForDropdown.map((b) => (
                          <SelectItem key={`2-${batchId(b)}`} value={batchId(b)}>
                            {b.batchNumber}
                            {b.flavor ? ` — ${b.flavor}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isBatchFilterActive && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchFilter1("")
                        setBatchFilter2("")
                      }}
                    >
                      Clear batch filters
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Showing: {focusedBatchLabels.join(" · ") || focusedBatchIds.join(", ")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Select Products from Batches */}
            <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-b border-purple-200 dark:border-purple-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {isBatchFilterActive ? (
                    <>
                      Select products — {focusedBatchLabels.length} batch
                      {focusedBatchLabels.length === 1 ? "" : "es"} ({focusedBatchLabels.join(" · ")})
                    </>
                  ) : (
                    <>Select finished products ({flavorSizeGroups.length} flavour + size with stock)</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <p className="text-xs text-muted-foreground rounded-lg border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 px-3 py-2">
                  Choose flavour and bottle size only. The server allocates oldest packaged batches and packages automatically when you save — batch and package numbers from the browser are never used for stock.
                </p>
                {isBatchFilterActive && flavorSizeGroups.length > 0 && (
                  <div className="rounded-xl border-2 border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2 mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      Packaged stock (selected batches only)
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {flavorSizeGroups.map((row) => (
                        <li key={row.groupKey} className="flex justify-between gap-2">
                          <span>
                            {row.displayFlavor} · {row.size}
                          </span>
                          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                            {row.availableBottles.toLocaleString()} avail
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading stock…</p>
                  </div>
                ) : flavorSizeGroups.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                    <Package className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {isBatchFilterActive
                        ? "No packaged stock left for the selected batch(es)"
                        : "No distributable packaged stock"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {isBatchFilterActive
                        ? "Try another batch or clear filters"
                        : "Packaging output may be missing or already fully allocated on delivery notes"}
                    </p>
                    {isBatchFilterActive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setBatchFilter1("")
                          setBatchFilter2("")
                        }}
                      >
                        Show all batches
                      </Button>
                    )}
                  </div>
                ) : (
                  flavorSizeGroups.map((row) => {
                    const isExpanded = expandedBatches.has(row.groupKey)
                    const isSelected = isGroupSelected(row.groupKey)
                    const selectedItem = selectedItems.find((item) => item.groupKey === row.groupKey)
                    const productName = `${row.productType} of ${row.displayFlavor}`
                    const hasSelectedItems = isSelected

                    return (
                      <Card
                        key={row.groupKey}
                        className={cn(
                          "border-2 shadow-md transition-all",
                          hasSelectedItems
                            ? "border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50/70 to-violet-50/40 dark:from-purple-950/30 dark:to-violet-950/20"
                            : "border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950"
                        )}
                      >
                        <CardContent className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleFlavorGroup(row.groupKey)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 text-left">
                              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                                <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                                    {productName}
                                  </h3>
                                  {hasSelectedItems && (
                                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs px-2 py-0.5">
                                      In note
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                  {row.displayFlavor} • {row.productType}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                  {row.size} • {row.availableBottles.toLocaleString()} bottles available (FIFO preview)
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                              <Card
                                className={cn(
                                  "border-2 shadow-sm transition-all",
                                  isSelected
                                    ? "border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50/80 to-violet-50/50 dark:from-purple-950/40 dark:to-violet-950/30"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                      <div>
                                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                                          {productName}
                                        </h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className="font-medium text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                            {row.size}
                                          </Badge>
                                          <Badge className="font-medium text-xs px-2 py-0.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                            {row.productType}
                                          </Badge>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                                        <span>
                                          Available:{" "}
                                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                            {row.availableBottles.toLocaleString()}
                                          </span>{" "}
                                          bottles
                                        </span>
                                        {row.availableBottles === 0 && (
                                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                            Out of Stock
                                          </Badge>
                                        )}
                                        {row.availableBottles > 0 && row.availableBottles <= 10 && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-300">
                                            Low Stock
                                          </Badge>
                                        )}
                                      </div>

                                      {isSelected && selectedItem && (
                                        <div className="mt-4 pt-4 border-t-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 rounded-lg p-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <Label htmlFor={`qty-${selectedItem.id}`} className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                                Quantity
                                              </Label>
                                              <div className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1fr)_auto] items-center gap-2">
                                                <Input
                                                  id={`qty-${selectedItem.id}`}
                                                  type="number"
                                                  min="0"
                                                  max={row.availableBottles}
                                                  value={selectedItem.quantity || ""}
                                                  onChange={(e) => updateItemQuantity(selectedItem.id, parseInt(e.target.value, 10) || 0)}
                                                  className={cn(
                                                    "h-11 w-full min-w-[140px] border-2 font-semibold text-slate-900 dark:text-slate-100",
                                                    selectedItem.quantity > row.availableBottles
                                                      ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/20 focus:border-red-600 dark:focus:border-red-600"
                                                      : "border-purple-300 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-500 bg-white dark:bg-slate-900"
                                                  )}
                                                  placeholder="0"
                                                />
                                                <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-md">
                                                  /{" "}
                                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {row.availableBottles.toLocaleString()}
                                                  </span>{" "}
                                                  max
                                                  {selectedItem.quantity > 0 && (
                                                    <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                                      (Remaining:{" "}
                                                      <span className="font-bold">
                                                        {Math.max(0, row.availableBottles - selectedItem.quantity).toLocaleString()}
                                                      </span>
                                                      )
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="space-y-2">
                                              <Label htmlFor={`price-${selectedItem.id}`} className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                                Price Per Unit
                                              </Label>
                                              <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                                                  KES
                                                </div>
                                                <Input
                                                  id={`price-${selectedItem.id}`}
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={selectedItem.pricePerUnit || ""}
                                                  onChange={(e) => updateItemPricePerUnit(selectedItem.id, parseFloat(e.target.value) || 0)}
                                                  className="h-11 w-full pl-16 border-2 border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500 bg-white dark:bg-slate-900 font-semibold"
                                                  placeholder="0.00"
                                                />
                                              </div>
                                            </div>
                                          </div>

                                          {selectedItem.quantity > 0 && selectedItem.pricePerUnit > 0 && (
                                            <div className="mt-4 pt-4 border-t-2 border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 rounded-lg p-3">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                                    Line Total
                                                  </span>
                                                </div>
                                                <div className="text-right">
                                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                                    KES{" "}
                                                    {(selectedItem.quantity * selectedItem.pricePerUnit).toLocaleString(undefined, {
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2,
                                                    })}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      {isSelected ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeSelectedItem(selectedItem!.id)}
                                          className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => addFlavorLine(row)}
                                          disabled={row.availableBottles === 0}
                                          className="bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 h-9"
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add
                                        </Button>
                                      )}
                                      {isSelected && selectedItem && selectedItem.quantity > 0 && (
                                        <div className="text-xs text-center font-semibold text-purple-700 dark:text-purple-400">
                                          {selectedItem.quantity} qty
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Selected Items Summary */}
            {selectedItems.length > 0 && (
              <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
                  <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    Selected Products ({selectedItems.filter((item) => item.quantity > 0).length} with quantities)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {selectedItems
                      .filter((item) => item.quantity > 0)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                                  {item.productName}
                                </span>
                                <Badge className="font-medium text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  {item.size}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
                                Batches and packages are assigned on save (oldest stock first).
                              </p>
                              
                              {/* Price and Quantity Info */}
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Quantity</p>
                                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {item.quantity.toLocaleString()}
                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">bottles</span>
                                  </p>
                                </div>
                                {item.pricePerUnit > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Price/Unit</p>
                                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                      KES {item.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Total Cost - Prominent Display */}
                            {item.pricePerUnit > 0 && (
                              <div className="text-right min-w-[140px]">
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Total</p>
                                  <p className="text-xl font-bold text-green-700 dark:text-green-400">
                                    KES {(item.quantity * item.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    {selectedItems.filter((item) => item.quantity > 0).length === 0 && (
                      <div className="text-center py-6">
                        <AlertCircle className="h-8 w-8 text-amber-500 dark:text-amber-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">No quantities specified</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Set quantities for selected products above</p>
                      </div>
                    )}
                    {selectedItems.filter((item) => item.quantity > 0).length > 0 && (
                      <div className="mt-4 pt-4 border-t-2 border-green-300 dark:border-green-700">
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Total Quantity</span>
                            <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                              {totalQuantity.toLocaleString()} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">bottles</span>
                            </span>
                          </div>
                          {totalCost > 0 && (
                            <div className="pt-3 border-t-2 border-green-300 dark:border-green-700">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Grand Total</span>
                                </div>
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg">
                                  <p className="text-2xl font-bold">
                                    KES {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Information */}
            <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                    <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Vehicle (Optional)
                    </Label>
                    <Input
                      id="vehicle"
                      placeholder="e.g., TRUCK-1234"
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Driver Name (Optional)
                    </Label>
                    <Input
                      id="driver"
                      placeholder="e.g., TEST DRIVER"
                      value={driver}
                      onChange={(e) => setDriver(e.target.value)}
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Driver Phone Number (Optional)
                  </Label>
                  <Input
                    id="driverPhone"
                    type="tel"
                    placeholder="e.g., +254 712 345 678 or 0712 345 678"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px] border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg rounded-2xl flex flex-col max-h-[75vh] lg:max-h-[calc(100vh-8rem)] lg:sticky lg:top-24">
              {/* Clean Header */}
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Delivery Note Preview
                  </CardTitle>
                </div>
                {/* Meta Row */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {loadingNoteId ? (
                    <span className="font-medium text-slate-400 dark:text-slate-500 animate-pulse">Loading...</span>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{deliveryNoteId || "DN-001"}</span>
                      <span>•</span>
                      <span>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </>
                  )}
                </div>
              </CardHeader>

              {/* Scrollable Content */}
              <CardContent className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Distributor Section */}
                {selectedDistributor && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Distributor</p>
                    <p className="font-semibold text-base text-slate-900 dark:text-slate-100">{selectedDistributor.name}</p>
                    {selectedDistributor.contactPerson && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedDistributor.contactPerson}</p>
                    )}
                  </div>
                )}

                {/* Divider */}
                {(selectedDistributor || selectedItems.length > 0) && (
                  <div className="border-t border-slate-200 dark:border-slate-800"></div>
                )}

                {/* Grouped by batch — what will be distributed */}
                {previewItemsByBatch.size > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Contents by batch
                    </p>
                    <div className="space-y-2">
                      {[...previewItemsByBatch.entries()].map(([batchNo, items]) => {
                        const subtotal = items.reduce((s, i) => s + i.quantity, 0)
                        return (
                          <div
                            key={batchNo}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 overflow-hidden"
                          >
                            <div className="px-3 py-2 bg-slate-200/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Batch {batchNo}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-400 ml-2">
                                {subtotal.toLocaleString()} bottles total
                              </span>
                            </div>
                            <ul className="px-3 py-2 space-y-1.5 text-sm">
                              {items.map((i, idx) => (
                                <li
                                  key={`${i.packagingOutputId}-${idx}`}
                                  className="flex justify-between gap-2 text-slate-800 dark:text-slate-200"
                                >
                                  <span className="min-w-0 truncate">
                                    {i.productName}{" "}
                                    <span className="text-slate-500 dark:text-slate-400">({i.size})</span>
                                  </span>
                                  <span className="font-bold tabular-nums shrink-0">
                                    {i.quantity.toLocaleString()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {previewItemsByBatch.size > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800"></div>
                )}

                {/* Items Section — mirrors persisted note lines after server FIFO */}
                {selectedItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {fifoPreview?.items?.length ? "Saved-style lines (preview)" : "Staff lines"}
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {(fifoPreview?.items?.length
                          ? fifoPreview.items.length
                          : selectedItems.filter((item) => item.quantity > 0).length
                        ).toLocaleString()}{" "}
                        {(fifoPreview?.items?.length || selectedItems.filter((item) => item.quantity > 0).length) === 1
                          ? "line"
                          : "lines"}
                      </span>
                    </div>
                    <div className="space-y-0 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {fifoPreview?.items && fifoPreview.items.length > 0
                        ? fifoPreview.items.map((item, index) => (
                            <div
                              key={`${item.packagingOutputId}-${index}`}
                              className={cn(
                                "px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                index !== fifoPreview.items.length - 1 && "border-b border-slate-200 dark:border-slate-800"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                    {item.productName}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                      {item.size}
                                    </Badge>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-500">•</span>
                                    <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                                      {item.batchNumber}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                                    {item.quantity.toLocaleString()}
                                  </p>
                                  {item.pricePerUnit > 0 && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      @ KES{" "}
                                      {item.pricePerUnit.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        : selectedItems
                            .filter((item) => item.quantity > 0)
                            .map((item, index, arr) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                  index !== arr.length - 1 && "border-b border-slate-200 dark:border-slate-800"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0 pr-4">
                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                      {item.productName}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                        {item.size}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                                      {item.quantity.toLocaleString()}
                                    </p>
                                    {item.pricePerUnit > 0 && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        @ KES{" "}
                                        {item.pricePerUnit.toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                      {selectedItems.filter((item) => item.quantity > 0).length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400 italic">No quantities specified</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary Section */}
                {totalQuantity > 0 && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-2 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Quantity</span>
                        <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                          {totalQuantity.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">bottles</span>
                        </span>
                      </div>
                      {totalCost > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Grand Total</span>
                            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                              KES {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Logistics Section */}
                {(vehicle || driver) && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {vehicle && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vehicle</p>
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{vehicle}</p>
                        </div>
                      )}
                      {driver && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Driver</p>
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{driver}</p>
                          {driverPhone && (
                            <a 
                              href={`tel:${driverPhone}`}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1 mt-1"
                            >
                              📞 {driverPhone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>

              {/* Sticky Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-b-2xl">
                <div className="flex flex-col gap-3">
                  <Link href="/jaba/distribution" className="w-full">
                    <Button variant="ghost" className="w-full h-11 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    onClick={handleGenerateNote}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 h-11 font-semibold transition-all duration-200"
                    disabled={!distributorId || selectedItems.length === 0 || totalQuantity === 0 || isGenerating || loadingEditData}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isEditMode ? 'Updating...' : 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {isEditMode ? 'Update Delivery Note' : 'Generate Note'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

export default function CreateDeliveryNotePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreateDeliveryNotePageContent />
    </Suspense>
  )
}
