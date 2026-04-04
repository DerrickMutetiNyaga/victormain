"use client"

import { Suspense, useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, ShoppingCart, User, Menu, X, Home, Package, Sparkles, MapPin, ArrowRight, Phone } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useDebounce } from "@/hooks/use-debounce"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { formatPhoneDisplay } from "@/lib/phone-utils"

interface HeaderProps {
  cartCount?: number
}

interface Product {
  id: string
  name: string
  category: string
  price: number
  image: string
  stock: number
  size?: string
}

function getDisplayName(p: Product): string {
  if (p.size && p.size !== "Standard") return `${p.name} ${p.size}`
  return p.name
}

function EcommerceHeaderContent({ cartCount = 0 }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session } = useShopSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debouncedSearchQuery = useDebounce(searchQuery, 200)

  const loggedInUser = session.signedIn && session.customer
  const userDisplay = loggedInUser
    ? (session.customer!.name?.trim() || formatPhoneDisplay(session.customer!.phone))
    : null

  // Fetch products for search suggestions
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/catha/inventory', {
          cache: 'force-cache',
          next: { revalidate: 60 }
        })
        if (!response.ok) return
        
        const data = await response.json()
        if (data.success && data.products) {
          // Map to simplified product structure
          const mappedProducts: Product[] = data.products
            .map((p: any) => ({
              id: p._id || p.id,
              name: p.name || '',
              category: p.category || 'other',
              price: p.price || 0,
              image: p.image || '/placeholder.svg',
              stock: p.stock || 0,
              size: p.size || undefined,
            }))
          
          // Group by name to avoid duplicates
          const productMap = new Map<string, Product>()
          mappedProducts.forEach(p => {
            if (!productMap.has(p.name) || productMap.get(p.name)!.stock < p.stock) {
              productMap.set(p.name, p)
            }
          })
          
          setProducts(Array.from(productMap.values()))
        }
      } catch (error) {
        console.error('Error fetching products for search:', error)
      }
    }
    
    fetchProducts()
  }, [])

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearchQuery.trim() || debouncedSearchQuery.length < 2) return []
    
    const query = debouncedSearchQuery.trim().toLowerCase()
    return products
      .filter((p) => 
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      )
      .slice(0, 5)
  }, [debouncedSearchQuery, products])

  // Handle search submission
  const handleSearch = (query?: string) => {
    const finalQuery = query || searchQuery.trim()
    if (!finalQuery) return
    
    setShowSuggestions(false)
    setSearchQuery("")
    setMobileSearchOpen(false)
    router.push(`/shop?search=${encodeURIComponent(finalQuery)}`)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || searchSuggestions.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        handleSearch()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => 
        prev < searchSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < searchSuggestions.length) {
        handleSearch(searchSuggestions[selectedSuggestionIndex].name)
      } else if (searchQuery.trim()) {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(-1)
  }, [searchSuggestions.length])

  const mobileNavItems = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/", accent: "from-emerald-500 to-green-600" },
    { href: "/shop", label: "Shop", icon: Package, active: pathname === "/shop", accent: "from-blue-500 to-cyan-600" },
    {
      href: "/shop?category=infused-jaba",
      label: "Jaba",
      icon: Sparkles,
      active: pathname === "/shop" && searchParams.get("category") === "infused-jaba",
      accent: "from-rose-500 to-pink-600",
    },
    { href: "/cart", label: "Cart", icon: ShoppingCart, active: pathname === "/cart" || pathname === "/checkout", accent: "from-amber-500 to-orange-600" },
    { href: "/account", label: "Account", icon: User, active: pathname === "/account", accent: "from-violet-500 to-purple-600" },
  ]

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#10B981] to-[#0E9F6E] rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#0E9F6E] shadow-lg shadow-green-900/30">
                <span className="text-xl font-black text-white font-heading">C</span>
              </div>
            </div>
            <div>
              <span className="text-xl font-black text-[#1F2937] tracking-tight font-heading">Catha Lounge</span>
              <p className="text-[10px] text-[#6B7280] font-medium tracking-widest uppercase">
                Restaurant & Bar
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/shop"
              className="text-sm font-semibold text-[#1F2937] hover:text-[#10B981] transition-colors relative group"
            >
              Shop
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#10B981] to-[#0E9F6E] group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/shop?category=infused-jaba"
              className="text-sm font-semibold text-[#1F2937] hover:text-[#10B981] transition-colors relative group"
            >
              Jaba Section
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#10B981] to-[#0E9F6E] group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/account"
              className="text-sm font-semibold text-[#1F2937] hover:text-[#10B981] transition-colors relative group"
            >
              Account
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#10B981] to-[#0E9F6E] group-hover:w-full transition-all duration-300" />
            </Link>
          </nav>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280] group-focus-within:text-[#10B981] transition-colors z-10" />
              <Input
                ref={searchInputRef}
                placeholder="Search drinks & products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2 && searchSuggestions.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => {
                  // Delay to allow clicks on suggestions
                  setTimeout(() => setShowSuggestions(false), 200)
                }}
                className="pl-12 pr-10 h-10 rounded-full bg-white border border-[#E5E7EB] focus-visible:border-[#10B981]/50 focus-visible:ring-[#10B981]/20 text-[#1F2937] placeholder:text-[#9CA3AF] transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setShowSuggestions(false)
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937] transition-colors z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Suggestions Dropdown */}
              {showSuggestions && debouncedSearchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl border border-[#10B981]/30 shadow-xl z-50 max-h-80 overflow-y-auto">
                  {searchSuggestions.length > 0 ? (
                  <div className="p-2">
                    {searchSuggestions.map((product, index) => (
                      <button
                        key={product.id}
                        onClick={() => handleSearch(product.name)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                          selectedSuggestionIndex === index
                            ? "bg-[#10B981]/10 border border-[#10B981]/30"
                            : "hover:bg-[#10B981]/5 border border-transparent"
                        )}
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-[#10B981]/10">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{getDisplayName(product)}</p>
                          <p className="text-xs text-gray-500 capitalize">{product.category}</p>
                          <p className="text-sm font-bold text-[#10B981] mt-1">
                            KES {product.price.toLocaleString()}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No products found</p>
                      <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSearchOpen(true)}
              className="lg:hidden h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] touch-manipulation"
              title="Search"
            >
              <Search className="h-7 w-7" />
            </Button>

            {/* Cart */}
            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] transition-all group touch-manipulation"
                title="Shopping Cart"
              >
                <ShoppingCart className="h-7 w-7 transition-transform group-hover:scale-110" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br from-[#10B981] to-[#0E9F6E] text-white border-2 border-white shadow-lg animate-pulse">
                    {cartCount > 9 ? '9+' : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Logged-in user indicator — visible across all e-commerce pages for tracking/debugging */}
            <div className="hidden sm:flex items-center" title={userDisplay ? `Logged in as ${userDisplay}` : "Not signed in"}>
              {userDisplay ? (
                <Link href="/account">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 hover:bg-[#10B981]/15 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                    <span className="text-xs font-semibold text-[#1F2937] max-w-[120px] truncate">
                      {userDisplay}
                    </span>
                  </div>
                </Link>
              ) : (
                <span className="text-[10px] font-medium text-[#9CA3AF] px-2 py-1 rounded bg-[#F3F4F6]">
                  Not signed in
                </span>
              )}
            </div>

            {/* Login/Account */}
            <Link href="/account">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] touch-manipulation", userDisplay ? "sm:hidden" : "")}
                title={userDisplay ? `Account · ${userDisplay}` : "Account"}
              >
                <User className="h-7 w-7" />
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] touch-manipulation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menu"
            >
              {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </Button>
          </div>
          </div>

        {/* Mobile Search Modal */}
        {mobileSearchOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
              onClick={() => setMobileSearchOpen(false)}
            />
            
            {/* Mobile Search Modal */}
            <div className="lg:hidden fixed inset-x-4 top-4 z-50 animate-in slide-in-from-top-4 duration-300">
              <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#10B981]/20 overflow-hidden">
                {/* Search Input */}
                <div className="relative p-4 border-b border-[#E5E7EB]">
                  <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280] z-10" />
                  <Input
                    placeholder="Search drinks & products..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (searchQuery.trim().length >= 2 && searchSuggestions.length > 0) {
                        setShowSuggestions(true)
                      }
                    }}
                    className="pl-12 pr-12 h-12 rounded-xl bg-gray-50 border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 text-[#1F2937]"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setShowSuggestions(false)
                      setMobileSearchOpen(false)
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Search Suggestions */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {searchSuggestions.map((product, index) => (
                        <button
                          key={product.id}
                          onClick={() => handleSearch(product.name)}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                            selectedSuggestionIndex === index
                              ? "bg-[#10B981]/10 border border-[#10B981]/30"
                              : "hover:bg-[#10B981]/5 border border-transparent"
                          )}
                        >
                          <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-[#10B981]/10">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{getDisplayName(product)}</p>
                            <p className="text-xs text-gray-500 capitalize">{product.category}</p>
                            <p className="text-sm font-bold text-[#10B981] mt-1">
                              KES {product.price.toLocaleString()}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {showSuggestions && searchQuery.trim().length >= 2 && searchSuggestions.length === 0 && (
                  <div className="p-8 text-center">
                    <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No products found</p>
                    <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
                  </div>
                )}

                {/* Search Hint */}
                {!showSuggestions && searchQuery.trim().length < 2 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Mobile Menu Overlay & Modal */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Mobile Menu Modal */}
            <div className="md:hidden fixed inset-x-4 top-20 z-50 animate-in slide-in-from-top-4 duration-300">
              <div className="bg-gradient-to-br from-white via-[#F0FDF4]/40 to-white rounded-2xl shadow-2xl border-2 border-[#10B981]/20 overflow-hidden backdrop-blur-xl">
                {/* Header */}
                <div className="px-6 py-5 border-b-2 border-[#10B981]/20 flex items-center justify-between bg-gradient-to-r from-[#10B981]/10 via-[#F0FDF4]/60 to-transparent">
                  <div>
                    <h3 className="text-gray-900 font-bold text-lg">Menu</h3>
                    <p className="text-[#10B981] text-sm mt-0.5 font-semibold">
                      {userDisplay ? "Logged in as " + userDisplay : "Navigate quickly"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    className="h-9 w-9 rounded-lg hover:bg-[#10B981]/20 text-gray-700 hover:text-[#10B981] transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Menu Items */}
                <div className="p-3 bg-gradient-to-b from-white to-[#F0FDF4]/20">
                  <Link
                    href="/"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#10B981]/10 hover:to-transparent border-2 border-gray-200 hover:border-[#10B981] transition-all duration-200 group bg-white/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/10 flex items-center justify-center group-hover:bg-[#10B981] transition-all shadow-sm">
                      <Home className="h-5 w-5 text-[#10B981] group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base group-hover:text-[#10B981] transition-colors">Home</p>
                      <p className="text-sm text-gray-700 font-medium">Back to homepage</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-500 group-hover:text-[#10B981] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/shop"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#10B981]/10 hover:to-transparent border-2 border-gray-200 hover:border-[#10B981] transition-all duration-200 group bg-white/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center group-hover:bg-blue-500 transition-all shadow-sm">
                      <Package className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base group-hover:text-[#10B981] transition-colors">Shop</p>
                      <p className="text-sm text-gray-700 font-medium">Browse all products</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-500 group-hover:text-[#10B981] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/shop?category=infused-jaba"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#10B981]/10 hover:to-transparent border-2 border-gray-200 hover:border-[#10B981] transition-all duration-200 group bg-white/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#BE123C]/20 to-[#BE123C]/10 flex items-center justify-center group-hover:bg-[#BE123C] transition-all shadow-sm">
                      <Sparkles className="h-5 w-5 text-[#BE123C] group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base group-hover:text-[#10B981] transition-colors">Jaba Section</p>
                      <p className="text-sm text-gray-700 font-medium">Premium infused drinks</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-500 group-hover:text-[#10B981] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/account"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#10B981]/10 hover:to-transparent border-2 border-gray-200 hover:border-[#10B981] transition-all duration-200 group bg-white/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center group-hover:bg-purple-500 transition-all shadow-sm">
                      <User className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base group-hover:text-[#10B981] transition-colors">Account</p>
                      <p className="text-sm text-gray-700 font-medium">Manage your profile</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-500 group-hover:text-[#10B981] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/track"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#10B981]/10 hover:to-transparent border-2 border-gray-200 hover:border-[#10B981] transition-all duration-200 group bg-white/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center group-hover:bg-orange-500 transition-all shadow-sm">
                      <MapPin className="h-5 w-5 text-orange-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base group-hover:text-[#10B981] transition-colors">Track Order</p>
                      <p className="text-sm text-gray-700 font-medium">Check order status</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-500 group-hover:text-[#10B981] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#D1FAE5]/35 via-white/45 to-transparent" />
        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <nav className="relative rounded-2xl border border-[#10B981]/15 bg-gradient-to-b from-white/95 via-[#F0FDF4]/85 to-white/90 p-1.5 backdrop-blur-xl shadow-[0_10px_24px_rgba(16,185,129,0.14)]">
            <div className="grid grid-cols-5 gap-1">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-all duration-200",
                    item.active
                      ? "bg-gradient-to-b from-[#ECFDF5]/90 to-white/80 text-[#065F46]"
                      : "text-[#6B7280] hover:bg-[#F0FDF4]/55 hover:text-[#10B981]",
                  )}
                >
                  {item.active && <span className="absolute left-1/2 top-1 h-1 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#10B981] to-[#0E9F6E]" />}

                  <span
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                      item.active
                        ? `bg-gradient-to-br ${item.accent} text-white shadow-md`
                        : "bg-[#F3F4F6] text-[#6B7280]",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>{item.label}</span>

                  {item.label === "Cart" && cartCount > 0 && (
                    <Badge className="absolute right-1 top-0.5 h-5 min-w-5 rounded-full border border-white bg-gradient-to-br from-[#10B981] to-[#0E9F6E] px-1 text-[10px] font-bold text-white shadow">
                      {cartCount > 9 ? "9+" : cartCount}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </>
  )
}

function EcommerceHeaderFallback({ cartCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#0E9F6E] shadow-lg shadow-green-900/30">
              <span className="text-xl font-black text-white font-heading">C</span>
            </div>
            <div>
              <span className="text-xl font-black text-[#1F2937] tracking-tight font-heading">Catha Lounge</span>
              <p className="text-[10px] text-[#6B7280] font-medium tracking-widest uppercase">
                Restaurant & Bar
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] transition-all group touch-manipulation"
                title="Shopping Cart"
              >
                <ShoppingCart className="h-7 w-7 transition-transform group-hover:scale-110" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br from-[#10B981] to-[#0E9F6E] text-white border-2 border-white shadow-lg">
                    {cartCount > 9 ? "9+" : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export function EcommerceHeader(props: HeaderProps) {
  return (
    <Suspense fallback={<EcommerceHeaderFallback cartCount={props.cartCount} />}>
      <EcommerceHeaderContent {...props} />
    </Suspense>
  )
}

