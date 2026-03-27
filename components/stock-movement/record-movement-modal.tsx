"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ArrowDownCircle, ArrowUpCircle, Package, Hash, User, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  _id: string
  name: string
  stock: number
}

interface Supplier {
  id: string
  name: string
  status: string
}

interface RecordMovementModalProps {
  onSuccess?: () => void
}

export function RecordMovementModal({ onSuccess }: RecordMovementModalProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("")
  const [reason, setReason] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reference, setReference] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [notes, setNotes] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingProducts, setIsFetchingProducts] = useState(false)

  useEffect(() => {
    if (open) {
      fetchProducts()
      fetchSuppliers()
    }
  }, [open])

  const fetchProducts = async () => {
    try {
      setIsFetchingProducts(true)
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
      setIsFetchingProducts(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      // Try bar suppliers first, fallback to jaba suppliers if needed
      const response = await fetch('/api/jaba/suppliers')
      if (response.ok) {
        const data = await response.json()
        if (data.suppliers) {
          setSuppliers(data.suppliers.map((s: any) => ({
            id: s.id || s._id,
            name: s.name,
            status: s.status || 'active'
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      // Suppliers are optional, so we can continue without them
    }
  }

  const selectedProduct = products.find(p => (p.id || p._id) === productId)
  const previousStock = selectedProduct?.stock || 0
  const quantityNum = Number(quantity) || 0
  const newStock = type === "inflow" 
    ? previousStock + quantityNum 
    : type === "outflow" 
    ? Math.max(0, previousStock - quantityNum)
    : previousStock

  const handleSubmit = async () => {
    if (!type || !reason || !productId || !quantity || !reference) {
      toast.error('Please fill in all required fields')
      return
    }

    if (quantityNum <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    if (type === "outflow" && quantityNum > previousStock) {
      toast.error('Insufficient stock. Cannot remove more than available stock.')
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/catha/stock-movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: productId,
          productName: selectedProduct?.name || '',
          movementType: type,
          reason: reason,
          quantity: quantityNum,
          previousStock: previousStock,
          newStock: newStock,
          supplier: supplierId || '',
          reference: reference,
          notes: notes || '',
          userName: 'Current User', // TODO: Get from auth session
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record movement')
      }

      const data = await response.json()
      if (data.success) {
        toast.success('Stock movement recorded successfully', {
          description: `${type === 'inflow' ? 'Added' : 'Removed'} ${quantityNum} units of ${selectedProduct?.name}`,
        })
        
        // Reset form
        setType("")
        setReason("")
        setProductId("")
        setQuantity("")
        setReference("")
        setSupplierId("")
        setNotes("")
        setOpen(false)
        
        // Refresh movements list
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error: any) {
      console.error('Error recording movement:', error)
      toast.error('Failed to record movement', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm">
          <Plus className="h-4 w-4" />
          Record Movement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {type === "inflow" ? (
              <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
            ) : type === "outflow" ? (
              <ArrowUpCircle className="h-5 w-5 text-red-600" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            Record Stock Movement
          </DialogTitle>
          <DialogDescription>Log a new inventory transaction</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium">Movement Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                      Inflow (Stock In)
                    </div>
                  </SelectItem>
                  <SelectItem value="outflow">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-red-600" />
                      Outflow (Stock Out)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">Reason</Label>
              <Select value={reason} onValueChange={setReason} disabled={!type}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {type === "inflow" ? (
                    <>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="return">Return</SelectItem>
                    </>
                  ) : type === "outflow" ? (
                    <>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="wastage">Wastage</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="" disabled>Select type first</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product" className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product
            </Label>
            <Select value={productId} onValueChange={setProductId} disabled={isFetchingProducts}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder={isFetchingProducts ? "Loading products..." : "Select product"} />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <SelectItem value="" disabled>No products available</SelectItem>
                ) : (
                  products.map((prod) => (
                    <SelectItem key={prod.id || prod._id} value={prod.id || prod._id}>
                      {prod.name} (Stock: {prod.stock.toLocaleString()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                Current stock: <span className="font-semibold">{previousStock.toLocaleString()}</span> | 
                After {type === "inflow" ? "adding" : "removing"}: <span className="font-semibold">{newStock.toLocaleString()}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-sm font-medium">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference" className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Reference #
              </Label>
              <Input
                id="reference"
                placeholder="e.g., DEL-2024-0460"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>

          {type === "inflow" && (
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-sm font-medium">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <SelectItem value="" disabled>No suppliers available</SelectItem>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg min-h-[80px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="rounded-lg bg-primary hover:bg-primary/90" disabled={!type || !reason || !productId || !quantity || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              'Record Movement'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
