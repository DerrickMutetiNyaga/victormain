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
import { useEffect, useMemo } from "react"

type JabaRawMaterialRow = {
  _id: string
  name: string
  category: string
  unit: string
  currentStock: number | string
  minStock?: number
  reorderLevel?: number
  supplier: string
  preferredSupplier?: string
  packagingStickerFlavor?: string | null
}

export default function AddRawMaterialPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [suppliers, setSuppliers] = useState<{ _id: string; name: string }[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [rawMaterials, setRawMaterials] = useState<JabaRawMaterialRow[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [supplyType, setSupplyType] = useState<"new" | "resupply">("new")
  const [supplyActionID, setSupplyActionID] = useState<1 | 2>(1)
  /** Resupply: stable row identity — avoids duplicate names and stale name-based lookups */
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [priceInputMode, setPriceInputMode] = useState<"perUnit" | "total">("perUnit")

  type PackagingTemplate = "bottles" | "stickers" | "custom"
  type PackagingSize = "250ml" | "500ml" | "1L" | "2L"
  const [packagingTemplate, setPackagingTemplate] = useState<PackagingTemplate>("bottles")
  const [packagingSize, setPackagingSize] = useState<PackagingSize>("500ml")
  /** Must align with batch / flavour-line names for correct packing deductions. */
  const [packagingStickerFlavor, setPackagingStickerFlavor] = useState("")
  const [flavorCatalog, setFlavorCatalog] = useState<{ _id: string; name: string }[]>([])
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
    fetchFlavorCatalog()
  }, [])

  const fetchFlavorCatalog = async () => {
    try {
      const response = await fetch("/api/jaba/flavors")
      const data = await response.json()
      if (response.ok) {
        setFlavorCatalog(data.flavors || [])
      }
    } catch {
      /* optional */
    }
  }

  // When creating Packaging raw materials, auto-generate the exact name pattern
  // so packaging deduction can reliably find the correct bottle/sticker row.
  useEffect(() => {
    if (supplyType !== "new") return
    if (formData.category !== "Packaging") return
    if (packagingTemplate === "custom") return

    const f = packagingStickerFlavor.trim()
    const derivedName =
      packagingTemplate === "bottles"
        ? `${packagingSize} Bottles`
        : f
          ? `${packagingSize} ${f} Stickers`
          : `${packagingSize} Stickers`

    setFormData((prev) => ({
      ...prev,
      name: derivedName,
      unit: "pcs",
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category, packagingTemplate, packagingSize, packagingStickerFlavor, supplyType])

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
    setSelectedMaterialId(null)

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
      setPackagingTemplate("bottles")
      setPackagingSize("500ml")
      setPackagingStickerFlavor("")
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

  const handleMaterialSelect = (materialId: string) => {
    if (supplyType !== "resupply") return

    setSelectedMaterialId(materialId)
    const selectedMaterial = rawMaterials.find((m) => m._id === materialId)

    if (!selectedMaterial) {
      toast.error("Material not found. Refresh the page and try again.")
      setSelectedMaterialId(null)
      return
    }

    let currentStockValue = "0"
    if (selectedMaterial.currentStock != null && selectedMaterial.currentStock !== undefined) {
      currentStockValue =
        typeof selectedMaterial.currentStock === "number"
          ? String(selectedMaterial.currentStock)
          : String(selectedMaterial.currentStock)
    }

    const supplierName = String(selectedMaterial.supplier ?? "").trim()
    const preferredName = String(
      selectedMaterial.preferredSupplier ?? selectedMaterial.supplier ?? ""
    ).trim()

    setPackagingStickerFlavor(
      typeof selectedMaterial.packagingStickerFlavor === "string"
        ? selectedMaterial.packagingStickerFlavor
        : ""
    )

    setFormData((prev) => {
      const existing = Number(currentStockValue) || 0
      return {
        ...prev,
        name: selectedMaterial.name || "",
        category: selectedMaterial.category || "",
        unit: selectedMaterial.unit || "",
        minStock:
          selectedMaterial.minStock !== undefined && selectedMaterial.minStock !== null
            ? String(selectedMaterial.minStock)
            : "",
        reorderLevel:
          selectedMaterial.reorderLevel !== undefined && selectedMaterial.reorderLevel !== null
            ? String(selectedMaterial.reorderLevel)
            : "",
        existingStock: currentStockValue,
        currentStock: String(existing),
        supplier: supplierName || prev.supplier,
        preferredSupplier: preferredName || supplierName || prev.preferredSupplier,
        quantityAdded: "",
        batchNumber: "",
        lotNumber: "",
        buyingPrice: "",
        totalCost: "",
        pricePerUnit: "",
      }
    })

    toast.success(
      `Loaded "${selectedMaterial.name}" — current stock: ${currentStockValue} ${selectedMaterial.unit || ""}`
    )
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
      } else if (
        supplyType === "new" &&
        formData.buyingPrice &&
        !formData.currentStock &&
        !formData.quantityAdded
      ) {
        // Clear total cost if quantity is cleared (new supply only — resupply uses quantityAdded for pricing)
        setFormData((prev) => ({ ...prev, totalCost: "", pricePerUnit: prev.buyingPrice }))
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
      } else if (
        supplyType === "new" &&
        formData.totalCost &&
        !formData.currentStock &&
        !formData.quantityAdded
      ) {
        // Clear price per unit if quantity is cleared (new supply only)
        setFormData((prev) => ({ ...prev, buyingPrice: "", pricePerUnit: "" }))
      }
    }
  }, [formData.buyingPrice, formData.totalCost, formData.currentStock, formData.quantityAdded, supplyType, priceInputMode])

  // Calculate new total stock for resupply when quantity changes (keeps currentStock in sync with existing + added)
  useEffect(() => {
    if (supplyType !== "resupply") return
    if (formData.existingStock === "" && !selectedMaterialId) return

    const existing = Number(formData.existingStock) || 0
    const added = formData.quantityAdded === "" ? 0 : Number(formData.quantityAdded) || 0
    const newTotal = existing + added

    setFormData((prev) => {
      if (prev.currentStock === String(newTotal)) return prev
      return { ...prev, currentStock: String(newTotal) }
    })
  }, [formData.existingStock, formData.quantityAdded, supplyType, selectedMaterialId])

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
      setFormData((prev) => ({ ...prev, category: newCategoryName.trim() }))
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const supplierSelectList = useMemo(() => {
    const list = [...suppliers]
    const names = new Set(suppliers.map((s) => s.name))
    const s = formData.supplier?.trim()
    if (s && !names.has(s)) {
      list.push({ _id: `__legacy_supplier__${s}`, name: s })
    }
    return list
  }, [suppliers, formData.supplier])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (supplyType === "new") {
      const missing: string[] = []
      if (!formData.name?.trim()) missing.push("material name")
      if (!formData.category?.trim()) missing.push("category")
      if (!formData.unit?.trim()) missing.push("unit")
      if (formData.currentStock === "" || formData.currentStock === undefined) missing.push("initial stock")
      if (formData.minStock === "" || formData.minStock === undefined) missing.push("min stock")
      if (formData.reorderLevel === "" || formData.reorderLevel === undefined) missing.push("reorder level")
      if (!formData.supplier?.trim()) missing.push("supplier")
      if (!formData.supplyDate) missing.push("date supplied")
      if (missing.length) {
        toast.error(`New supply: missing ${missing.join(", ")}`)
        return
      }
      if (isNaN(Number(formData.currentStock)) || Number(formData.currentStock) < 0) {
        toast.error("Initial stock must be a valid number (zero or greater)")
        return
      }
    } else {
      if (!selectedMaterialId) {
        toast.error("Select an existing material to resupply")
        return
      }
      const existingMaterial = rawMaterials.find((m) => m._id === selectedMaterialId)
      if (!existingMaterial) {
        toast.error("Selected material is no longer available. Refresh and try again.")
        return
      }
      if (!formData.supplier?.trim()) {
        toast.error("Select a supplier for this resupply")
        return
      }
      if (!formData.supplyDate) {
        toast.error("Choose the date supplied")
        return
      }
      const qty = Number(formData.quantityAdded)
      if (formData.quantityAdded === "" || Number.isNaN(qty) || qty <= 0) {
        toast.error("Enter the quantity you are adding (must be greater than zero)")
        return
      }
    }

    if (
      supplyType === "new" &&
      formData.category === "Packaging" &&
      packagingTemplate === "stickers" &&
      !packagingStickerFlavor.trim()
    ) {
      toast.error("Enter the sticker flavour (e.g. Mango). It must match the flavour line name used when packing.")
      return
    }

    setIsSubmitting(true)

    try {
      if (supplyType === "new") {
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
          packagingStickerFlavor:
            formData.category === "Packaging" && packagingTemplate === "stickers"
              ? packagingStickerFlavor.trim()
              : undefined,
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
      } else if (supplyType === "resupply") {
        // RESUPPLY LOGIC: Update existing material stock
        const existingMaterial = rawMaterials.find((m) => m._id === selectedMaterialId)
        if (!existingMaterial) {
          toast.error("Material not found. Please select an existing material.")
          setIsSubmitting(false)
          return
        }

        const existingNum = Number(formData.existingStock)
        const addedNum = Number(formData.quantityAdded)
        const newStock =
          (Number.isFinite(existingNum) ? existingNum : Number(existingMaterial.currentStock) || 0) +
          (Number.isFinite(addedNum) ? addedNum : 0)

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
            minStock: Number(existingMaterial.minStock ?? 0),
            supplier: formData.supplier.trim() || String(existingMaterial.supplier ?? "").trim(),
            reorderLevel: Number(existingMaterial.reorderLevel ?? 0),
            preferredSupplier:
              formData.preferredSupplier.trim() ||
              String(existingMaterial.preferredSupplier ?? "").trim() ||
              formData.supplier.trim() ||
              String(existingMaterial.supplier ?? "").trim(),
            ...(typeof existingMaterial.packagingStickerFlavor === "string"
              ? { packagingStickerFlavor: existingMaterial.packagingStickerFlavor }
              : {}),
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
                  {supplyType === "new" && (
                  <div className="space-y-2 md:order-1">
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
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, category: value }))
                      }
                      required
                    >
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

                    {formData.category === "Packaging" && (
                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            Packaging Type <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                          </Label>
                          <Select value={packagingTemplate} onValueChange={(v) => setPackagingTemplate(v as any)}>
                            <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                              <SelectValue placeholder="Select packaging type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bottles">Bottles</SelectItem>
                              <SelectItem value="stickers">Stickers</SelectItem>
                              <SelectItem value="custom">Custom (manual name)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {packagingTemplate !== "custom" && (
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              Size <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                            </Label>
                            <Select value={packagingSize} onValueChange={(v) => setPackagingSize(v as any)}>
                              <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="250ml">250ml</SelectItem>
                                <SelectItem value="500ml">500ml</SelectItem>
                                <SelectItem value="1L">1L</SelectItem>
                                <SelectItem value="2L">2L</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {packagingTemplate === "stickers" && (
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              Sticker flavour <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                            </Label>
                            {flavorCatalog.length === 0 ? (
                              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                No flavours found in the system yet. On <strong>Batches</strong>, open{" "}
                                <strong>Manage Flavours</strong> to add flavours first, then return here to choose one for
                                this sticker item.
                              </p>
                            ) : (
                              <Select
                                value={packagingStickerFlavor || undefined}
                                onValueChange={(v) => setPackagingStickerFlavor(v)}
                              >
                                <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                                  <SelectValue placeholder="Choose flavour from list (same as Manage Flavours)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {flavorCatalog.map((f) => (
                                    <SelectItem key={f._id} value={f.name}>
                                      {f.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Pick the exact name from your flavour master list so packing deducts the right sticker stock.
                            </p>
                          </div>
                        )}

                        {packagingTemplate !== "custom" && (
                          <p className="text-xs text-muted-foreground">
                            Auto name: <span className="font-semibold">{formData.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                  <div className={`space-y-2 ${supplyType === "new" ? "md:order-2" : "md:col-span-2"}`}>
                    <Label htmlFor="materialName" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      {supplyType === "new" ? "Material Name" : "Select Existing Material"} <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                    </Label>
                    {supplyType === "new" ? (
                    <Input
                      id="materialName"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                        placeholder="Enter new material name"
                        disabled={formData.category === "Packaging" && packagingTemplate !== "custom"}
                      required
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                    ) : (
                      <Select 
                        value={selectedMaterialId ?? undefined} 
                        onValueChange={handleMaterialSelect} 
                        required
                        disabled={loadingMaterials}
                      >
                        <SelectTrigger id="materialName" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500">
                          <SelectValue placeholder={loadingMaterials ? "Loading materials..." : "Select material"} />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials.length > 0 ? (
                            rawMaterials.map((material) => (
                              <SelectItem key={material._id} value={material._id}>
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
                      step="any"
                      value={formData.currentStock}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, currentStock: e.target.value }))
                      }
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
                    <Select
                      value={formData.category === "Packaging" && packagingTemplate !== "custom" ? "pcs" : formData.unit}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, unit: value }))
                      }
                      required
                      disabled={formData.category === "Packaging" && packagingTemplate !== "custom"}
                    >
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
                      step="any"
                      value={formData.minStock}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, minStock: e.target.value }))
                      }
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
                    step="any"
                    value={formData.reorderLevel}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, reorderLevel: e.target.value }))
                    }
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
                          key={`existingStock-${selectedMaterialId ?? "none"}`}
                          id="existingStock"
                          type="text"
                          value={formData.existingStock}
                          readOnly
                          className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 tabular-nums font-semibold"
                        />
                        {selectedMaterialId && formData.existingStock === "" && (
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
                        step="any"
                        value={formData.quantityAdded}
                        onChange={(e) => {
                          const value = e.target.value
                          setFormData((prev) => {
                            const updated = { ...prev, quantityAdded: value }
                            if (supplyType === "resupply" && prev.existingStock !== "") {
                              const existing = Number(prev.existingStock) || 0
                              const added = value === "" ? 0 : Number(value) || 0
                              updated.currentStock = String(existing + added)
                            } else if (supplyType === "resupply") {
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
                          const existingStockValue = formData.existingStock
                          const quantityAdded = formData.quantityAdded
                          if (existingStockValue !== "" && quantityAdded !== "") {
                            const existing = Number(existingStockValue) || 0
                            const added = Number(quantityAdded) || 0
                            return String(existing + added)
                          }
                          if (existingStockValue !== "") {
                            return existingStockValue
                          }
                          return ""
                        })()}
                        readOnly
                        placeholder={
                          (formData.existingStock !== "" || selectedMaterialId)
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, supplyDate: e.target.value }))
                      }
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
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, buyingPrice: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, totalCost: e.target.value }))
                          }
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, lotNumber: e.target.value }))
                      }
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
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, supplier: value }))
                      }
                      required
                      disabled={loadingSuppliers}
                    >
                      <SelectTrigger id="supplier" className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500">
                        <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select supplier"} />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierSelectList.length > 0 ? (
                          supplierSelectList.map((supplier) => (
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, preferredSupplier: e.target.value }))
                      }
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
