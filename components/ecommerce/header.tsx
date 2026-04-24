"use client"

import { Suspense, useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, ShoppingCart, User, Menu, X, Home, Package, Sparkles, MapPin, ArrowRight, Phone, Wine, GlassWater } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useDebounce } from "@/hooks/use-debounce"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { formatPhoneDisplay } from "@/lib/phone-utils"
import { SiteLogo } from "@/components/branding/site-logo"

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
  const isShopActive = pathname === "/shop"
  const isJabaActive = pathname === "/shop" && (searchParams.get("category") === "infused-jaba")
  const isAccountActive = pathname === "/account"

  // Fetch products for search suggestions
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/catha/inventory?visibleOnly=true', {
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
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    { href: "/shop", label: "Shop", icon: Package, active: pathname === "/shop" },
    { href: "/cart", label: "Cart", icon: ShoppingCart, active: pathname === "/cart" || pathname === "/checkout" },
    { href: "/account", label: "Profile", icon: User, active: pathname === "/account" },
  ]

  return (
    <>
      <header className="relative z-50 w-full border-b border-[var(--brand-border-beige)] bg-[var(--brand-cream-soft)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--brand-cream-soft)]/90 shadow-sm md:sticky md:top-0">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between md:h-20">
          {/* Logo */}
          <Link href="/" className="flex min-w-0 items-center py-1">
            <SiteLogo
              priority
              className="h-12 w-[168px] md:h-16 md:w-[230px] lg:w-[260px]"
              imageClassName="drop-shadow-[0_7px_16px_rgba(0,0,0,0.3)]"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <Link
              href="/shop"
              className={cn(
                "text-sm font-semibold transition-colors relative group",
                isShopActive ? "text-[var(--brand-green-strong)]" : "text-[#2a211d] hover:text-[var(--brand-green)]"
              )}
            >
              Shop
              <span className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[var(--brand-green)] to-[var(--brand-orange)] transition-all duration-300",
                isShopActive ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </Link>
            <Link
              href="/shop?category=infused-jaba"
              className={cn(
                "text-sm font-semibold transition-colors relative group",
                isJabaActive ? "text-[var(--brand-green-strong)]" : "text-[#2a211d] hover:text-[var(--brand-green)]"
              )}
            >
              Jaba Section
              <span className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[var(--brand-green)] via-[var(--brand-orange)] to-[var(--brand-orange-soft)] transition-all duration-300",
                isJabaActive ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </Link>
            <Link
              href="/account"
              className={cn(
                "text-sm font-semibold transition-colors relative group",
                isAccountActive ? "text-[var(--brand-green-strong)]" : "text-[#2a211d] hover:text-[var(--brand-green)]"
              )}
            >
              Account
              <span className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[var(--brand-green)] to-[var(--brand-orange)] transition-all duration-300",
                isAccountActive ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </Link>
          </nav>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-xs mx-8">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280] group-focus-within:text-[var(--brand-green)] transition-colors z-10" />
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
                className="pl-12 pr-10 h-9 rounded-full bg-[#fbf7f2] border border-[#d9cfc3] focus-visible:border-[var(--brand-green)]/45 focus-visible:ring-[var(--brand-green)]/20 text-[#2a1f1b] placeholder:text-[#9a8d7e] transition-all shadow-sm"
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl border border-[var(--brand-green)]/30 shadow-xl z-50 max-h-80 overflow-y-auto">
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
                            ? "bg-[var(--brand-green)]/10 border border-[var(--brand-green)]/30"
                            : "hover:bg-[var(--brand-green)]/5 border border-transparent"
                        )}
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-[var(--brand-green)]/10">
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
                          <p className="text-sm font-bold text-[var(--brand-green-strong)] mt-1">
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
          <div className="flex items-center gap-2 md:gap-3.5">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSearchOpen(true)}
              className="h-9 w-9 rounded-full hover:bg-[#eadfcd] hover:text-[#6d5231] touch-manipulation lg:hidden"
              title="Search"
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>

            {/* Cart */}
            <Link href="/cart" className="hidden md:block">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-full hover:bg-[#eadfcd] hover:text-[var(--brand-green)] transition-all group touch-manipulation md:h-12 md:w-12 md:hover:bg-[var(--brand-green)]/10 md:hover:text-[var(--brand-green)]"
                title="Shopping Cart"
              >
                <ShoppingCart className="h-[18px] w-[18px] transition-transform group-hover:scale-110 md:h-7 md:w-7" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-[#1F8A3B] text-[#FFFFFF] border-2 border-white shadow-lg animate-pulse">
                    {cartCount > 9 ? '9+' : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Logged-in user indicator — visible across all e-commerce pages for tracking/debugging */}
            <div className="hidden md:flex items-center" title={userDisplay ? `Logged in as ${userDisplay}` : "Not signed in"}>
              {userDisplay ? (
                <Link href="/account">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brand-green)]/10 border border-[var(--brand-green)]/30 hover:bg-[var(--brand-green)]/15 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[var(--brand-green)] shrink-0" />
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

            {/* Mobile menu trigger removed to keep top bar as utility header */}

            {/* Desktop account only */}
            <Link href="/account" className={cn("hidden md:block", userDisplay ? "md:hidden" : "")}>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full hover:bg-[var(--brand-green)]/10 hover:text-[var(--brand-green)] touch-manipulation"
                title={userDisplay ? `Account · ${userDisplay}` : "Account"}
              >
                <User className="h-7 w-7" />
              </Button>
            </Link>
          </div>
          </div>

        {/* Mobile Search Modal */}
        {mobileSearchOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-[#1f1714]/55 backdrop-blur-md z-40 lg:hidden animate-in fade-in duration-200"
              onClick={() => setMobileSearchOpen(false)}
            />
            
            {/* Mobile Search Modal */}
            <div className="lg:hidden fixed inset-x-4 top-4 z-50 animate-in slide-in-from-top-4 duration-300">
              <div className="bg-gradient-to-b from-[#fffdf8] via-[#fbf4e9] to-[#f3e8d8] rounded-2xl shadow-[0_22px_56px_rgba(32,20,12,0.35)] border border-[var(--brand-border-beige)] overflow-hidden">
                {/* Search Input */}
                <div className="relative p-4 border-b border-[#e1d4c2]">
                  <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7a6a58] z-10" />
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
                    className="pl-12 pr-12 h-12 rounded-xl bg-[#fffdf8] border-[var(--brand-border-beige)] focus:border-[var(--brand-green)]/60 focus:ring-2 focus:ring-[var(--brand-green)]/20 text-[#2a201b] placeholder:text-[#9a8d7e]"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setShowSuggestions(false)
                      setMobileSearchOpen(false)
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#7a6a58] hover:text-[#2a201b]"
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
                              ? "bg-[var(--brand-green)]/10 border border-[var(--brand-green)]/35"
                              : "hover:bg-[#f8efe2] border border-transparent"
                          )}
                        >
                          <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-[#f2e9db] border border-[#e1d2bc]">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#2a201b] truncate">{getDisplayName(product)}</p>
                            <p className="text-xs text-[#7f6e5d] capitalize">{product.category}</p>
                            <p className="text-sm font-bold text-[var(--brand-green-strong)] mt-1">
                              KES {product.price.toLocaleString()}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-[#9a8d7e] flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {showSuggestions && searchQuery.trim().length >= 2 && searchSuggestions.length === 0 && (
                  <div className="p-8 text-center">
                    <Search className="h-12 w-12 text-[#b5a695] mx-auto mb-3" />
                    <p className="text-[#5e4e41] font-medium">No products found</p>
                    <p className="text-sm text-[#8f7f6e] mt-1">Try another bottle name, category, or size</p>
                  </div>
                )}

                {/* Curated quick suggestions */}
                {!showSuggestions && searchQuery.trim().length < 2 && (
                  <div className="p-4 border-t border-[#e1d4c2]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-green-strong)] font-semibold mb-2">Popular searches</p>
                    <div className="flex flex-wrap gap-2">
                      {["Whiskey", "Red Wine", "Gin", "Infused Jaba", "Cocktail Mixers"].map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setSearchQuery(term)
                            setShowSuggestions(true)
                          }}
                          className="rounded-full border border-[#d7c6ac] bg-[#fff8ee] px-3 py-1 text-xs font-medium text-[#5f4e3f] hover:bg-[var(--brand-green)]/10 hover:border-[var(--brand-green)]/35 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
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
        <nav
          className="w-full border-t border-[#3a2f2a] bg-[#120f0d] px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))]"
          style={{ boxShadow: "0 -6px 14px rgba(0,0,0,0.24)" }}
        >
          <div className="grid grid-cols-4 gap-1.5">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11.5px] font-medium leading-none transition-all duration-200 min-h-[58px]",
                    item.active
                      ? "bg-[#221a17] text-[#f4e6c7]"
                      : "text-[#eadfca] hover:bg-[#ffffff08] hover:text-[#f4e6c7]",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-8.5 w-8.5 items-center justify-center rounded-md transition-all duration-200",
                      item.active
                        ? "text-[var(--brand-orange-soft)]"
                        : "text-[#eadfca]",
                    )}
                  >
                    <item.icon className="h-[19px] w-[19px] stroke-[2.1]" />
                    {item.label === "Cart" && cartCount > 0 && (
                      <Badge className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#1a1414] bg-[#1F8A3B] px-1 text-[10px] font-bold leading-none text-[#FFFFFF] shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                        {cartCount > 99 ? "99+" : cartCount}
                      </Badge>
                    )}
                  </span>
                  <span className="tracking-[0.01em]">{item.label}</span>
                </Link>
              ))}
          </div>
        </nav>
      </div>

    </>
  )
}

function EcommerceHeaderFallback({ cartCount = 0 }: HeaderProps) {
  return (
    <header className="relative z-50 w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 shadow-sm md:sticky md:top-0">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between md:h-20">
          <Link href="/" className="flex items-center gap-3">
            <SiteLogo
              className="h-12 w-[168px] md:h-16 md:w-[230px]"
              imageClassName="drop-shadow-[0_7px_16px_rgba(0,0,0,0.24)]"
            />
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-12 w-12 rounded-full hover:bg-green-50 hover:text-[#10B981] transition-all group touch-manipulation"
                title="Shopping Cart"
              >
                <ShoppingCart className="h-7 w-7 transition-transform group-hover:scale-110" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-[#1F8A3B] text-[#FFFFFF] border-2 border-white shadow-lg">
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

