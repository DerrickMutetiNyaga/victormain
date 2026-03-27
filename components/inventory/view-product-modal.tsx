"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Package, Tag, Hash, DollarSign, TrendingUp, AlertTriangle, FileText, Building2, Sparkles, Image as ImageIcon, Ruler } from "lucide-react"
import { categories } from "@/lib/dummy-data"

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

interface ViewProductModalProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ViewProductModal({ product, open, onOpenChange }: ViewProductModalProps) {
  if (!product) return null

  const category = categories.find((c) => c.id === product.category)
  const isLowStock = product.stock <= product.minStock
  const stockValue = product.cost * product.stock
  const potentialValue = product.price * product.stock

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] md:w-full rounded-xl md:rounded-lg">
        <DialogHeader className="pb-3 md:pb-4 border-b border-border/50">
          <DialogTitle className="text-lg md:text-2xl font-bold flex items-center gap-2 md:gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
              <Package className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate">Product Details</div>
              <p className="text-xs md:text-sm font-normal text-muted-foreground mt-0.5 md:mt-1 truncate">
                {product.name}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6 py-4 md:py-6">
          {/* Product Image & Basic Info */}
          <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  {product.image ? (
                    <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl overflow-hidden border-2 border-border/50 shadow-lg">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center border-2 border-border/50 shadow-lg">
                      <Package className="h-12 w-12 md:h-16 md:w-16 text-amber-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">{product.name}</h3>
                    <Badge variant="outline" className="text-xs md:text-sm">
                      {category?.icon || "📦"} {category?.name || product.category}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs md:text-sm">Barcode</p>
                      <code className="rounded-md bg-muted/60 px-2 py-1 text-[10px] md:text-xs font-mono">
                        {product.barcode || "N/A"}
                      </code>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs md:text-sm">Supplier</p>
                      <p className="font-medium text-xs md:text-sm">{product.supplier}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Card className="border-2 border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-green-50/30">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-emerald-700" />
                  <h4 className="font-bold text-base md:text-lg text-foreground">Pricing</h4>
                </div>
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Cost Price</span>
                    <span className="text-base md:text-lg font-bold text-foreground">
                      Ksh {product.cost.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Selling Price</span>
                    <span className="text-base md:text-lg font-bold text-primary">
                      Ksh {product.price.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 md:pt-3 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-muted-foreground">Profit Margin</span>
                      <span className="text-base md:text-lg font-bold text-emerald-700">
                        {((product.price - product.cost) / product.cost * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${isLowStock ? 'border-red-200/50 bg-gradient-to-br from-red-50/50 to-rose-50/30' : 'border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-cyan-50/30'}`}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <TrendingUp className={`h-4 w-4 md:h-5 md:w-5 ${isLowStock ? 'text-red-700' : 'text-blue-700'}`} />
                  <h4 className="font-bold text-base md:text-lg text-foreground">Stock Info</h4>
                </div>
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Current Stock</span>
                    <span className={`text-base md:text-lg font-bold ${isLowStock ? 'text-red-700' : 'text-foreground'}`}>
                      {product.stock.toLocaleString()} {product.unit || "unit"}{product.stock !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Min Level</span>
                    <span className="text-base md:text-lg font-medium text-foreground">
                      {product.minStock.toLocaleString()} {product.unit || "unit"}{product.minStock !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="pt-2 md:pt-3 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-muted-foreground">Stock Value</span>
                      <span className="text-base md:text-lg font-bold text-foreground">
                        Ksh {stockValue.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 md:mt-2">
                      <span className="text-xs md:text-sm text-muted-foreground">Potential</span>
                      <span className="text-base md:text-lg font-bold text-primary">
                        Ksh {potentialValue.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Details */}
          <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-amber-700" />
                <h4 className="font-bold text-base md:text-lg text-foreground">Product Details</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Unit</p>
                  <p className="font-medium text-sm md:text-base capitalize">{product.unit}</p>
                </div>
                {product.size && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Size</p>
                    <p className="font-medium text-sm md:text-base">{product.size}</p>
                  </div>
                )}
                {product.isJaba && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Type</p>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] md:text-xs">
                      <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                      Jaba
                    </Badge>
                  </div>
                )}
              </div>
              {product.batch && (
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border/50">
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Batch Number</p>
                  <p className="font-medium text-sm md:text-base">{product.batch}</p>
                </div>
              )}
              {product.infusion && (
                <div className="mt-2">
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Infusion Notes</p>
                  <p className="font-medium text-sm md:text-base">{product.infusion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {product.notes && (
            <Card className="border-2 border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-gray-50/30">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-slate-700" />
                  <h4 className="font-bold text-base md:text-lg text-foreground">Notes</h4>
                </div>
                <p className="text-xs md:text-sm text-foreground whitespace-pre-wrap">{product.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

