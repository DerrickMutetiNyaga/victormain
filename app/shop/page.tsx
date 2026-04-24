"use client"

import { useState, useMemo, Suspense, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { ProductCard } from "@/components/ecommerce/product-card"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Filter, X, Search, Loader2, Package } from "lucide-react"
import { EcommerceProduct, getProductDisplayName } from "@/lib/ecommerce-data"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Image from "next/image"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"

function ShopPageContent() {
  const searchParams = useSearchParams()
  const { cart, session, addItem, refresh } = useShopCart()
  const openLoginModal = useShopLoginModal()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("search") || ""
  )
  const debouncedSearchQuery = useDebounce(searchQuery, 300) // Debounce search by 300ms
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false)
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string; name: string; productCount: number }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const productsPerPage = 24 // Show 24 products per page

  const applyProductData = useCallback((mappedProducts: EcommerceProduct[]) => {
    setProducts(mappedProducts)

    const categoryCounts: Record<string, number> = {}
    mappedProducts.forEach((p) => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1
    })

    const categoryIdMap: Record<string, string> = {
      "Infused Jaba": "infused-jaba",
      Liquor: "liquor",
      Spirits: "spirits",
      Wines: "wines",
      "Soft Drinks": "soft-drinks",
    }

    const generatedCategories = Object.entries(categoryCounts).map(([name, count]) => ({
      id: categoryIdMap[name] || name.toLowerCase().replace(" ", "-"),
      name,
      productCount: count,
    }))
    setCategories(generatedCategories)

    if (mappedProducts.length > 0) {
      const prices = mappedProducts.map((p) => p.price)
      const calculatedMaxPrice = Math.max(...prices)
      const minPrice = Math.min(...prices)
      const roundedMax = Math.ceil(calculatedMaxPrice / 1000) * 1000
      setMaxPrice(roundedMax)
      setPriceRange([Math.floor(minPrice / 1000) * 1000, roundedMax])
    }
  }, [])

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category") || "all",
  )
  const [selectedSize, setSelectedSize] = useState<string>("all")
  const [priceRange, setPriceRange] = useState<number[]>([0, 50000])
  const [maxPrice, setMaxPrice] = useState<number>(50000)
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "latest",
  )
  const [showFeatured, setShowFeatured] = useState<boolean>(
    searchParams.get("featured") === "true",
  )

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        // Use cache: 'force-cache' for initial load, then 'no-store' for updates
        const response = await fetch('/api/catha/inventory?visibleOnly=true', {
          cache: 'force-cache',
          next: { revalidate: 60 } // Revalidate every 60 seconds
        })
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        const data = await response.json()
        
        if (data.success && data.products) {
          // Map category names
          const categoryMap: Record<string, "Infused Jaba" | "Liquor" | "Spirits" | "Wines" | "Soft Drinks"> = {
            'whiskey': 'Spirits',
            'vodka': 'Spirits',
            'rum': 'Spirits',
            'gin': 'Spirits',
            'beer': 'Liquor',
            'wine': 'Wines',
            'cocktails': 'Liquor',
            'soft-drinks': 'Soft Drinks',
            'jaba': 'Infused Jaba',
            'other': 'Liquor',
          }
          
          // Group products by name and combine sizes
          const productMap = new Map<string, {
            id: string
            name: string
            category: "Infused Jaba" | "Liquor" | "Spirits" | "Wines" | "Soft Drinks"
            sizes: { size: string; price: number; available: boolean }[]
            image: string
            description: string
            inStock: boolean
            isJaba: boolean
            isFeatured: boolean
          }>()
          
          data.products.forEach((p: any) => {
              if (!p || !p.name) return
              const productName = String(p.name).trim()
              if (!productName) return
              const category = categoryMap[p.category] || 'Liquor'
              const size = p.size || 'Standard'
              const price = p.price || 0
              const available = p.stock > 0
              
              const isJaba = p.isJaba === true
              const isFeatured = p.isFeatured === true
              if (productMap.has(productName)) {
                // Product exists, add size if not already present
                const existing = productMap.get(productName)!
                existing.isJaba = existing.isJaba || isJaba
                existing.isFeatured = existing.isFeatured || isFeatured
                existing.inStock = existing.inStock || available
                const sizeExists = existing.sizes.some(s => s.size === size)
                if (!sizeExists) {
                  existing.sizes.push({ size, price, available })
                  existing.sizes.sort((a, b) => a.price - b.price)
                } else {
                  const existingSize = existing.sizes.find(s => s.size === size)
                  if (existingSize) {
                    existingSize.available = existingSize.available || available
                  }
                }
              } else {
                productMap.set(productName, {
                  id: p.id || p._id,
                  name: productName,
                  category: category,
                  sizes: [{ size, price, available }],
                  image: p.image || '/placeholder.svg?height=400&width=300',
                  description: p.notes || `${productName} - Premium quality product`,
                  inStock: available,
                  isJaba,
                  isFeatured,
                })
              }
            })
          
          // Convert map to array and create EcommerceProduct objects
          const mappedProducts: EcommerceProduct[] = Array.from(productMap.values()).map((p) => {
            // Use lowest price as the main price
            const lowestPrice = Math.min(...p.sizes.map(s => s.price))
            
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              price: lowestPrice,
              image: p.image,
              description: p.description,
              sizes: p.sizes,
              rating: 4.5,
              reviewCount: 0,
              reviews: [],
              inStock: p.inStock,
              featured: p.isFeatured ?? false,
              trending: false,
              isJaba: p.isJaba ?? false,
            } as EcommerceProduct
          })
          
          applyProductData(mappedProducts)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        applyProductData([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [applyProductData])

  // Sync search query with URL parameter on mount
  useEffect(() => {
    const urlSearch = searchParams.get("search")
    if (urlSearch !== null && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount to initialize from URL

  // Sync category from URL when it changes (e.g. user clicks "Jaba Section" or back to Shop)
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category")
    setSelectedCategory(categoryFromUrl || "all")
  }, [searchParams])

  // Page title: descriptive name | Catha Lounge
  useEffect(() => {
    const category = searchParams.get("category")
    document.title = category === "infused-jaba" ? "Jaba Section | Infusion Jaba" : "Shop | Infusion Jaba"
  }, [searchParams])

  // Filter and sort products - using debounced search
  const filteredProducts = useMemo(() => {
    let filtered = [...products]

    // Search filter (using debounced query for better performance)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.trim().toLowerCase()
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      )
    }

    // Category filter — when infused-jaba, show only products with isJaba ticked
    if (selectedCategory === "infused-jaba") {
      filtered = filtered.filter((p) => p.isJaba === true)
    } else if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => {
        const category = categories.find(c => c.id === selectedCategory)
        return category && p.category === category.name
      })
    }

    // Size filter
    if (selectedSize !== "all") {
      filtered = filtered.filter((p) => p.sizes.some((s) => s.size === selectedSize && s.available))
    }

    // Price range filter
    filtered = filtered.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1])

    // Featured filter — only on main Shop (hidden on Jaba Section)
    if (selectedCategory !== "infused-jaba" && showFeatured) {
      filtered = filtered.filter((p) => p.featured)
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "trending":
        filtered = filtered.filter((p) => p.trending)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      default: // latest
        break
    }

    return filtered
  }, [debouncedSearchQuery, selectedCategory, selectedSize, priceRange, sortBy, showFeatured, products, categories])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage)
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage
    return filteredProducts.slice(startIndex, startIndex + productsPerPage)
  }, [filteredProducts, currentPage, productsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, selectedCategory, selectedSize, priceRange, sortBy, showFeatured])

  const doAddToCart = useCallback(async (product: EcommerceProduct) => {
    const defaultSize = product.sizes?.length ? product.sizes.find(s => s.available) || product.sizes[0] : null
    const size = defaultSize?.size
    const price = defaultSize?.price ?? product.price
    const ok = await addItem({ id: product.id, name: product.name, price, image: product.image, quantity: 1, size })
    if (ok) {
      toast.success(`${product.name}${size ? ` (${size})` : ''} added to cart`, { duration: 4000 })
    } else {
      toast.error(`Could not add ${product.name}. Try again.`)
    }
    return ok
  }, [addItem])

  const handleAddToCart = useCallback(async (product: EcommerceProduct) => {
    if (!session.signedIn) {
      openLoginModal()
      return
    }
    await doAddToCart(product)
  }, [session.signedIn, doAddToCart, openLoginModal])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCategory("all")
    setSelectedSize("all")
    setPriceRange([0, maxPrice])
    setShowFeatured(false)
  }

  const hasActiveFilters =
    selectedCategory !== "all" ||
    selectedSize !== "all" ||
    priceRange[0] !== 0 ||
    priceRange[1] !== maxPrice ||
    showFeatured

  // Search suggestions for dropdown (using immediate searchQuery for responsiveness)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    
    const query = searchQuery.trim().toLowerCase()
    return products
      .filter((p) => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      )
      .slice(0, 5) // Limit to 5 suggestions
  }, [searchQuery, products])

  // Calculate total cart items (sum of quantities)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f1e8] via-[#f2ece2] to-[#ece4d8]">
      <EcommerceHeader cartCount={cartItemCount} />

      <main className="container mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-[110px] md:pb-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-[#2a201b] sm:text-4xl mb-2 font-heading">
            {selectedCategory === "infused-jaba" ? "Jaba Section" : "Shop"}
          </h1>
          <p className="text-[#6f5d4f]">
            {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found
          </p>
        </div>

        <div className="flex gap-4 lg:gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6 bg-[#fff9f2]/92 backdrop-blur-sm rounded-2xl p-6 border border-[#ddccb4] shadow-[0_10px_24px_rgba(45,30,18,0.10)]">
              {/* Desktop Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchDropdown(true)
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setShowSearchDropdown(true)
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSearchDropdown(false), 200)
                  }}
                  className="pl-9 h-10 rounded-lg bg-[#fffdf8] border-[#d7c6ad] focus:border-[#9b7740]/55 focus:ring-2 focus:ring-[#9b7740]/18 text-sm text-[#2a201b]"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setShowSearchDropdown(false)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                
                {/* Desktop Search Dropdown */}
                {showSearchDropdown && searchQuery.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#fffaf3]/95 backdrop-blur-sm rounded-xl border border-[#dcc8a8] shadow-lg z-50 max-h-80 overflow-y-auto">
                    {searchSuggestions.length > 0 ? (
                    <div className="p-2">
                      {searchSuggestions.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => {
                            setSearchQuery(product.name)
                            setShowSearchDropdown(false)
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f4e7d2] transition-colors text-left"
                        >
                          <div className="relative h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden bg-[#f2e9db] border border-[#e2d3be]">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{getProductDisplayName(product)}</p>
                            <p className="text-[10px] text-gray-500 truncate">{product.category}</p>
                            <p className="text-xs font-bold text-[#7a5a27] mt-0.5">
                              KES {product.price.toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    ) : (
                      <div className="p-6 text-center">
                        <Search className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-600">No products found</p>
                        <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#2a201b]">
                  {selectedCategory === "infused-jaba" ? "Jaba Filters" : "Filters"}
                </h2>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-[#7a5a27] hover:text-[#7a5a27] hover:bg-[#f5ead8]">
                    Clear
                  </Button>
                )}
              </div>

              {/* Category Filter — hidden on Jaba Section */}
              {selectedCategory !== "infused-jaba" && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-[#2a201b]">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl bg-[#fffdf8] border-[#dccab0] text-[#2a201b]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} ({cat.productCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Jaba Section — Special house selections label */}
              {selectedCategory === "infused-jaba" && (
                <div className="rounded-xl bg-[#f6ecda] border border-[#ddc8a8] px-3 py-2.5">
                  <p className="text-xs font-semibold text-[#7a5a27] uppercase tracking-wide">Special house selections</p>
                  <p className="text-[11px] text-[#6f5d4f] mt-0.5">Products with Jaba Product enabled</p>
                </div>
              )}

              {/* Size Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-[#2a201b]">Size</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger className="rounded-xl bg-[#fffdf8] border-[#dccab0] text-[#2a201b]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="500ml">500ml</SelectItem>
                    <SelectItem value="1L">1L</SelectItem>
                    <SelectItem value="2L">2L</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-[#2a201b]">
                  Price Range: KES {priceRange[0].toLocaleString()} - KES {priceRange[1].toLocaleString()}
                </Label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={maxPrice}
                  min={0}
                  step={Math.max(100, Math.floor(maxPrice / 100))}
                  className="w-full"
                />
              </div>

              {/* Featured Toggle — only on main Shop */}
              {selectedCategory !== "infused-jaba" && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={showFeatured}
                    onChange={(e) => setShowFeatured(e.target.checked)}
                    className="h-4 w-4 rounded border-[#ccb894] accent-[#8f6a2f]"
                  />
                  <Label htmlFor="featured" className="text-sm font-medium cursor-pointer text-[#2a201b]">
                    Featured Only
                  </Label>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Search - Prominent */}
            <div className="lg:hidden mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchDropdown(true)
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setShowSearchDropdown(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow clicks on dropdown items
                    setTimeout(() => setShowSearchDropdown(false), 200)
                  }}
                  className="pl-11 h-11 rounded-xl bg-[#fffaf3]/95 backdrop-blur-sm border-[#d8c7ad] focus:border-[#9b7740]/55 focus:ring-2 focus:ring-[#9b7740]/18"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setShowSearchDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                
                {/* Search Dropdown */}
                {showSearchDropdown && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#fffaf3]/95 backdrop-blur-sm rounded-xl border border-[#dcc8a8] shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {searchSuggestions.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => {
                            setSearchQuery(product.name)
                            setShowSearchDropdown(false)
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#f4e7d2] transition-colors text-left"
                        >
                          <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-[#f2e9db] border border-[#e2d3be]">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{getProductDisplayName(product)}</p>
                            <p className="text-xs text-gray-500 truncate">{product.category}</p>
                            <p className="text-sm font-bold text-[#7a5a27] mt-0.5">
                              KES {product.price.toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Filters & Sort */}
            <div className="lg:hidden mb-5 flex flex-col sm:flex-row gap-2.5">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full sm:flex-1 rounded-xl border-[#d7c6ac] bg-[#fffaf3] text-[#6b4d1f] hover:bg-[#f4e7d2]">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <span className="ml-2 h-5 w-5 rounded-full bg-[#8f6a2f] text-white text-xs flex items-center justify-center">
                        !
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] max-h-[600px] rounded-t-3xl border-t-4 border-[#b58a4a] bg-gradient-to-b from-[#fffdf8] to-[#f3ebde] overflow-y-auto">
                  <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300 mb-4" />
                  <SheetHeader className="px-6 pb-4 border-b border-[#10B981]/20">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Filter className="h-5 w-5 text-[#8f6a2f]" />
                        Filters
                      </SheetTitle>
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="text-xs h-7 px-3 text-[#7a5a27] hover:bg-[#f2e7d4] rounded-lg"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                  </SheetHeader>
                  <div className="px-6 py-4 space-y-5">
                    {/* Mobile Filters Content */}
                    {selectedCategory !== "infused-jaba" && (
                      <div className="space-y-2.5">
                        <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#8f6a2f]"></div>
                          Category
                        </Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="rounded-xl border-2 border-[#dcc8a8] bg-[#fffdf8] h-11 focus:border-[#9b7740]/55">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name} ({cat.productCount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedCategory === "infused-jaba" && (
                      <div className="rounded-xl bg-[#f6ecda] border-2 border-[#ddc8a8] px-4 py-3">
                        <p className="text-xs font-bold text-[#7a5a27] uppercase tracking-wide">Special house selections</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">Products with Jaba Product enabled</p>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#8f6a2f]"></div>
                        Size
                      </Label>
                      <Select value={selectedSize} onValueChange={setSelectedSize}>
                        <SelectTrigger className="rounded-xl border-2 border-[#dcc8a8] bg-[#fffdf8] h-11 focus:border-[#9b7740]/55">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sizes</SelectItem>
                          <SelectItem value="500ml">500ml</SelectItem>
                          <SelectItem value="1L">1L</SelectItem>
                          <SelectItem value="2L">2L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#8f6a2f]"></div>
                        Price Range
                      </Label>
                      <div className="bg-[#fffaf3] rounded-xl p-4 border-2 border-[#ddc8a8]">
                        <div className="text-xs font-semibold text-[#7a5a27] mb-3 text-center">
                          KES {priceRange[0].toLocaleString()} - KES {priceRange[1].toLocaleString()}
                        </div>
                        <Slider
                          value={priceRange}
                          onValueChange={setPriceRange}
                          max={50000}
                          min={0}
                          step={1000}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {selectedCategory !== "infused-jaba" && (
                      <div className="flex items-center space-x-3 p-3 bg-[#fffaf3] rounded-xl border-2 border-[#ddc8a8]">
                        <input
                          type="checkbox"
                          id="featured-mobile"
                          checked={showFeatured}
                          onChange={(e) => setShowFeatured(e.target.checked)}
                          className="h-5 w-5 rounded border-2 border-[#ccb894] accent-[#8f6a2f] cursor-pointer"
                        />
                        <Label htmlFor="featured-mobile" className="text-sm font-semibold cursor-pointer text-gray-800 flex-1">
                          Featured Products Only
                        </Label>
                      </div>
                    )}

                    <div className="pt-4 pb-2">
                      <Button 
                        onClick={() => setMobileFiltersOpen(false)}
                        className="w-full rounded-xl bg-gradient-to-r from-[#8f6a2f] to-[#755320] hover:from-[#7a5b2a] hover:to-[#67471b] text-[#fff7ea] font-semibold h-12 shadow-lg"
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:flex-1 rounded-xl border-[#d7c6ac] bg-[#fffaf3] text-[#2a201b]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="price-low">Lowest Price</SelectItem>
                  <SelectItem value="price-high">Highest Price</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Sort */}
            <div className="hidden lg:flex items-center justify-between mb-6">
              <p className="text-sm text-[#6f5d4f]">
                Showing {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
              </p>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-[#2a201b] font-medium">Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 rounded-xl bg-[#fffaf3] border-[#dccab0] text-[#2a201b]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest</SelectItem>
                    <SelectItem value="price-low">Lowest Price</SelectItem>
                    <SelectItem value="price-high">Highest Price</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white/90 backdrop-blur-sm rounded-2xl border border-[#10B981]/20 shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[#10B981] mb-4" />
                <p className="text-lg font-semibold text-[#1F2937] mb-2">Loading products...</p>
                <p className="text-[#6B7280]">Please wait</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border-[#d7c6ac] bg-[#fffaf3] text-[#7a5a27] hover:bg-[#f4e7d2] disabled:opacity-50 px-3 sm:px-4"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`rounded-xl min-w-9 ${
                              currentPage === pageNum
                                ? "bg-[#8f6a2f] text-white hover:bg-[#7a5a27]"
                                : "border-[#d7c6ac] bg-[#fffaf3] text-[#7a5a27] hover:bg-[#f4e7d2]"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border-[#d7c6ac] bg-[#fffaf3] text-[#7a5a27] hover:bg-[#f4e7d2] disabled:opacity-50 px-3 sm:px-4"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-[#fffaf3]/95 backdrop-blur-sm rounded-2xl border border-[#ddccb4] shadow-[0_10px_24px_rgba(45,30,18,0.10)]">
                <div className="h-16 w-16 rounded-full bg-[#f3e7d4] border border-[#ddccb4] flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-[#8f6a2f]" />
                </div>
                <p className="text-lg font-semibold text-[#2a201b] mb-2">No bottles match this selection</p>
                <p className="text-[#6f5d4f] mb-6 max-w-md">
                  {debouncedSearchQuery.trim()
                    ? `No drinks or products match "${debouncedSearchQuery}"`
                    : hasActiveFilters
                    ? "Try adjusting your filters"
                    : "No products available yet. Check back for new curated arrivals."}
                </p>
                <Button onClick={clearFilters} variant="outline" className="rounded-xl border-[#d7c6ac] bg-[#fff4e3] text-[#6b4d1f] hover:bg-[#f1e2ca]">
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ShopPageContent />
    </Suspense>
  )
}
