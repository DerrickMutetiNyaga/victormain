"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Package, Tag, Scale, Warehouse, TrendingUp, Building2, Loader2, Plus, X, Edit, Trash2, Calendar, FileText, DollarSign } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect } from "react"

export default function AddRawMaterialPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [suppliers, setSuppliers] = useState<{ _id: string; name: string }[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<{ _id: string; name: string; category: string; unit: string; currentStock: number; minStock: number; reorderLevel: number; supplier: string; preferredSupplier?: string }[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [supplyType, setSupplyType] = useState<"new" | "resupply">("new")
  const [supplyActionID, setSupplyActionID] = useState<1 | 2>(1)
  const [displayCurrentStock, setDisplayCurrentStock] = useState<string>("")
  const [priceInputMode, setPriceInputMode] = useState<"perUnit" | "total">("perUnit")
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "",
    currentStock: "",
    minStock: "",
    reorderLevel: "",
    supplier: "",
    preferredSupplier: "",
    // Supply fields
    supplyDate: new Date().toISOString().split('T')[0],
    batchNumber: "",
    lotNumber: "",
    buyingPrice: "",
    totalCost: "",
    quantityAdded: "", // For resupply
    existingStock: "", // For resupply (read-only)
    pricePerUnit: "", // Calculated when total amount is entered
  })

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
    fetchRawMaterials()
  }, [])

  // Debug: Log formData changes
  useEffect(() => {
    console.log('FormData updated - existingStock:', formData.existingStock)
    console.log('FormData updated - currentStock:', formData.currentStock)
    console.log('FormData updated - quantityAdded:', formData.quantityAdded)
  }, [formData.existingStock, formData.currentStock, formData.quantityAdded])

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

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      const response = await fetch('/api/jaba/suppliers')
      const data = await response.json()
      if (response.ok) {
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchRawMaterials = async () => {
    try {
      setLoadingMaterials(true)
      const response = await fetch('/api/jaba/raw-materials')
      const data = await response.json()
      if (response.ok) {
        const materials = data.materials || []
        console.log('Fetched raw materials:', materials)
        // Log first material structure if available
        if (materials.length > 0) {
          console.log('First material structure:', materials[0])
          console.log('First material currentStock:', materials[0].currentStock, typeof materials[0].currentStock)
        }
        setRawMaterials(materials)
      }
    } catch (error) {
      console.error('Error fetching raw materials:', error)
      toast.error('Failed to load raw materials')
    } finally {
      setLoadingMaterials(false)
    }
  }

  const handleSupplyTypeChange = (type: "new" | "resupply") => {
    setSupplyType(type)
    setSupplyActionID(type === "new" ? 1 : 2)
    setDisplayCurrentStock("") // Reset display value
    
    // Reset form based on supply type
    if (type === "new") {
      setFormData({
        name: "",
        category: "",
        unit: "",
        currentStock: "",
        minStock: "",
        reorderLevel: "",
        supplier: "",
        preferredSupplier: "",
        supplyDate: new Date().toISOString().split('T')[0],
        batchNumber: "",
        lotNumber: "",
        buyingPrice: "",
        totalCost: "",
        quantityAdded: "",
        existingStock: "",
        pricePerUnit: "",
      })
    } else {
      // Resupply mode - keep supplier if selected
      setFormData({
        name: "",
        category: "",
        unit: "",
        currentStock: "",
        minStock: "",
        reorderLevel: "",
        supplier: formData.supplier || "",
        preferredSupplier: formData.preferredSupplier || "",
        supplyDate: new Date().toISOString().split('T')[0],
        batchNumber: "",
        lotNumber: "",
        buyingPrice: "",
        totalCost: "",
        quantityAdded: "",
        existingStock: "",
        pricePerUnit: "",
      })
    }
  }

  const handleMaterialSelect = (value: string) => {
    console.log('handleMaterialSelect called with value:', value)
    console.log('Current supplyType:', supplyType)
    console.log('Available materials:', rawMaterials.length)
    
    if (supplyType === "resupply") {
      // For resupply, load existing material data
      const selectedMaterial = rawMaterials.find(m => m.name === value)
      console.log('Found material:', selectedMaterial)
      
      if (selectedMaterial) {
        // Safely convert currentStock to string
        let currentStockValue = "0"
        if (selectedMaterial.currentStock != null && selectedMaterial.currentStock !== undefined) {
          if (typeof selectedMaterial.currentStock === 'number') {
            currentStockValue = String(selectedMaterial.currentStock)
          } else if (typeof selectedMaterial.currentStock === 'string') {
            currentStockValue = selectedMaterial.currentStock
          } else {
            currentStockValue = String(selectedMaterial.currentStock)
          }
        }
        
        console.log('=== Material Selection Debug ===')
        console.log('Selected material name:', selectedMaterial.name)
        console.log('Raw currentStock:', selectedMaterial.currentStock, 'Type:', typeof selectedMaterial.currentStock)
        console.log('Converted currentStockValue:', currentStockValue)
        console.log('Full material object:', JSON.stringify(selectedMaterial, null, 2))
        console.log('================================')
        
        // Set display value immediately
        setDisplayCurrentStock(currentStockValue)
        
        setFormData(prev => {
          const updated = {
            ...prev,
            name: selectedMaterial.name || "",
            category: selectedMaterial.category || "",
            unit: selectedMaterial.unit || "",
            existingStock: currentStockValue, // This goes to "Current Stock" field
            currentStock: "", // This will be calculated when quantityAdded is entered
            supplier: selectedMaterial.supplier || prev.supplier || "",
            preferredSupplier: selectedMaterial.preferredSupplier || selectedMaterial.supplier || prev.preferredSupplier || "",
            quantityAdded: "", // Reset quantity added
          }
          console.log('=== State Update ===')
          console.log('Updated formData:', JSON.stringify(updated, null, 2))
          console.log('existingStock value:', updated.existingStock)
          console.log('existingStock type:', typeof updated.existingStock)
          console.log('displayCurrentStock:', currentStockValue)
          console.log('====================')
          return updated
        })
        
        toast.success(`Loaded "${selectedMaterial.name}" - Current Stock: ${currentStockValue} ${selectedMaterial.unit || ""}`)
      } else {
        console.error('Material not found:', value)
        toast.error(`Material "${value}" not found`)
      }
    } else {
      console.log('Not in resupply mode, skipping material selection logic')
    }
  }

  // Calculate total cost or price per unit based on input mode
  useEffect(() => {
    if (priceInputMode === "perUnit") {
      // User enters price per unit - calculate total
      if (supplyType === "new" && formData.buyingPrice && formData.currentStock) {
        const pricePerUnit = Number(formData.buyingPrice) || 0
        const quantity = Number(formData.currentStock) || 0
        const total = pricePerUnit * quantity
        if (total > 0) {
          setFormData(prev => ({ ...prev, totalCost: total.toFixed(2), pricePerUnit: pricePerUnit.toFixed(2) }))
        }
      } else if (supplyType === "resupply" && formData.buyingPrice && formData.quantityAdded) {
        const pricePerUnit = Number(formData.buyingPrice) || 0
        const quantity = Number(formData.quantityAdded) || 0
        const total = pricePerUnit * quantity
        if (total > 0) {
          setFormData(prev => ({ ...prev, totalCost: total.toFixed(2), pricePerUnit: pricePerUnit.toFixed(2) }))
        }
      } else if (formData.buyingPrice && (!formData.currentStock && !formData.quantityAdded)) {
        // Clear total cost if quantity is cleared
        setFormData(prev => ({ ...prev, totalCost: "", pricePerUnit: formData.buyingPrice }))
      }
    } else {
      // User enters total amount - calculate price per unit
      if (supplyType === "new" && formData.totalCost && formData.currentStock) {
        const total = Number(formData.totalCost) || 0
        const quantity = Number(formData.currentStock) || 1
        if (quantity > 0 && total > 0) {
          const perUnit = total / quantity
          setFormData(prev => ({ ...prev, buyingPrice: perUnit.toFixed(2), pricePerUnit: perUnit.toFixed(2) }))
        }
      } else if (supplyType === "resupply" && formData.totalCost && formData.quantityAdded) {
        const total = Number(formData.totalCost) || 0
        const quantity = Number(formData.quantityAdded) || 1
        if (quantity > 0 && total > 0) {
          const perUnit = total / quantity
          setFormData(prev => ({ ...prev, buyingPrice: perUnit.toFixed(2), pricePerUnit: perUnit.toFixed(2) }))
        }
      } else if (formData.totalCost && (!formData.currentStock && !formData.quantityAdded)) {
        // Clear price per unit if quantity is cleared
        setFormData(prev => ({ ...prev, buyingPrice: "", pricePerUnit: "" }))
      }
    }
  }, [formData.buyingPrice, formData.totalCost, formData.currentStock, formData.quantityAdded, supplyType, priceInputMode])

  // Calculate new total stock for resupply - updates immediately
  useEffect(() => {
    if (supplyType === "resupply" && formData.existingStock) {
      const existing = Number(formData.existingStock) || 0
      const added = Number(formData.quantityAdded) || 0
      const newTotal = existing + added
      
      setFormData(prev => {
        // Only update if the value has changed to avoid infinite loops
        if (prev.currentStock !== String(newTotal)) {
          console.log('useEffect calculation - Existing:', existing, '+ Added:', added, '= New Total:', newTotal)
          return { ...prev, currentStock: String(newTotal) }
        }
        return prev
      })
    }
  }, [formData.existingStock, formData.quantityAdded, supplyType])

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
      setFormData({ ...formData, category: newCategoryName.trim() })
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate based on supply type
    if (supplyType === "new" || supplyActionID === 1) {
      // NEW SUPPLY validation
      if (!formData.name || !formData.category || !formData.unit || !formData.currentStock || !formData.minStock || !formData.reorderLevel || !formData.supplier || !formData.supplyDate) {
        toast.error("Please fill in all required fields for new supply")
        return
      }
    } else if (supplyType === "resupply" || supplyActionID === 2) {
      // RESUPPLY validation
      if (!formData.name || !formData.quantityAdded || !formData.supplier || !formData.supplyDate) {
        toast.error("Please fill in all required fields for resupply")
      return
      }
    }

    // Validate numeric fields
    if (isNaN(Number(formData.currentStock)) || Number(formData.currentStock) < 0) {
      toast.error("Current stock must be a valid number")
      return
    }

    setIsSubmitting(true)

    try {
      if (supplyType === "new" || supplyActionID === 1) {
        // NEW SUPPLY LOGIC: Create new material and stock record
      const response = await fetch('/api/jaba/raw-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: formData.category,
          unit: formData.unit,
          currentStock: Number(formData.currentStock),
            minStock: Number(formData.minStock) || 0,
            reorderLevel: Number(formData.reorderLevel) || 0,
          supplier: formData.supplier.trim(),
          preferredSupplier: formData.preferredSupplier.trim() || formData.supplier.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create raw material')
      }

        // Create supplier history entry for new supply
        if (formData.supplyDate && formData.supplier) {
          try {
            await fetch('/api/jaba/supplier-history', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                supplierName: formData.supplier.trim(),
                itemName: formData.name.trim(),
                quantity: Number(formData.currentStock),
                unit: formData.unit,
                date: formData.supplyDate,
                type: "Restock",
                batchNumber: formData.batchNumber.trim() || undefined,
                lotNumber: formData.lotNumber.trim() || undefined,
                cost: formData.totalCost ? Number(formData.totalCost) : undefined,
              }),
            })
          } catch (historyError) {
            console.error('Error creating supplier history:', historyError)
          }
        }

        toast.success(`New material "${formData.name}" created successfully!`)
      } else if (supplyType === "resupply" || supplyActionID === 2) {
        // RESUPPLY LOGIC: Update existing material stock
        const existingMaterial = rawMaterials.find(m => m.name === formData.name)
        if (!existingMaterial) {
          toast.error("Material not found. Please select an existing material.")
          setIsSubmitting(false)
          return
        }

        // Update the material's current stock
        const newStock = Number(formData.existingStock) + Number(formData.quantityAdded)
        const response = await fetch('/api/jaba/raw-materials', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: existingMaterial._id,
            name: existingMaterial.name,
            category: existingMaterial.category,
            currentStock: newStock,
            unit: existingMaterial.unit,
            minStock: existingMaterial.minStock,
            supplier: formData.supplier.trim() || existingMaterial.supplier,
            reorderLevel: existingMaterial.reorderLevel,
            preferredSupplier: formData.preferredSupplier.trim() || existingMaterial.preferredSupplier || formData.supplier.trim() || existingMaterial.supplier,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update material stock')
        }

        // Create supplier history entry for resupply
        try {
          await fetch('/api/jaba/supplier-history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              supplierName: formData.supplier.trim(),
              itemName: formData.name.trim(),
              quantity: Number(formData.quantityAdded),
              unit: existingMaterial.unit,
              date: formData.supplyDate,
              type: "Restock",
              batchNumber: formData.batchNumber.trim() || undefined,
              lotNumber: formData.lotNumber.trim() || undefined,
              cost: formData.totalCost ? Number(formData.totalCost) : undefined,
            }),
          })
        } catch (historyError) {
          console.error('Error creating supplier history:', historyError)
        }

        toast.success(`Resupply completed! "${formData.name}" stock updated to ${newStock} ${existingMaterial.unit}`)
      }

      router.push('/jaba/raw-materials')
    } catch (error: any) {
      console.error('Error processing supply:', error)
      toast.error(error.message || 'Failed to process supply. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Raw Material</h1>
            <p className="text-sm text-muted-foreground">Create a new raw material entry</p>
          </div>
        </div>
        <Link href="/jaba/raw-materials">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-200 dark:border-amber-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Material Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Supply Type Selector */}
              <div className="space-y-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Supply Type <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={supplyType === "new" ? "default" : "outline"}
                    onClick={() => handleSupplyTypeChange("new")}
                    className={supplyType === "new" 
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white" 
                      : "border-2"}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Supply
                  </Button>
                  <Button
                    type="button"
                    variant={supplyType === "resupply" ? "default" : "outline"}
                    onClick={() => handleSupplyTypeChange("resupply")}
                    className={supplyType === "resupply" 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white" 
                      : "border-2"}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Resupply
                  </Button>
                </div>
                {/* Hidden fields for controlling logic */}
                <input type="hidden" name="supplyType" value={supplyType} />
                <input type="hidden" name="supplyActionID" value={supplyActionID} />
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  {supplyType === "new" ? "New Material Information" : "Material Selection"}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="materialName" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      {supplyType === "new" ? "Material Name" : "Select Existing Material"} <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    {supplyType === "new" ? (
                    <Input
                      id="materialName"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter new material name"
                      required
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                    ) : (
                      <Select 
                        value={formData.name || undefined} 
                        onValueChange={(value) => handleMaterialSelect(value)} 
                        required
                        disabled={loadingMaterials}
                      >
                        <SelectTrigger id="materialName" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                          <SelectValue placeholder={loadingMaterials ? "Loading materials..." : "Select material"} />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials.length > 0 ? (
                            rawMaterials.map((material) => (
                              <SelectItem key={material._id} value={material.name}>
                                {material.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              {loadingMaterials ? "Loading..." : "No materials available"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {supplyType === "new" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Category <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddCategory(true)}
                        className="border-2 border-blue-300 dark:border-blue-700 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-8 text-xs"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Category
                      </Button>
                    </div>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                      <SelectTrigger id="category" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length > 0 ? (
                          categories.map((cat) => (
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
                  )}
                </div>
              </div>

              {/* Stock Information - Different for New vs Resupply */}
              {supplyType === "new" ? (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-green-500 dark:text-green-400" />
                  Stock Information
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="openingStock" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Initial Stock Amount <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Input
                      id="openingStock"
                      type="number"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                      placeholder="0"
                      required
                      min="0"
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 tabular-nums"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Unit <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })} required>
                      <SelectTrigger id="unit" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="litres">Litres</SelectItem>
                        <SelectItem value="kg">Kilograms</SelectItem>
                        <SelectItem value="pcs">Pieces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Min Stock <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Input
                      id="minStock"
                      type="number"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      placeholder="0"
                      required
                      min="0"
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorderLevel" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-red-500 dark:text-red-400" />
                    Reorder Level <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                  </Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    placeholder="0"
                    required
                    min="0"
                    className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 tabular-nums"
                  />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    Resupply Stock Information
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="existingStock" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Current Stock
                      </Label>
                      <div>
                        <Input
                          key={`existingStock-${formData.name}`}
                          id="existingStock"
                          type="text"
                          value={displayCurrentStock || formData.existingStock || ""}
                          readOnly
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 tabular-nums font-semibold"
                        />
                        {(!displayCurrentStock && !formData.existingStock) && formData.name && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            No stock data found for this material
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantityAdded" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Quantity Being Added <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                      </Label>
                      <Input
                        id="quantityAdded"
                        type="number"
                        value={formData.quantityAdded}
                        onChange={(e) => {
                          const value = e.target.value
                          console.log('Quantity changed to:', value)
                          // Immediately calculate new total stock
                          setFormData(prev => {
                            const updated = { ...prev, quantityAdded: value }
                            if (supplyType === "resupply" && prev.existingStock) {
                              const existing = Number(prev.existingStock) || 0
                              const added = value ? (Number(value) || 0) : 0
                              const newTotal = existing + added
                              updated.currentStock = String(newTotal)
                              console.log('=== Immediate Calculation ===')
                              console.log('Existing Stock:', existing)
                              console.log('Quantity Added:', added)
                              console.log('New Total Stock:', newTotal)
                              console.log('Updated currentStock field:', updated.currentStock)
                              console.log('============================')
                            } else if (supplyType === "resupply" && !prev.existingStock) {
                              updated.currentStock = ""
                            }
                            return updated
                          })
                        }}
                        placeholder="0"
                        required
                        min="0"
                        className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 tabular-nums"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="newTotalStock" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        New Total Stock
                      </Label>
                      <Input
                        key={`newTotalStock-${formData.name}-${formData.quantityAdded}`}
                        id="newTotalStock"
                        type="text"
                        value={(() => {
                          // Use the same source as Current Stock field
                          const existingStockValue = displayCurrentStock || formData.existingStock
                          const quantityAdded = formData.quantityAdded
                          
                          console.log('=== New Total Stock Calculation ===')
                          console.log('displayCurrentStock:', displayCurrentStock)
                          console.log('formData.existingStock:', formData.existingStock)
                          console.log('existingStockValue (used):', existingStockValue)
                          console.log('quantityAdded:', quantityAdded)
                          
                          if (existingStockValue && quantityAdded) {
                            const existing = Number(existingStockValue) || 0
                            const added = Number(quantityAdded) || 0
                            const total = existing + added
                            console.log('Calculated total:', existing, '+', added, '=', total)
                            return String(total)
                          } else if (existingStockValue && !quantityAdded) {
                            console.log('No quantity added, showing existing:', existingStockValue)
                            return existingStockValue
                          }
                          console.log('No data available')
                          return ""
                        })()}
                        readOnly
                        placeholder={
                          (displayCurrentStock || formData.existingStock || formData.name) 
                            ? (formData.quantityAdded ? "" : "Enter quantity to calculate") 
                            : "Select a material first"
                        }
                        className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-green-50 dark:bg-green-950/30 tabular-nums font-semibold text-green-700 dark:text-green-300"
                      />
                    </div>
                  </div>
                </div>
              )}


              {/* Supply Information */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Supply Information
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplyDate" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      Date Supplied <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Input
                      id="supplyDate"
                      type="date"
                      value={formData.supplyDate}
                      onChange={(e) => setFormData({ ...formData, supplyDate: e.target.value })}
                      required
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Price Input Mode:
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={priceInputMode === "perUnit" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setPriceInputMode("perUnit")
                            setFormData(prev => ({ ...prev, totalCost: "" }))
                          }}
                          className={priceInputMode === "perUnit" 
                            ? "bg-green-600 hover:bg-green-700 text-white" 
                            : "border-2"}
                        >
                          Price Per Unit
                        </Button>
                        <Button
                          type="button"
                          variant={priceInputMode === "total" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setPriceInputMode("total")
                            setFormData(prev => ({ ...prev, buyingPrice: "" }))
                          }}
                          className={priceInputMode === "total" 
                            ? "bg-blue-600 hover:bg-blue-700 text-white" 
                            : "border-2"}
                        >
                          Total Amount
                        </Button>
                      </div>
                    </div>
                  </div>
                  {priceInputMode === "perUnit" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="buyingPrice" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                          Buying Price Per Unit
                        </Label>
                        <Input
                          id="buyingPrice"
                          type="number"
                          step="0.01"
                          value={formData.buyingPrice}
                          onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 tabular-nums"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="totalCost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Total Cost (Auto Calculated)
                        </Label>
                        <Input
                          id="totalCost"
                          type="number"
                          step="0.01"
                          value={formData.totalCost}
                          readOnly
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 tabular-nums font-semibold"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="totalCost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Total Amount
                        </Label>
                        <Input
                          id="totalCost"
                          type="number"
                          step="0.01"
                          value={formData.totalCost}
                          onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 tabular-nums"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pricePerUnit" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                          Price Per Unit (Auto Calculated)
                        </Label>
                        <Input
                          id="pricePerUnit"
                          type="number"
                          step="0.01"
                          value={formData.pricePerUnit || formData.buyingPrice}
                          readOnly
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 tabular-nums font-semibold"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="batchNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <FileText className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      Batch Number
                    </Label>
                    <Input
                      id="batchNumber"
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                      placeholder="Enter batch number (optional)"
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lotNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <FileText className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                      Lot Number
                    </Label>
                    <Input
                      id="lotNumber"
                      value={formData.lotNumber}
                      onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                      placeholder="Enter lot number (optional)"
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  Supplier Information
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Supplier <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    <Select 
                      value={formData.supplier}
                      onValueChange={(value) => setFormData({ ...formData, supplier: value })} 
                      required
                      disabled={loadingSuppliers}
                    >
                      <SelectTrigger id="supplier" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500">
                        <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select supplier"} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.length > 0 ? (
                          suppliers.map((supplier) => (
                            <SelectItem key={supplier._id} value={supplier.name}>
                              {supplier.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {loadingSuppliers ? "Loading..." : "No suppliers available"}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredSupplier" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Preferred Supplier
                    </Label>
                    <Input
                      id="preferredSupplier"
                      value={formData.preferredSupplier}
                      onChange={(e) => setFormData({ ...formData, preferredSupplier: e.target.value })}
                      placeholder="Preferred supplier (optional)"
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
                <Link href="/jaba/raw-materials">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 h-11 px-6 font-semibold"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/30 h-11 px-6 font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Material
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
