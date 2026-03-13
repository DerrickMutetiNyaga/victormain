"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Package, Tag, Hash, DollarSign, TrendingUp, AlertTriangle, FileText, Building2, Sparkles, Image as ImageIcon, X, Loader2, Ruler, Edit } from "lucide-react"
import { categories, suppliers } from "@/lib/dummy-data"
import { toast } from "sonner"

interface Product {
  _id: string
  id: string
  name: string
  category: string
  barcode: string
  cost: number
  price: number
  stock: number
  minStock: number
  unit: string
  size?: string
  supplier: string
  image?: string
  batch?: string
  infusion?: string
  notes?: string
  isJaba?: boolean
}

interface AddStockModalProps {
  product?: Product | null
  onSuccess?: () => void
}

export function AddStockModal({ product, onSuccess }: AddStockModalProps) {
  const isEditMode = !!product
  const [open, setOpen] = useState(false)
  const [isJaba, setIsJaba] = useState(product?.isJaba || false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(product?.image || "")
  const [imageUrl, setImageUrl] = useState<string>(product?.image || "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: product?.name || "",
    category: product?.category || "",
    barcode: product?.barcode || "",
    cost: product?.cost?.toString() || "",
    price: product?.price?.toString() || "",
    stock: product?.stock?.toString() || "",
    minStock: product?.minStock?.toString() || "",
    unit: product?.unit || "",
    size: product?.size || "",
    supplier: product?.supplier || "",
    batch: product?.batch || "",
    infusion: product?.infusion || "",
    notes: product?.notes || "",
  })

  // Update form when product changes
  useEffect(() => {
    if (product) {
      // Find supplier ID by matching name
      const supplierMatch = suppliers.find(sup => sup.name === product.supplier)
      const supplierId = supplierMatch ? supplierMatch.id : product.supplier

      setFormData({
        name: product.name || "",
        category: product.category || "",
        barcode: product.barcode || "",
        cost: product.cost?.toString() || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
        minStock: product.minStock?.toString() || "",
        unit: product.unit || "",
        size: product.size || "",
        supplier: supplierId || "",
        batch: product.batch || "",
        infusion: product.infusion || "",
        notes: product.notes || "",
      })
      setIsJaba(product.isJaba || false)
      setImagePreview(product.image || "")
      setImageUrl(product.image || "")
    }
  }, [product])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type', {
          description: 'Please select a JPEG, PNG, WebP, or GIF image.',
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
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview("")
    setImageUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null

    try {
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
    }
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name || !formData.category || !formData.cost || !formData.price || 
        !formData.stock || !formData.unit || !formData.supplier) {
      toast.error('Missing required fields', {
        description: 'Please fill in all required fields.',
      })
      return
    }

    setIsLoading(true)

    try {
      // Upload image first if provided
      let finalImageUrl = imageUrl
      if (imageFile && !imageUrl) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl
        } else {
          // Continue without image if upload fails
          toast.warning('Product saved without image', {
            description: 'The product was saved but the image upload failed.',
          })
        }
      }

      // Upload new image if changed
      if (imageFile && imageFile !== null) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl
        }
      }

      // Save or update inventory item
      const url = isEditMode ? '/api/catha/inventory' : '/api/catha/inventory'
      const method = isEditMode ? 'PUT' : 'POST'
      
      // Convert supplier ID to name
      const supplierMatch = suppliers.find(sup => sup.id === formData.supplier)
      const supplierName = supplierMatch ? supplierMatch.name : formData.supplier
      
      const requestBody: any = {
        ...formData,
        cost: Number(formData.cost),
        price: Number(formData.price),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock) || 0,
        image: finalImageUrl,
        supplier: supplierName, // Use supplier name instead of ID
        isJaba,
      }

      if (isEditMode && product) {
        requestBody.id = product.id || product._id
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'save'} inventory item`)
      }

      const data = await response.json()
      
      toast.success(`Inventory item ${isEditMode ? 'updated' : 'added'} successfully`, {
        description: `${formData.name} has been ${isEditMode ? 'updated' : 'added'} to your inventory.`,
      })

      // Reset form
      setFormData({
    name: "",
    category: "",
    barcode: "",
    cost: "",
    price: "",
    stock: "",
    minStock: "",
    unit: "",
        size: "",
    supplier: "",
    batch: "",
    infusion: "",
    notes: "",
  })
      setIsJaba(false)
      removeImage()
      setOpen(false)
      
      // Dispatch event to update stats
      window.dispatchEvent(new CustomEvent('inventory-updated'))
      
      // Call success callback if provided, otherwise reload
      if (onSuccess) {
        onSuccess()
      } else {
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Error saving inventory:', error)
      toast.error('Failed to save inventory item', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // For edit mode, control the dialog externally
  const dialogOpen = isEditMode ? (product !== null && product !== undefined) : open
  const handleOpenChange = (open: boolean) => {
    if (isEditMode) {
      if (!open) {
        // Reset form when closing in edit mode
    setFormData({
      name: "",
      category: "",
      barcode: "",
      cost: "",
      price: "",
      stock: "",
      minStock: "",
      unit: "",
          size: "",
      supplier: "",
      batch: "",
      infusion: "",
      notes: "",
    })
    setIsJaba(false)
        removeImage()
        // Notify parent to close by calling onSuccess
        if (onSuccess) {
          onSuccess()
        }
      }
    } else {
      setOpen(open)
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {!isEditMode && (
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm flex-1 md:flex-none h-10 md:h-9 text-xs md:text-sm">
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="hidden sm:inline">Add Stock Item</span>
          <span className="sm:hidden">Add Item</span>
        </Button>
      </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto w-[calc(100%-2rem)] md:w-full rounded-xl md:rounded-lg">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <div>{isEditMode ? 'Edit Stock Item' : 'Add New Stock Item'}</div>
              <DialogDescription className="text-sm font-normal mt-1">
                {isEditMode ? 'Update product information in your inventory' : 'Create a new product entry in your inventory'}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Basic Information Section */}
          <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Package className="h-4 w-4 text-amber-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Package className="h-4 w-4 text-amber-600" />
                    Product Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Johnnie Walker Blue"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="rounded-lg border-2 focus:border-amber-500 h-11"
                  />
            </div>
            <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Tag className="h-4 w-4 text-amber-600" />
                    Category *
                  </Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="rounded-lg border-2 focus:border-amber-500 h-11">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

            <div className="space-y-2">
                <Label htmlFor="barcode" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Hash className="h-4 w-4 text-amber-600" />
                  Barcode / SKU
                </Label>
                <Input
                  id="barcode"
                  placeholder="Scan or enter barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="rounded-lg border-2 focus:border-amber-500 h-11"
                />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <ImageIcon className="h-4 w-4 text-amber-600" />
                Product Image
              </Label>
              <div className="space-y-3">
                {imagePreview ? (
                  <div className="relative w-full h-48 rounded-lg border-2 border-amber-200 overflow-hidden bg-muted">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full h-48 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50/50 hover:bg-amber-100/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <ImageIcon className="h-10 w-10 mx-auto text-amber-600 mb-2" />
                      <p className="text-sm font-medium text-foreground">Click to upload image</p>
                      <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, GIF (max 5MB)</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {!imagePreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-amber-300 hover:border-amber-400"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Choose Image
                  </Button>
                )}
              </div>
            </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock Section */}
          <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-cyan-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-700" />
            </div>
                <h3 className="font-bold text-lg text-foreground">Pricing & Stock</h3>
          </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="cost" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    Cost Price (Ksh) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Ksh</span>
                    <Input
                      id="cost"
                      type="number"
                      placeholder="0.00"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      className="rounded-lg border-2 focus:border-blue-500 h-11 pl-14"
                    />
                  </div>
            </div>
            <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    Selling Price (Ksh) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Ksh</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="rounded-lg border-2 focus:border-blue-500 h-11 pl-14"
                    />
                  </div>
            </div>
            <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm font-semibold text-foreground">Unit *</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                    <SelectTrigger className="rounded-lg border-2 focus:border-blue-500 h-11">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottle">Bottle</SelectItem>
                  <SelectItem value="can">Can</SelectItem>
                  <SelectItem value="keg">Keg</SelectItem>
                  <SelectItem value="case">Case</SelectItem>
                  <SelectItem value="serving">Serving</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="size" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Ruler className="h-4 w-4 text-blue-600" />
                    Size / Volume
                  </Label>
                  <Select value={formData.size} onValueChange={(v) => setFormData({ ...formData, size: v })}>
                    <SelectTrigger className="rounded-lg border-2 focus:border-blue-500 h-11">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="250ml">250ml</SelectItem>
                      <SelectItem value="500ml">500ml</SelectItem>
                      <SelectItem value="750ml">750ml</SelectItem>
                      <SelectItem value="1L">1L</SelectItem>
                      <SelectItem value="5L">5L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Initial Stock *
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="rounded-lg border-2 focus:border-blue-500 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Min Stock Level *
                  </Label>
                  <Input
                    id="minStock"
                    type="number"
                    placeholder="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    className="rounded-lg border-2 focus:border-blue-500 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supplier Section */}
          <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50/50 to-pink-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-purple-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Supplier Information</h3>
              </div>

          <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  Supplier *
                </Label>
                <Select value={formData.supplier} onValueChange={(v) => setFormData({ ...formData, supplier: v })}>
                  <SelectTrigger className="rounded-lg border-2 focus:border-purple-500 h-11">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((sup) => (
                  <SelectItem key={sup.id} value={sup.id}>
                    {sup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            </CardContent>
          </Card>

          {/* Jaba Product Section */}
          <Card className="border-2 border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border-2 border-emerald-300/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
            <div>
                    <Label htmlFor="jaba" className="text-base font-bold flex items-center gap-2 text-foreground cursor-pointer">
                Jaba Product
              </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                Enable for infused or artisan products with batch tracking
              </p>
            </div>
                </div>
                <Switch id="jaba" checked={isJaba} onCheckedChange={setIsJaba} className="scale-110" />
          </div>

            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card className="border-2 border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-gray-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-slate-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Additional Notes</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-slate-600" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Additional information about this product..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="rounded-lg border-2 focus:border-slate-500 min-h-[100px] resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent -mx-6 px-6 pb-6">
          <Button 
            variant="outline" 
            onClick={() => {
              setOpen(false)
              // Reset form when closing
              setTimeout(() => {
                setFormData({
                  name: "",
                  category: "",
                  barcode: "",
                  cost: "",
                  price: "",
                  stock: "",
                  minStock: "",
                  unit: "",
                  size: "",
                  supplier: "",
                  batch: "",
                  infusion: "",
                  notes: "",
                })
                setIsJaba(false)
                removeImage()
              }, 300)
            }} 
            className="rounded-xl h-11 font-semibold"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 h-11 font-semibold shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                {isEditMode ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {isEditMode ? 'Update Item' : 'Add Item'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
