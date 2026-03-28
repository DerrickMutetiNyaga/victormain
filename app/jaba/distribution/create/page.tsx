"use client"

import { useState, useEffect, Suspense } from "react"
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

interface SelectedItem {
  id: string
  finishedGoodId: string
  productName: string // Full product name like "Jaba Juice of Tangerine"
  flavor: string
  productType: string
  size: "500ml" | "1L" | "2L"
  batchNumber: string
  packageNumber: string // PKG-00001
  /** When set, stock is tracked per flavour line under the same parent batch */
  flavourLineId?: string
  availableQuantity: number
  quantity: number
  pricePerUnit: number
}

interface Product {
  id: string
  flavor: string
  productType: string
  size: "500ml" | "1L" | "2L"
  quantity: number
  batches: string[]
  lastUpdated: Date
}

interface BatchGroup {
  batchNumber: string
  flavor: string
  productType: string
  date: Date
  products: Array<{
    finishedGood: Product
    packageNumber: string
    availableQuantity: number
    flavourLineId?: string
  }>
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
  const [batches, setBatches] = useState<any[]>([])
  const [packagingOutputs, setPackagingOutputs] = useState<any[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedBatchData, setSelectedBatchData] = useState<any>(null)
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
            const mappedItems: SelectedItem[] = noteToEdit.items.map((item: any, index: number) => {
              const displayName = item.productName || 
                (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
                (item.flavor ? item.flavor : 'Product'))
              
              return {
                id: `edit-${index}-${item.batchNumber}-${item.size}`,
                finishedGoodId: item.finishedGoodId || `${item.batchNumber}-${item.size}`,
                productName: displayName,
                flavor: item.flavor || '',
                productType: item.productType || 'Juice',
                size: item.size,
                batchNumber: item.batchNumber || '',
                packageNumber: item.packageNumber || '',
                flavourLineId: item.flavourLineId,
                availableQuantity: item.quantity,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit || 0,
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

  // Check if we're in single-batch mode
  const isSingleBatchMode = selectedBatchId !== null

  // Get package number for a finished good based on batch number
  const getPackageNumber = (batchNumber: string): string => {
    const packagingOutput = packagingOutputs.find((po) => {
      const batch = batches.find((b) => (b._id || b.id) === po.batchId)
      return batch?.batchNumber === batchNumber
    })
    // Always prefer packageNumber from packaging output, generate if missing
    if (packagingOutput?.packageNumber) {
      return packagingOutput.packageNumber
    }
    // Generate a package number if not found
    const currentYear = new Date().getFullYear()
    const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
    return `PKG-${currentYear}-${randomNum}`
  }

  const segmentForPackaging = (po: any, batchFlavor: string) => {
    if (po.flavourLineId) return `fid:${String(po.flavourLineId)}`
    const n = (po.flavourName || batchFlavor || "Unknown").trim()
    return `fl:${n}`
  }

  const segmentForDeliveryItem = (item: any) => {
    if (item.flavourLineId) return `fid:${String(item.flavourLineId)}`
    return `fl:${(item.flavor || "").trim()}`
  }

  // Group products by batch from packaging outputs and calculate available quantities
  const groupByBatch = (): Map<string, BatchGroup> => {
    const batchMap = new Map<string, BatchGroup>()
    const relevantPackagingOutputs = isSingleBatchMode && selectedBatchData
      ? packagingOutputs.filter((po) => po.batchId === selectedBatchId)
      : packagingOutputs

    const packagedByKey = new Map<string, number>()
    relevantPackagingOutputs.forEach((packagingOutput) => {
      const batch = batches.find((b) => (b._id || b.id) === packagingOutput.batchId)
      if (!batch) return
      const batchNumber = batch.batchNumber
      const seg = segmentForPackaging(packagingOutput, batch.flavor || "")
      if (!packagingOutput.containers || !Array.isArray(packagingOutput.containers)) return
      packagingOutput.containers.forEach((container: any) => {
        const size = container.size || "500ml"
        const quantity = parseFloat(container.quantity) || 0
        const key = `${batchNumber}|${seg}|${size}`
        packagedByKey.set(key, (packagedByKey.get(key) || 0) + quantity)
      })
    })

    const distributedByKey = new Map<string, number>()
    deliveryNotes.forEach((note: any) => {
      if (!note.items || !Array.isArray(note.items)) return
      note.items.forEach((item: any) => {
        if (!item.batchNumber || !item.size) return
        const seg = segmentForDeliveryItem(item)
        const key = `${item.batchNumber}|${seg}|${item.size}`
        const qty = parseFloat(item.quantity) || 0
        distributedByKey.set(key, (distributedByKey.get(key) || 0) + qty)
      })
    })

    relevantPackagingOutputs.forEach((packagingOutput) => {
      const batch = batches.find((b) => (b._id || b.id) === packagingOutput.batchId)
      if (!batch) return
      const batchNumber = batch.batchNumber
      const seg = segmentForPackaging(packagingOutput, batch.flavor || "")
      const displayFlavor = (packagingOutput.flavourName || batch.flavor || "Unknown").trim()

      if (!batchMap.has(batchNumber)) {
        batchMap.set(batchNumber, {
          batchNumber,
          flavor: batch.flavor || "Unknown",
          productType: batch.productCategory || "Juice",
          date: batch.date ? new Date(batch.date) : new Date(),
          products: [],
        })
      }

      const group = batchMap.get(batchNumber)!

      if (!packagingOutput.containers || !Array.isArray(packagingOutput.containers)) return

      let pkgNumber = packagingOutput.packageNumber
      if (!pkgNumber ||
          pkgNumber === packagingOutput.batchNumber ||
          pkgNumber === batchNumber ||
          !pkgNumber.startsWith("PKG-")) {
        const currentYear = new Date().getFullYear()
        const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
        pkgNumber = `PKG-${currentYear}-${randomNum}`
      }

      packagingOutput.containers.forEach((container: any) => {
        const size = container.size || "500ml"
        const packagedQty = parseFloat(container.quantity) || 0
        if (packagedQty <= 0) return
        const key = `${batchNumber}|${seg}|${size}`
        const totalPackaged = packagedByKey.get(key) || 0
        const totalDistributed = distributedByKey.get(key) || 0
        const availableQty = Math.max(0, totalPackaged - totalDistributed)
        if (availableQty <= 0) return

        const finishedGoodId = `${batchNumber}|${seg}|${size}`
        const existingProduct = group.products.find((p) => p.finishedGood.id === finishedGoodId)

        if (existingProduct) {
          existingProduct.availableQuantity = availableQty
          if (packagingOutput.flavourLineId) {
            existingProduct.flavourLineId = String(packagingOutput.flavourLineId)
          }
        } else {
          group.products.push({
            finishedGood: {
              id: finishedGoodId,
              flavor: displayFlavor,
              productType: batch.productCategory || "Juice",
              size: size as "500ml" | "1L" | "2L",
              quantity: packagedQty,
              batches: [batchNumber],
              lastUpdated: new Date(),
            },
            packageNumber: pkgNumber,
            availableQuantity: availableQty,
            flavourLineId: packagingOutput.flavourLineId
              ? String(packagingOutput.flavourLineId)
              : undefined,
          })
        }
      })
    })

    return batchMap
  }

  // Fetch batches and packaging outputs
  useEffect(() => {
    const batchParam = searchParams.get("batch")
    if (batchParam) {
      setSelectedBatchId(batchParam)
      fetchBatchData(batchParam)
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
        // Filter batches that have packaged items ready for distribution
        const readyBatches = batchesData.batches.filter((b: any) =>
          ["Ready for Distribution", "Partially Packaged", "Partially Allocated", "Fully Allocated"].includes(b.status) &&
          ((b.bottles500ml || 0) + (b.bottles1L || 0) + (b.bottles2L || 0) > 0)
        )
        setBatches(readyBatches)
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

  const fetchBatchData = async (batchId: string) => {
    try {
      const response = await fetch(`/api/jaba/batches/${batchId}`)
      const data = await response.json()
      
      if (response.ok && data.batch) {
        setSelectedBatchData(data.batch)
        // Auto-expand this batch
        setExpandedBatches(new Set([data.batch.batchNumber]))
      }
    } catch (error) {
      console.error('Error fetching batch:', error)
      toast.error('Failed to load batch data')
    }
  }

  // Filter batch groups based on mode
  const getFilteredBatchGroups = () => {
    const allGroups = Array.from(groupByBatch().values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .filter((bg) => bg.products.some((p) => p.availableQuantity > 0))
    
    if (isSingleBatchMode && selectedBatchData) {
      // Only show the selected batch
      return allGroups.filter((bg) => bg.batchNumber === selectedBatchData.batchNumber)
    }
    
    return allGroups
  }

  const batchGroups = getFilteredBatchGroups()

  const toggleBatch = (batchNumber: string) => {
    const newExpanded = new Set(expandedBatches)
    if (newExpanded.has(batchNumber)) {
      newExpanded.delete(batchNumber)
    } else {
      newExpanded.add(batchNumber)
    }
    setExpandedBatches(newExpanded)
  }

  const addSelectedItem = (finishedGoodId: string, batchNumber: string, defaultQuantity?: number) => {
    // Find the product in batch groups
    const batchGroup = batchGroups.find((bg) => bg.batchNumber === batchNumber)
    if (!batchGroup) return

    const product = batchGroup.products.find((p) => p.finishedGood.id === finishedGoodId)
    if (!product) return

    const lineId = product.flavourLineId || ""
    if (
      selectedItems.some(
        (item) =>
          item.finishedGoodId === finishedGoodId &&
          item.batchNumber === batchNumber &&
          String(item.flavourLineId || "") === String(lineId)
      )
    ) {
      return
    }

    // Ensure we have a valid package number (must start with PKG-)
    let packageNumber = product.packageNumber
    if (!packageNumber || !packageNumber.startsWith('PKG-') || packageNumber === batchNumber) {
      // Fallback to getPackageNumber or generate one
      packageNumber = getPackageNumber(batchNumber)
      console.log(`[Distribution] Using fallback package number for item: ${packageNumber}`)
    }
    
    const productName = `${product.finishedGood.productType} of ${product.finishedGood.flavor}` // e.g., "Juice of Tangerine"

    const newItem: SelectedItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      finishedGoodId: product.finishedGood.id,
      productName,
      flavor: product.finishedGood.flavor,
      productType: product.finishedGood.productType,
      size: product.finishedGood.size,
      batchNumber,
      packageNumber,
      flavourLineId: product.flavourLineId || undefined,
      availableQuantity: product.availableQuantity,
      quantity: defaultQuantity || 0,
      pricePerUnit: 0,
    }
    
    console.log(`[Distribution] Added item with package number: ${packageNumber} for batch: ${batchNumber}`)

    setSelectedItems([...selectedItems, newItem])
  }

  const removeSelectedItem = (id: string) => {
    setSelectedItems(selectedItems.filter((item) => item.id !== id))
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.min(Math.max(0, quantity), item.availableQuantity) }
          : item
      )
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
  const isProductSelected = (
    finishedGoodId: string,
    batchNumber: string,
    flavourLineId?: string
  ): boolean => {
    return selectedItems.some(
      (item) =>
        item.finishedGoodId === finishedGoodId &&
        item.batchNumber === batchNumber &&
        String(item.flavourLineId || "") === String(flavourLineId || "")
    )
  }

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
      const itemsWithQuantities = selectedItems.filter((item) => item.quantity > 0)
      
      if (itemsWithQuantities.length === 0) {
        toast.error("Please add at least one item with quantity greater than 0")
        setIsGenerating(false)
        return
      }

      // CRITICAL: Validate quantities don't exceed available stock
      const validationErrors: string[] = []
      for (const item of itemsWithQuantities) {
        // Re-fetch current available quantity to ensure we have latest data
        const batchGroup = batchGroups.find((bg) => bg.batchNumber === item.batchNumber)
        if (batchGroup) {
          const product = batchGroup.products.find((p) => p.finishedGood.id === item.finishedGoodId)
          if (product) {
            const currentAvailable = product.availableQuantity
            if (item.quantity > currentAvailable) {
              validationErrors.push(
                `${item.productName} (${item.size}): Requested ${item.quantity.toLocaleString()}, Available ${currentAvailable.toLocaleString()}`
              )
            }
          } else {
            validationErrors.push(`${item.productName} (${item.size}): Product not found in batch`)
          }
        } else {
          validationErrors.push(`${item.productName} (${item.size}): Batch not found`)
        }
      }

      if (validationErrors.length > 0) {
        toast.error(
          `Cannot proceed: Quantities exceed available stock:\n${validationErrors.join('\n')}`,
          { duration: 8000 }
        )
        setIsGenerating(false)
        // Refresh data to get latest available quantities
        await fetchData()
        return
      }
      
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
            items: itemsWithQuantities.map((item) => ({
              finishedGoodId: item.finishedGoodId,
              productName: item.productName,
              flavor: item.flavor,
              productType: item.productType,
              size: item.size,
              batchNumber: item.batchNumber,
              packageNumber: item.packageNumber,
              flavourLineId: item.flavourLineId,
              quantity: item.quantity,
              pricePerUnit: item.pricePerUnit,
              totalCost: item.quantity * item.pricePerUnit,
            })),
            vehicle: vehicle.trim() || undefined,
            driver: driver.trim() || undefined,
            driverPhone: driverPhone.trim() || undefined,
            notes: notes.trim() || undefined,
            totalCost: itemsWithQuantities.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0),
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
            items: itemsWithQuantities.map((item) => ({
              finishedGoodId: item.finishedGoodId,
              productName: item.productName,
              flavor: item.flavor,
              productType: item.productType,
              size: item.size,
              batchNumber: item.batchNumber,
              packageNumber: item.packageNumber,
              flavourLineId: item.flavourLineId,
              quantity: item.quantity,
              pricePerUnit: item.pricePerUnit,
              totalCost: item.quantity * item.pricePerUnit,
            })),
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
              {isEditMode ? 'Update delivery note details' : 'Select products from batches to distribute'}
            </p>
          </div>
        </div>
        <Link href="/jaba/distribution">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
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
                  <Label htmlFor="distributor" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Distributor *
                  </Label>
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
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No distributors available
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

            {/* Select Products from Batches */}
            <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-b border-purple-200 dark:border-purple-900/50">
                <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {isSingleBatchMode ? (
                    <>Select Products from Batch: {selectedBatchData?.batchNumber || "Loading..."}</>
                  ) : (
                    <>Select Products from Batches ({batchGroups.length} batches available)</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading batches...</p>
                  </div>
                ) : batchGroups.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                    <Package className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {isSingleBatchMode ? "No packaged products available for this batch" : "No batches with available stock"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {isSingleBatchMode ? "This batch may not have been packaged yet" : "All products have been distributed"}
                    </p>
                    {isSingleBatchMode && (
                      <Link href="/jaba/distribution/create" className="mt-4 inline-block">
                        <Button variant="outline" size="sm">
                          View All Batches
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  batchGroups.map((batchGroup) => {
                    const isExpanded = expandedBatches.has(batchGroup.batchNumber)
                    const selectedCount = selectedItems.filter((item) => item.batchNumber === batchGroup.batchNumber).length
                    const hasSelectedItems = selectedCount > 0

                    return (
                      <Card
                        key={batchGroup.batchNumber}
                        className={cn(
                          "border-2 shadow-md transition-all",
                          hasSelectedItems
                            ? "border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50/70 to-violet-50/40 dark:from-purple-950/30 dark:to-violet-950/20"
                            : "border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950"
                        )}
                      >
                        <CardContent className="p-0">
                          {/* Batch Header - Clickable to Expand */}
                          <button
                            onClick={() => toggleBatch(batchGroup.batchNumber)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 text-left">
                              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                                <Hash className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                                    {batchGroup.batchNumber}
                                  </h3>
                                  {hasSelectedItems && (
                                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs px-2 py-0.5">
                                      {selectedCount} selected
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                  {batchGroup.flavor} • {batchGroup.productType}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                  {batchGroup.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} • {batchGroup.products.length} products
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

                          {/* Expanded Products List */}
                          {isExpanded && (
                            <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                              {batchGroup.products.map((product) => {
                                const isSelected = isProductSelected(
                                  product.finishedGood.id,
                                  batchGroup.batchNumber,
                                  product.flavourLineId
                                )
                                const selectedItem = selectedItems.find(
                                  (item) => item.finishedGoodId === product.finishedGood.id && item.batchNumber === batchGroup.batchNumber
                                )
                                const productName = `${product.finishedGood.productType} of ${product.finishedGood.flavor}`

                                return (
                                  <Card
                                    key={`${product.finishedGood.id}-${batchGroup.batchNumber}`}
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
                                          {/* Product Name - This is where they see "Jaba Juice of Tangerine" */}
                                          <div>
                                            <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                                              {productName}
                                            </h4>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge className="font-medium text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                {product.finishedGood.size}
                                              </Badge>
                                              <Badge className="font-medium text-xs px-2 py-0.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                                {product.finishedGood.productType}
                                              </Badge>
                                            </div>
                                          </div>

                                          {/* Batch and Package Info */}
                                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                                            <div className="flex items-center gap-1">
                                              <Hash className="h-3 w-3" />
                                              <span>Batch: {batchGroup.batchNumber}</span>
                                            </div>
                                            <span className="text-slate-400">•</span>
                                            <div className="flex items-center gap-1">
                                              <Package className="h-3 w-3" />
                                              <span className="font-semibold">Package: {product.packageNumber}</span>
                                            </div>
                                            <span className="text-slate-400">•</span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                                Available: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{product.availableQuantity.toLocaleString()}</span> bottles
                                              </span>
                                              {product.availableQuantity === 0 && (
                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                  Out of Stock
                                                </Badge>
                                              )}
                                              {product.availableQuantity > 0 && product.availableQuantity <= 10 && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-300">
                                                  Low Stock
                                                </Badge>
                                              )}
                                            </div>
                                          </div>

                                          {/* Quantity and Price Input - Redesigned */}
                                          {isSelected && selectedItem && (
                                            <div className="mt-4 pt-4 border-t-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 rounded-lg p-4">
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Quantity Section */}
                                                <div className="space-y-2">
                                                  <Label htmlFor={`qty-${selectedItem.id}`} className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                                    Quantity
                                                  </Label>
                                                  <div className="flex items-center gap-2">
                                                    <Input
                                                      id={`qty-${selectedItem.id}`}
                                                      type="number"
                                                      min="0"
                                                      max={selectedItem.availableQuantity}
                                                      value={selectedItem.quantity || ""}
                                                      onChange={(e) => updateItemQuantity(selectedItem.id, parseInt(e.target.value) || 0)}
                                                      className={cn(
                                                        "h-11 w-full border-2 font-semibold",
                                                        selectedItem.quantity > selectedItem.availableQuantity
                                                          ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/20 focus:border-red-600 dark:focus:border-red-600"
                                                          : "border-purple-300 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-500 bg-white dark:bg-slate-900"
                                                      )}
                                                      placeholder="0"
                                                    />
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-md">
                                                      / <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedItem.availableQuantity.toLocaleString()}</span> max
                                                      {selectedItem.quantity > 0 && (
                                                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                                          (Remaining: <span className="font-bold">{Math.max(0, selectedItem.availableQuantity - selectedItem.quantity).toLocaleString()}</span>)
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Price Per Unit Section */}
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

                                              {/* Total Cost Display */}
                                              {selectedItem.quantity > 0 && selectedItem.pricePerUnit > 0 && (
                                                <div className="mt-4 pt-4 border-t-2 border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 rounded-lg p-3">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                                        Total Cost
                                                      </span>
                                                    </div>
                                                    <div className="text-right">
                                                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                                        KES {(selectedItem.quantity * selectedItem.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                      </p>
                                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {selectedItem.quantity.toLocaleString()} × {selectedItem.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Add/Remove Button */}
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
                                              onClick={() => addSelectedItem(product.finishedGood.id, batchGroup.batchNumber)}
                                              disabled={product.availableQuantity === 0}
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
                                )
                              })}
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
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap mb-3">
                                <span>Batch: {item.batchNumber}</span>
                                <span>•</span>
                                <span>Package: {item.packageNumber}</span>
                              </div>
                              
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
            <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg rounded-2xl sticky top-24 flex flex-col h-[calc(100vh-8rem)]">
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
              <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto">
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

                {/* Items Section - Clean List Style */}
                {selectedItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Items</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedItems.filter((item) => item.quantity > 0).length} {selectedItems.filter((item) => item.quantity > 0).length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="space-y-0 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {selectedItems
                        .filter((item) => item.quantity > 0)
                        .map((item, index) => (
                          <div
                            key={item.id}
                            className={cn(
                              "px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                              index !== selectedItems.filter((item) => item.quantity > 0).length - 1 && "border-b border-slate-200 dark:border-slate-800"
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
                                    @ KES {item.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 sticky bottom-0 rounded-b-2xl">
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
