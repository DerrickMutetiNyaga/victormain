"use client"

import { useState, useMemo, useEffect } from "react"
import { categories } from "@/lib/dummy-data"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, QrCode, Package, Hash, Tag, TrendingUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ViewProductModal } from "./view-product-modal"
import { AddStockModal } from "./add-stock-modal"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

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

export function InventoryTable() {
  const { canEdit, canDelete } = useCathaPermissions("inventory")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/catha/inventory')
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const data = await response.json()
      if (data.success) {
        setProducts(data.products || [])
      } else {
        throw new Error(data.error || 'Failed to fetch inventory')
      }
    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.message || 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && (product.stock || 0) > 0) ||
        (stockFilter === "out-of-stock" && (product.stock || 0) <= 0)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [searchQuery, categoryFilter, stockFilter, products])

  const handleDelete = async () => {
    if (!deletingProduct) return

    try {
      const response = await fetch(`/api/catha/inventory?id=${deletingProduct.id || deletingProduct._id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete product')
      }

      toast.success('Product deleted successfully', {
        description: `${deletingProduct.name} has been removed from your inventory.`,
      })

      setDeletingProduct(null)
      fetchProducts() // Refresh the list
      
      // Dispatch event to update stats
      window.dispatchEvent(new CustomEvent('inventory-updated'))
    } catch (error: any) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product', {
        description: error.message || 'An error occurred. Please try again.',
      })
    }
  }

  return (
    <Card className="border-border/60 bg-gradient-to-br from-white via-white to-amber-50/30 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Filters - Desktop */}
        <div className="hidden md:flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/70 bg-background/60"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px] rounded-xl border-border/70 bg-background/60">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[180px] rounded-xl border-border/70 bg-background/60">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filters - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/70 bg-white h-10 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full rounded-xl border-border/70 bg-white h-10 text-sm">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full rounded-xl border-border/70 bg-white h-10 text-sm">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Product Cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading inventory...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchProducts} className="rounded-lg">
                Retry
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery || categoryFilter !== "all" 
                  ? "No products match your filters" 
                  : "No products found"}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const category = categories.find((c) => c.id === product.category)
              const isOutOfStock = (product.stock || 0) <= 0
              const isLowStock = !isOutOfStock && product.stock <= product.minStock

              return (
                <div
                  key={product.id || product._id}
                  className="bg-white rounded-xl border border-border/50 p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    {/* Product Image */}
                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-7 w-7 text-amber-600" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {product.supplier}
                            {product.size && ` • ${product.size}`}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem 
                              className="rounded-md cursor-pointer text-sm"
                              onClick={() => setViewingProduct(product)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem 
                                className="rounded-md cursor-pointer text-sm"
                                onClick={() => setEditingProduct(product)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="rounded-md cursor-pointer text-sm">
                              <QrCode className="mr-2 h-4 w-4" />
                              Barcode
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem 
                                className="text-destructive rounded-md cursor-pointer text-sm"
                                onClick={() => setDeletingProduct(product)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Category Badge */}
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px] border-border/70 px-1.5 py-0">
                          {category?.icon || "📦"} {category?.name || product.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Price & Stock Row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Cost</p>
                        <p className="text-xs font-medium text-foreground">
                          Ksh {product.cost.toLocaleString("en-KE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Price</p>
                        <p className="text-xs font-bold text-primary">
                          Ksh {product.price.toLocaleString("en-KE")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-bold flex items-center gap-1",
                        isLowStock ? "text-red-700" : "text-foreground"
                      )}>
                        <TrendingUp className={cn("h-3 w-3", isLowStock ? "text-red-600" : "text-emerald-600")} />
                        {product.stock} {product.unit || "unit"}{product.stock !== 1 ? "s" : ""}
                      </div>
                      {isOutOfStock ? (
                        <Badge className="bg-gray-200 text-gray-800 border-gray-300 text-[10px] px-1.5 py-0 mt-1">
                          Out of Stock
                        </Badge>
                      ) : isLowStock ? (
                        <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] px-1.5 py-0 mt-1">
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0 mt-1">
                          In Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-xl border border-border/50 overflow-hidden bg-background/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Product</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Category</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Barcode</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Cost</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Price</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Stock</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading inventory...
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-destructive">
                    <div className="flex flex-col items-center gap-2">
                      <p>{error}</p>
                      <Button variant="outline" size="sm" onClick={fetchProducts}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery || categoryFilter !== "all" ? "No products match your filters" : "No products found. Add your first inventory item!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const category = categories.find((c) => c.id === product.category)
                  const isOutOfStock = (product.stock || 0) <= 0
                  const isLowStock = !isOutOfStock && product.stock <= product.minStock

                  return (
                    <TableRow key={product.id || product._id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-6 w-6 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Tag className="h-3 w-3" />
                              {product.supplier}
                              {product.size && <span className="ml-1">• {product.size}</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-border/70">
                          {category?.icon || "📦"} {category?.name || product.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <code className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
                            {product.barcode || "N/A"}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 text-sm text-foreground">
                            <span className="text-sm font-semibold text-muted-foreground">Ksh</span>
                            {product.cost.toLocaleString("en-KE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 font-bold text-primary text-sm">
                            <span className="text-sm font-bold">Ksh</span>
                            {product.price.toLocaleString("en-KE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <div
                            className={cn(
                              "font-bold text-sm flex items-center justify-end gap-1",
                              isLowStock ? "text-red-700" : "text-foreground",
                            )}
                          >
                            <TrendingUp className={cn("h-3.5 w-3.5", isLowStock ? "text-red-600" : "text-emerald-600")} />
                            {product.stock.toLocaleString()} {product.unit || "unit"}{product.stock !== 1 ? "s" : ""}
                          </div>
                          {!isOutOfStock && isLowStock && (
                            <div className="text-[10px] text-red-600 mt-0.5">Min: {product.minStock}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isOutOfStock ? (
                          <Badge className="bg-gray-200 text-gray-800 border-gray-300 text-xs font-medium">
                            Out of Stock
                          </Badge>
                        ) : isLowStock ? (
                          <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-medium">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-medium">
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem 
                              className="rounded-md cursor-pointer"
                              onClick={() => setViewingProduct(product)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem 
                                className="rounded-md cursor-pointer"
                                onClick={() => setEditingProduct(product)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Item
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="rounded-md cursor-pointer">
                              <QrCode className="mr-2 h-4 w-4" />
                              Print Barcode
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem 
                                className="text-destructive rounded-md cursor-pointer"
                                onClick={() => setDeletingProduct(product)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination - Desktop */}
        <div className="hidden md:flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredProducts.length}</span> of{" "}
            <span className="font-semibold text-foreground">{products.length}</span> items
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchProducts}
            className="rounded-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>

        {/* Pagination - Mobile */}
        <div className="md:hidden flex items-center justify-between pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredProducts.length}</span> of{" "}
            <span className="font-semibold text-foreground">{products.length}</span> items
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchProducts}
            className="rounded-lg h-8 text-xs px-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </CardContent>

      {/* View Product Modal */}
      <ViewProductModal
        product={viewingProduct}
        open={!!viewingProduct}
        onOpenChange={(open) => !open && setViewingProduct(null)}
      />

      {/* Edit Product Modal */}
      <AddStockModal
        product={editingProduct}
        onSuccess={() => {
          setEditingProduct(null)
          fetchProducts()
          // Dispatch event to update stats
          window.dispatchEvent(new CustomEvent('inventory-updated'))
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingProduct?.name}</strong> from your inventory.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
