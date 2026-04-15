"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Truck, Plus, Trash2, Building2, Hash, Package, DollarSign, FileText, Loader2, Calendar, X } from "lucide-react"
import { toast } from "sonner"

interface Supplier {
  id: string
  name: string
  status: "active" | "inactive"
}

interface Product {
  id: string
  _id: string
  name: string
  stock: number
  unit: string
}

interface DeliveryModalProps {
  supplierId?: string
  supplierName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  showTrigger?: boolean
}

export function DeliveryModal({ 
  supplierId: initialSupplierId, 
  supplierName: initialSupplierName, 
  open: controlledOpen,
  onOpenChange,
  onSuccess,
  showTrigger = true
}: DeliveryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [supplierId, setSupplierId] = useState(initialSupplierId || "")
  const [supplierName, setSupplierName] = useState(initialSupplierName || "")
  const [deliveryNote, setDeliveryNote] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState([{ productId: "", quantity: "", cost: "" }])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(false)

  // Calculate totals
  const totalCost = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const cost = parseFloat(item.cost) || 0
    return sum + (qty * cost)
  }, 0)

  // Generate delivery note number
  const generateDeliveryNote = () => {
    const randomNum = String(Math.floor(Math.random() * 999999)).padStart(6, "0")
    return `DN-${randomNum}`
  }

  useEffect(() => {
    if (open) {
      fetchSuppliers()
      fetchProducts()
      if (initialSupplierId) {
        setSupplierId(initialSupplierId)
        setSupplierName(initialSupplierName || "")
        // Auto-generate delivery note
        setDeliveryNote(generateDeliveryNote())
        // Auto-fill today's date
        setDeliveryDate(new Date().toISOString().split("T")[0])
      } else {
        // Reset when opened without supplier
        setDeliveryNote("")
        setDeliveryDate("")
      }
    } else {
      // Reset when closed
      setSupplierId(initialSupplierId || "")
      setSupplierName(initialSupplierName || "")
      setDeliveryNote("")
      setDeliveryDate("")
      setNotes("")
      setItems([{ productId: "", quantity: "", cost: "" }])
    }
  }, [open, initialSupplierId, initialSupplierName])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/catha/suppliers')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.suppliers || [])
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      setIsFetchingData(true)
      const response = await fetch('/api/catha/inventory')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProducts(data.products || [])
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsFetchingData(false)
    }
  }

  const addItem = () => {
    setItems([...items, { productId: "", quantity: "", cost: "" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: string) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async () => {
    if (!supplierId || !deliveryNote || !deliveryDate || items.length === 0) {
      toast.error('Please fill in supplier, delivery note, date, and at least one item')
      return
    }

    // Validate items
    const validItems = items.filter(item => item.productId && item.quantity && item.cost)
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item with product, quantity, and cost')
      return
    }

    try {
      setIsLoading(true)
      const selectedSupplier = suppliers.find(s => s.id === supplierId)
      const supplierNameToUse = selectedSupplier?.name || supplierName

      const response = await fetch('/api/catha/supplier-deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierId: supplierId,
          supplierName: supplierNameToUse,
          deliveryNote: deliveryNote,
          items: validItems,
          notes: notes,
          date: deliveryDate || new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record delivery')
      }

      const data = await response.json()
      if (data.success) {
        toast.success('Delivery recorded successfully', {
          description: `Delivery ${deliveryNote} has been recorded and inventory updated.`,
        })
        
        // Reset form
        setSupplierId(initialSupplierId || "")
        setSupplierName(initialSupplierName || "")
        setDeliveryNote("")
        setDeliveryDate("")
        setNotes("")
        setItems([{ productId: "", quantity: "", cost: "" }])
        setOpen(false)
        
        // Refresh data
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error: any) {
      console.error('Error recording delivery:', error)
      toast.error('Failed to record delivery', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm h-10 text-xs md:text-sm flex-1 sm:flex-none">
            <Truck className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Record Delivery</span>
            <span className="sm:hidden">Delivery</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col w-[calc(100%-2rem)] md:w-full rounded-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold">Record Stock Delivery</DialogTitle>
          <DialogDescription>Log a new delivery from a supplier</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Delivery Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="supplier" className="text-sm">Supplier</Label>
                <Select value={supplierId} onValueChange={(value) => {
                  setSupplierId(value)
                  const selected = suppliers.find(s => s.id === value)
                  setSupplierName(selected?.name || "")
                  if (!deliveryNote) {
                    setDeliveryNote(generateDeliveryNote())
                  }
                }} disabled={!!initialSupplierId}>
                  <SelectTrigger id="supplier" className="w-full">
                    <SelectValue placeholder={isFetchingData ? "Loading..." : "Select supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No suppliers available</div>
                    ) : (
                      suppliers
                        .filter((s) => s.status === "active")
                        .map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryNote" className="text-sm">Delivery Note</Label>
                <Input
                  id="deliveryNote"
                  placeholder="Auto-generated"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryDate" className="text-sm">Delivery Date</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Items</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addItem}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            {/* Product Selection Grid */}
            {items.some(item => !item.productId) && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Select Products</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                  {products.map((prod) => {
                    const emptyItemIndex = items.findIndex(item => !item.productId)
                    if (emptyItemIndex === -1) return null
                    
                    return (
                      <button
                        key={prod.id || prod._id}
                        type="button"
                        onClick={() => {
                          updateItem(emptyItemIndex, "productId", prod.id || prod._id)
                        }}
                        className="p-3 text-left border rounded-lg bg-background hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <div className="font-medium text-sm truncate">{prod.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Stock: {prod.stock} {prod.unit}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Selected Items Cards */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const qty = parseFloat(item.quantity) || 0
                const cost = parseFloat(item.cost) || 0
                const itemTotal = qty * cost
                const selectedProduct = products.find(p => (p.id || p._id) === item.productId)
                
                return (
                  <div 
                    key={index} 
                    className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Product Selection */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Product</Label>
                          <Select value={item.productId} onValueChange={(v) => updateItem(index, "productId", v)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.length === 0 ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">No products available</div>
                              ) : (
                                products.map((prod) => (
                                  <SelectItem key={prod.id || prod._id} value={prod.id || prod._id}>
                                    {prod.name} <span className="text-muted-foreground ml-2">({prod.stock} {prod.unit})</span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {selectedProduct && (
                            <div className="text-xs text-muted-foreground">
                              Available: {selectedProduct.stock} {selectedProduct.unit}
                            </div>
                          )}
                        </div>

                        {/* Quantity and Cost */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", e.target.value)}
                              className="w-full"
                              min="0"
                              step="1"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Unit Cost (Ksh)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={item.cost}
                              onChange={(e) => updateItem(index, "cost", e.target.value)}
                              className="w-full"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Total and Remove */}
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {itemTotal > 0 && (
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Total</div>
                            <div className="text-base font-semibold text-primary">
                              Ksh {itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total Summary */}
            {totalCost > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Total Delivery Value:</span>
                  <span className="text-lg font-bold text-foreground">
                    Ksh {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this delivery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !supplierId || !deliveryNote || !deliveryDate || totalCost === 0}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4" />
                Record Delivery
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
