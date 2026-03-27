"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X, Save, Hash, Package, Loader2, Check, AlertTriangle, Info, AlertCircle, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { toast } from "sonner"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

interface RawMaterial {
  _id: string
  id: string
  name: string
  category: string
  currentStock: number
  unit: string
  minStock?: number
  lowStockThreshold?: number
  reorderThreshold?: number
  supplier: string
}

type StockAlert = {
  material: RawMaterial
  type: 'out' | 'low' | 'reorder'
}

export default function AddBatchPage() {
  const router = useRouter()
  const [batchNumber, setBatchNumber] = useState("")
  const [loadingBatchNumber, setLoadingBatchNumber] = useState(true)
  
  // Fetch next sequential batch number for current year
  useEffect(() => {
    const fetchNextBatchNumber = async () => {
      try {
        setLoadingBatchNumber(true)
        const response = await fetch('/api/jaba/batches?nextNumber=true')
        
        if (!response.ok) {
          throw new Error('Failed to fetch next batch number')
        }
        
        const data = await response.json()
        setBatchNumber(data.nextBatchNumber)
      } catch (error) {
        console.error('Error fetching next batch number:', error)
        // Fallback to current year with 00001 if API fails
    const currentYear = new Date().getFullYear()
        setBatchNumber(`BCH-${currentYear}-00001`)
      } finally {
        setLoadingBatchNumber(false)
      }
    }
    
    fetchNextBatchNumber()
  }, [])
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [flavor, setFlavor] = useState("")
  const [supervisor, setSupervisor] = useState("")
  const [shift, setShift] = useState("Morning")
  const [expectedLitres, setExpectedLitres] = useState("")
  const [tankNumber, setTankNumber] = useState("")
  const [status, setStatus] = useState("Processing")
  const [selectedMaterials, setSelectedMaterials] = useState<{ material: string; quantity: string; unit: string; materialId?: string }[]>([])
  const [materialSelections, setMaterialSelections] = useState<{ [key: string]: string }>({}) // materialId -> quantity
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [flavors, setFlavors] = useState<{ _id: string; name: string }[]>([])
  const [loadingFlavors, setLoadingFlavors] = useState(true)
  const [newFlavor, setNewFlavor] = useState("")
  const [showAddFlavor, setShowAddFlavor] = useState(false)
  const [isAddingFlavor, setIsAddingFlavor] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(true)

  // Stock threshold defaults by unit type
  const getDefaultThresholds = (unit: string) => {
    const unitLower = unit.toLowerCase()
    if (unitLower.includes('pcs') || unitLower.includes('piece')) {
      return { low: 50, reorder: 150 }
    } else if (unitLower.includes('litre') || unitLower.includes('liter') || unitLower.includes('l')) {
      return { low: 10, reorder: 25 }
    } else if (unitLower.includes('kg') || unitLower.includes('kilogram')) {
      return { low: 10, reorder: 25 }
    }
    return { low: 10, reorder: 25 } // Default fallback
  }

  // Calculate stock alerts
  const getStockAlerts = (): StockAlert[] => {
    const alerts: StockAlert[] = []
    
    rawMaterials.forEach(material => {
      const stock = material.currentStock
      const thresholds = getDefaultThresholds(material.unit)
      const lowThreshold = material.lowStockThreshold ?? thresholds.low
      const reorderThreshold = material.reorderThreshold ?? thresholds.reorder
      
      if (stock === 0) {
        alerts.push({ material, type: 'out' })
      } else if (stock <= lowThreshold) {
        alerts.push({ material, type: 'low' })
      } else if (stock <= reorderThreshold) {
        alerts.push({ material, type: 'reorder' })
      }
    })
    
    return alerts.sort((a, b) => {
      // Sort: out of stock first, then low stock, then reorder
      const order = { out: 0, low: 1, reorder: 2 }
      return order[a.type] - order[b.type]
    })
  }

  const stockAlerts = getStockAlerts()
  const outOfStockAlerts = stockAlerts.filter(a => a.type === 'out')
  const lowStockAlerts = stockAlerts.filter(a => a.type === 'low')
  const reorderAlerts = stockAlerts.filter(a => a.type === 'reorder')

  const toggleMaterialSelection = (materialId: string) => {
    const newSelected = new Set(selectedMaterialIds)
    if (newSelected.has(materialId)) {
      newSelected.delete(materialId)
      // Remove quantity when deselected
      const updatedSelections = { ...materialSelections }
      delete updatedSelections[materialId]
      setMaterialSelections(updatedSelections)
    } else {
      newSelected.add(materialId)
      // Initialize quantity to empty when selected
      setMaterialSelections({ ...materialSelections, [materialId]: "" })
    }
    setSelectedMaterialIds(newSelected)
  }

  const updateMaterialQuantity = (materialId: string, quantity: string) => {
    const material = rawMaterials.find(rm => rm._id === materialId || rm.id === materialId)
    if (material) {
      // Allow empty string for clearing
      if (quantity === "" || quantity === null || quantity === undefined) {
        setMaterialSelections({ ...materialSelections, [materialId]: "" })
        return
      }
      
      const qty = Number(quantity)
      
      // Prevent negative numbers
      if (qty < 0) {
        toast.error("Quantity cannot be negative")
        return
      }
      
      // Prevent exceeding available stock
      if (qty > material.currentStock) {
        toast.error(`Cannot exceed available stock of ${material.currentStock} ${material.unit} for ${material.name}`, {
          duration: 3000,
        })
        // Set to max available instead of blocking
        setMaterialSelections({ ...materialSelections, [materialId]: material.currentStock.toString() })
        return
      }
    }
    setMaterialSelections({ ...materialSelections, [materialId]: quantity })
  }

  const addSelectedMaterials = () => {
    const materialsToAdd: { material: string; quantity: string; unit: string; materialId: string }[] = []
    const materialsMissingQuantity: string[] = []
    const materialsExceedingStock: string[] = []
    
    // Validate all quantities first
    for (const materialId of selectedMaterialIds) {
      const quantity = materialSelections[materialId]
      const material = rawMaterials.find(rm => rm._id === materialId || rm.id === materialId)
      
      if (!material) {
        toast.error("One or more materials not found in inventory")
        return
      }
      
      // Check if quantity is missing or invalid
      if (!quantity || quantity.trim() === "" || Number(quantity) <= 0) {
        materialsMissingQuantity.push(material.name)
        continue
      }
      
      const qty = Number(quantity)
      
      // Check if quantity exceeds stock
      if (qty > material.currentStock) {
        materialsExceedingStock.push(`${material.name} (Available: ${material.currentStock} ${material.unit}, Requested: ${qty} ${material.unit})`)
        continue
      }
      
      // Check if already added
      const alreadyAdded = selectedMaterials.some(m => m.material === material.name)
      if (alreadyAdded) {
        toast.error(`"${material.name}" is already added. Remove it first to change quantity.`)
        return
      }
      
      materialsToAdd.push({
        material: material.name,
        quantity: quantity,
        unit: material.unit,
        materialId: material._id || material.id,
      })
    }
    
    // Show errors for materials exceeding stock
    if (materialsExceedingStock.length > 0) {
      const errorMessage = `Cannot add materials that exceed available stock:\n${materialsExceedingStock.join('\n')}`
      toast.error(errorMessage, {
        duration: 6000,
      })
      return
    }

    // If any materials are missing quantities, show specific error
    if (materialsMissingQuantity.length > 0) {
      const materialsList = materialsMissingQuantity.join(", ")
      toast.error(`Please enter quantities for the following material(s): ${materialsList}`, {
        duration: 5000,
      })
      return
    }

    if (materialsToAdd.length === 0) {
      toast.error("Please select at least one material")
      return
    }

    // Check for duplicates
    const duplicates = materialsToAdd.filter(newMat => 
      selectedMaterials.some(existing => 
        existing.material === newMat.material
      )
    )

    if (duplicates.length > 0) {
      toast.error("Some materials are already added")
      return
    }

    setSelectedMaterials([...selectedMaterials, ...materialsToAdd])
    toast.success(`Added ${materialsToAdd.length} material(s) successfully`)
    
    // Clear selections
    setSelectedMaterialIds(new Set())
    setMaterialSelections({})
  }

  const removeMaterial = (index: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index))
  }

  // Fetch raw materials from database
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        setLoadingMaterials(true)
        const response = await fetch('/api/jaba/raw-materials')
        if (!response.ok) {
          throw new Error('Failed to fetch raw materials')
        }
        const data = await response.json()
        setRawMaterials(data.materials || [])
      } catch (error) {
        console.error('Error fetching raw materials:', error)
        toast.error('Failed to load raw materials')
      } finally {
        setLoadingMaterials(false)
      }
    }
    fetchRawMaterials()
  }, [])

  // Fetch flavors from database
  useEffect(() => {
    const fetchFlavors = async () => {
      try {
        setLoadingFlavors(true)
        const response = await fetch('/api/jaba/flavors')
        
        // Clone response to read it multiple times if needed
        const responseClone = response.clone()
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await responseClone.text()
          console.error('Non-JSON response from flavors API:', text.substring(0, 200))
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
        
        if (response.ok) {
          setFlavors(data.flavors || [])
        } else {
          console.error('Failed to fetch flavors:', data.error)
        }
      } catch (error) {
        console.error('Error fetching flavors:', error)
      } finally {
        setLoadingFlavors(false)
      }
    }
    fetchFlavors()
  }, [])

  const handleAddFlavor = async () => {
    if (!newFlavor.trim()) {
      toast.error("Please enter a flavor name")
      return
    }

    setIsAddingFlavor(true)
    try {
      const response = await fetch('/api/jaba/flavors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFlavor.trim() }),
      })

      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from flavors API:', text.substring(0, 200))
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
        throw new Error(data.error || 'Failed to add flavor')
      }

      toast.success(`Flavor "${newFlavor}" added successfully!`)
      setFlavors([...flavors, data.flavor])
      setNewFlavor("")
      setShowAddFlavor(false)
      setFlavor(data.flavor.name)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add flavor')
    } finally {
      setIsAddingFlavor(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields and collect missing ones
    const missingFields: string[] = []
    
    if (!date || date.trim() === "") {
      missingFields.push("Production Date")
    }
    
    if (!flavor || flavor.trim() === "") {
      missingFields.push("Flavor")
    }
    
    if (!supervisor || supervisor.trim() === "") {
      missingFields.push("Supervisor Name")
    }
    
    if (!expectedLitres || expectedLitres.trim() === "") {
      missingFields.push("Expected Production Volume (Litres)")
    }

    if (!tankNumber || tankNumber.trim() === "") {
      missingFields.push("Tank Number")
    }

    // If there are missing fields, show specific error
    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(", ")
      toast.error(`Please fill in the following required field(s): ${fieldsList}`, {
        duration: 5000,
      })
      return
    }

    // Validate expected litres is a valid positive number
    if (isNaN(Number(expectedLitres)) || Number(expectedLitres) <= 0) {
      toast.error("Expected Production Volume must be a positive number")
      return
    }

    setIsSubmitting(true)

    try {
      // Validate stock availability before submitting
      const invalidMaterials: string[] = []
      for (const mat of selectedMaterials) {
        const material = rawMaterials.find(rm => rm.name === mat.material)
        if (!material) {
          toast.error(`Material ${mat.material} not found in inventory`)
          setIsSubmitting(false)
          return
        }
        const qty = Number(mat.quantity)
        if (qty <= 0) {
          invalidMaterials.push(`${mat.material} (quantity must be greater than 0)`)
          continue
        }
        if (qty > material.currentStock) {
          invalidMaterials.push(`${mat.material} (Available: ${material.currentStock} ${material.unit}, Requested: ${qty} ${material.unit})`)
        }
      }
      
      if (invalidMaterials.length > 0) {
        const errorMessage = `Cannot proceed: Invalid quantities for:\n${invalidMaterials.join('\n')}`
        toast.error(errorMessage, {
          duration: 6000,
        })
        setIsSubmitting(false)
        return
      }

      // Prepare ingredients data with material IDs
      const ingredients = selectedMaterials.map(mat => {
        const material = rawMaterials.find(rm => rm.name === mat.material)
        return {
          material: mat.material,
          materialId: (mat as any).materialId || material?._id || material?.id,
          quantity: Number(mat.quantity),
          unit: mat.unit,
          unitCost: 0,
          totalCost: 0,
        }
      })

      const response = await fetch('/api/jaba/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchNumber,
          date,
          flavor,
          totalLitres: Number(expectedLitres),
          supervisor,
          shift,
          tankNumber: tankNumber.trim(),
          status,
          ingredients,
        }),
      })

      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from batches API:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response. Please check the server logs.')
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await responseClone.text()
        console.error('Failed to parse JSON response:', text.substring(0, 200))
        throw new Error('Invalid JSON response from server. Please check the server logs.')
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to create batch')
      }

      toast.success(`Batch ${batchNumber} created successfully!`)
      // Redirect to batches list page
      router.push('/jaba/batches')
    } catch (error: any) {
      console.error('Error creating batch:', error)
      toast.error(error.message || 'Failed to create batch. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Production Batch</h1>
          <p className="text-sm text-muted-foreground">Plan and create a new manufacturing batch</p>
        </div>
        <Link href="/jaba/batches">
          <Button variant="outline">Cancel</Button>
        </Link>
      </header>

      <form onSubmit={handleSubmit}>
      <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950">
        {/* Batch Information */}
        <Card className="border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <CardHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-red-50/80 to-red-100/40 dark:from-red-950/40 dark:to-red-900/20">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-600 dark:bg-red-700 shadow-sm">
                <Hash className="h-5 w-5 text-white" />
              </div>
              Batch Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Batch Info Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batchNumber" className="font-semibold text-foreground">Batch Number</Label>
                <Input
                  id="batchNumber"
                  value={loadingBatchNumber ? "Loading..." : batchNumber}
                  readOnly
                  disabled={loadingBatchNumber}
                  className="bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-300 dark:border-slate-700 font-mono font-semibold text-indigo-600 dark:text-indigo-400"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {loadingBatchNumber ? "Generating..." : "Auto-generated (sequential by year)"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="font-semibold text-foreground">
                  Production Date <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-2 border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500"
                />
              </div>
            </div>

            {/* Product & Flavor Section */}
            <div className="space-y-4 p-5 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/30 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-600 dark:bg-blue-700 shadow-sm">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <Label className="text-base font-bold text-blue-900 dark:text-blue-100">Product Information</Label>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="flavor" className="font-semibold text-foreground">
                      Flavor <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddFlavor(!showAddFlavor)}
                      className="border-2 font-medium"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add New
                    </Button>
                  </div>
                  {showAddFlavor && (
                    <div className="mb-3 p-3 border-2 border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-900 shadow-md">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter flavor name (e.g., dawa, pineapple)"
                          value={newFlavor}
                          onChange={(e) => setNewFlavor(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFlavor()}
                          className="flex-1 border-2"
                        />
                        <Button
                          type="button"
                          onClick={handleAddFlavor}
                          disabled={isAddingFlavor || !newFlavor.trim()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isAddingFlavor ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddFlavor(false)
                            setNewFlavor("")
                          }}
                          className="border-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <Select value={flavor} onValueChange={setFlavor} disabled={loadingFlavors}>
                    <SelectTrigger className="border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500">
                      <SelectValue placeholder={loadingFlavors ? "Loading flavors..." : "Select flavor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {flavors.map((f) => (
                        <SelectItem key={f._id} value={f.name}>{f.name}</SelectItem>
                      ))}
                      {flavors.length === 0 && !loadingFlavors && (
                        <SelectItem value="none" disabled>No flavors available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-md bg-white/70 dark:bg-slate-900/70 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Product:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-300">Infusion Jaba</span>
                  </div>
                  {flavor && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Flavor:</span>
                      <span className="font-bold text-blue-700 dark:text-blue-300">{flavor}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Production Details Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expectedLitres" className="font-semibold text-foreground">
                  Expected Production Volume (Litres) <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="expectedLitres"
                  type="number"
                  placeholder="Enter litres"
                  value={expectedLitres}
                  onChange={(e) => setExpectedLitres(e.target.value)}
                  min="0"
                  step="0.1"
                  className="border-2 border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift" className="font-semibold text-foreground">
                  Shift <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Select value={shift} onValueChange={setShift}>
                  <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 min-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supervisor & Tank Number Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supervisor" className="font-semibold text-foreground">
                  Supervisor Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="supervisor"
                  placeholder="Enter supervisor name"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="border-2 border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tankNumber" className="font-semibold text-foreground">
                  Tank Number <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="tankNumber"
                  placeholder="e.g., TANK-001"
                  value={tankNumber}
                  onChange={(e) => setTankNumber(e.target.value)}
                  className="border-2 border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500"
                />
              </div>
            </div>

            {/* Status Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status" className="font-semibold text-foreground">Initial Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="border-2 border-slate-300 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="QC Pending">QC Pending</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw Materials */}
        <Card className="border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <CardHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-600 dark:bg-amber-700 shadow-sm">
                <Package className="h-5 w-5 text-white" />
              </div>
              Raw Materials Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                ⚠️ <strong>Important:</strong> Raw materials are deducted immediately from inventory when the batch is created.
              </p>
            </div>

            {/* Notes & Updates Panel */}
            <Card className="border-2 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/50 shadow-sm rounded-2xl md:sticky md:top-4 z-10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Notes & Updates
                  </CardTitle>
                  {stockAlerts.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {stockAlerts.length} alert{stockAlerts.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  These alerts update automatically based on current inventory.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Out of Stock Alerts */}
                {outOfStockAlerts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs font-semibold text-red-700 dark:text-red-300">Out of Stock (Critical)</span>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {outOfStockAlerts.map((alert) => (
                        <div key={alert.material._id || alert.material.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                          <span className="font-medium text-red-900 dark:text-red-100">{alert.material.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-red-700 dark:text-red-300">
                              {alert.material.currentStock} {alert.material.unit}
                            </span>
                            <Badge variant="destructive" className="text-xs px-2 py-0.5">Out of stock</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low Stock Alerts */}
                {lowStockAlerts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Low Stock (Warning)</span>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {lowStockAlerts.map((alert) => {
                        const thresholds = getDefaultThresholds(alert.material.unit)
                        const lowThreshold = alert.material.lowStockThreshold ?? thresholds.low
                        return (
                          <div key={alert.material._id || alert.material.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                            <span className="font-medium text-amber-900 dark:text-amber-100">{alert.material.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-700 dark:text-amber-300">
                                {alert.material.currentStock} {alert.material.unit}
                              </span>
                              <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50">
                                Low stock
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Near Reorder Alerts */}
                {reorderAlerts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Near Reorder (Info)</span>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {reorderAlerts.map((alert) => (
                        <div key={alert.material._id || alert.material.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                          <span className="font-medium text-blue-900 dark:text-blue-100">{alert.material.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-700 dark:text-blue-300">
                              {alert.material.currentStock} {alert.material.unit}
                            </span>
                            <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50">
                              Reorder soon
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Alerts */}
                {stockAlerts.length === 0 && (
                  <div className="text-center py-4">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All materials are well stocked</p>
                  </div>
                )}

                {/* View All Low Stock Link */}
                {(lowStockAlerts.length > 0 || outOfStockAlerts.length > 0) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const firstLowStock = document.querySelector('[data-low-stock="true"]')
                        if (firstLowStock) {
                          firstLowStock.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          firstLowStock.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2')
                          setTimeout(() => {
                            firstLowStock.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2')
                          }, 2000)
                        }
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      View all low stock items
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-foreground text-base">Select Raw Materials</Label>
                {selectedMaterialIds.size > 0 && (() => {
                  // Check if any selected material exceeds stock
                  const hasInvalidQuantities = Array.from(selectedMaterialIds).some(materialId => {
                    const quantity = materialSelections[materialId] || ""
                    const material = rawMaterials.find(rm => (rm._id || rm.id) === materialId)
                    if (!material) return false
                    const qty = Number(quantity) || 0
                    return qty > material.currentStock || qty <= 0
                  })
                  
                  return (
                    <Button 
                      onClick={addSelectedMaterials}
                      disabled={hasInvalidQuantities}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-semibold border-2 border-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add {selectedMaterialIds.size} Selected
                    </Button>
                  )
                })()}
              </div>
              
              {loadingMaterials ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-muted-foreground">Loading raw materials...</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                {rawMaterials.map((rm) => {
                  const materialId = rm._id || rm.id
                  const isSelected = selectedMaterialIds.has(materialId)
                  const alreadyAdded = selectedMaterials.some(m => m.material === rm.name)
                  const quantity = materialSelections[materialId] || ""
                  const qtyNum = Number(quantity) || 0
                  const exceedsStock = qtyNum > rm.currentStock
                  
                  // Determine stock status
                  const thresholds = getDefaultThresholds(rm.unit)
                  const lowThreshold = rm.lowStockThreshold ?? thresholds.low
                  const reorderThreshold = rm.reorderThreshold ?? thresholds.reorder
                  const isOutOfStock = rm.currentStock === 0
                  const isLowStock = !isOutOfStock && rm.currentStock <= lowThreshold
                  const isNearReorder = !isOutOfStock && !isLowStock && rm.currentStock <= reorderThreshold
                  
                  return (
                    <div
                      key={materialId}
                      data-low-stock={isLowStock || isOutOfStock ? "true" : undefined}
                      className={cn(
                        "relative p-4 rounded-lg border-2 transition-all",
                        isOutOfStock 
                          ? "opacity-50 cursor-not-allowed border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                          : isLowStock
                          ? isSelected
                            ? exceedsStock
                              ? "border-red-600 bg-red-50 dark:bg-red-950/30 shadow-md cursor-pointer"
                              : "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-md cursor-pointer"
                            : "border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-600 cursor-pointer"
                          : isSelected
                          ? exceedsStock
                            ? "border-red-600 bg-red-50 dark:bg-red-950/30 shadow-md cursor-pointer"
                            : "border-red-500 bg-red-50 dark:bg-red-950/30 shadow-md cursor-pointer"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer",
                        alreadyAdded && "opacity-60"
                      )}
                      onClick={() => !alreadyAdded && !isOutOfStock && toggleMaterialSelection(materialId)}
                    >
                      {/* Checkbox indicator */}
                      <div className="absolute top-2 right-2">
                        {isSelected ? (
                          <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                        )}
                      </div>

                      {/* Stock Status Badge */}
                      {isOutOfStock && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive" className="text-xs px-2 py-0.5">
                            Out of stock
                          </Badge>
                        </div>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50">
                            Low
                          </Badge>
                        </div>
                      )}

                      {/* Material Info */}
                      <div className={cn("pr-8", (isOutOfStock || isLowStock) && "pt-6")}>
                        <h3 className="font-semibold text-sm mb-1">{rm.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2">{rm.category}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Available:</span>
                          <span className={cn(
                            "font-medium",
                            isOutOfStock ? "text-red-600 dark:text-red-400" : "",
                            isLowStock ? "text-amber-600 dark:text-amber-400" : ""
                          )}>
                            {rm.currentStock} {rm.unit}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Input */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <Label className="text-xs font-medium mb-1 block">
                            Quantity ({rm.unit})
                            <span className="text-muted-foreground ml-1">(Max: {rm.currentStock})</span>
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={quantity}
                            onChange={(e) => {
                              e.stopPropagation()
                              const inputValue = e.target.value
                              // Allow empty string for clearing
                              if (inputValue === "" || inputValue === null) {
                                updateMaterialQuantity(materialId, "")
                                return
                              }
                              const numValue = Number(inputValue)
                              // Prevent negative or exceeding stock
                              if (numValue < 0) {
                                return
                              }
                              if (numValue > rm.currentStock) {
                                // Show error and cap at max
                                toast.error(`Maximum available: ${rm.currentStock} ${rm.unit}`, {
                                  duration: 2000,
                                })
                                updateMaterialQuantity(materialId, rm.currentStock.toString())
                                return
                              }
                              updateMaterialQuantity(materialId, inputValue)
                            }}
                            onBlur={(e) => {
                              // On blur, ensure value doesn't exceed stock
                              const numValue = Number(e.target.value)
                              if (numValue > rm.currentStock) {
                                e.target.value = rm.currentStock.toString()
                                updateMaterialQuantity(materialId, rm.currentStock.toString())
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "h-9 text-sm border-2",
                              exceedsStock 
                                ? "border-red-500 dark:border-red-500 focus:border-red-600 bg-red-50 dark:bg-red-950/20" 
                                : "border-slate-300 dark:border-slate-700"
                            )}
                            min="0"
                            max={rm.currentStock}
                            step="0.1"
                          />
                          {exceedsStock && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Exceeds available stock ({rm.currentStock} {rm.unit})
                            </p>
                          )}
                          {isLowStock && !exceedsStock && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Warning: Stock is low. Available: {rm.currentStock} {rm.unit}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              )}

              {selectedMaterialIds.size > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {selectedMaterialIds.size} material(s) selected. Enter quantities and click "Add Selected" above.
                  </p>
                </div>
              )}
            </div>
            {selectedMaterials.length > 0 && (
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">
                  Selected Materials ({selectedMaterials.length})
                </Label>
                <div className="rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100 dark:bg-slate-800">
                        <TableHead className="font-semibold">Material</TableHead>
                        <TableHead className="font-semibold">Quantity</TableHead>
                        <TableHead className="font-semibold">Unit</TableHead>
                        <TableHead className="w-[100px] font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMaterials.map((mat, index) => (
                        <TableRow key={index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell className="font-medium">{mat.material}</TableCell>
                          <TableCell className="font-semibold">{mat.quantity}</TableCell>
                          <TableCell className="text-muted-foreground">{mat.unit}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                removeMaterial(index)
                                toast.success(`${mat.material} removed`)
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Remove material"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedMaterials.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No materials added yet</p>
                <p className="text-xs mt-1">Select a material and quantity above to add</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Link href="/jaba/batches">
            <Button 
              type="button"
              variant="outline" 
              className="border-slate-300 dark:border-slate-700"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit"
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 shadow-lg shadow-orange-500/30 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Batch
              </>
            )}
          </Button>
        </div>
      </div>
      </form>
    </>
  )
}
