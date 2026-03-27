"use client"
// Homepage component — uses same session/auth as account page; forces retention on mount

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { ProductCard } from "@/components/ecommerce/product-card"
import { CategoryCard } from "@/components/ecommerce/category-card"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, MapPin, Loader2 } from "lucide-react"
import { EcommerceProduct, Category, ecommerceProducts, ecommerceCategories } from "@/lib/ecommerce-data"
import { toast } from "sonner"

const CATEGORY_IMAGES: Record<string, string> = {
  "Infused Jaba": "/custom-drink.jpg",
  Liquor: "/heineken-beer-bottle.jpg",
  Spirits: "/johnnie-walker-black-label-whiskey-bottle.jpg",
  Wines: "/chivas-regal-12-year-scotch-whiskey.jpg",
  "Soft Drinks": "/corona-extra-beer-bottle.jpg",
}

export default function HomePage() {
  const { cart, session, addItem, refresh } = useShopCart()
  const openLoginModal = useShopLoginModal()
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const applyFallbackData = useCallback(() => {
    setProducts(ecommerceProducts)
    setCategories(ecommerceCategories.filter((c) => c.productCount > 0))
  }, [])
  // Refresh session when tab becomes visible (don't refresh on mount — it races with add-to-cart)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])

  const doAddToCart = useCallback(async (product: EcommerceProduct) => {
    const defaultSize = product.sizes?.length ? product.sizes.find((s) => s.available) || product.sizes[0] : null
    const size = defaultSize?.size
    const price = defaultSize?.price ?? product.price
    const ok = await addItem({
      id: String(product.id ?? ""),
      name: String(product.name ?? ""),
      price: Number(price) || 0,
      image: String(product.image ?? "/placeholder.svg"),
      quantity: 1,
      size: size || undefined,
    })
    if (ok) {
      toast.success(`${product.name}${size ? ` (${size})` : ""} added to cart`, { duration: 4000 })
    } else {
      toast.error(`Could not add ${product.name}. Try again.`)
    }
    return ok
  }, [addItem])

  const handleAddToCart = useCallback(
    async (product: EcommerceProduct) => {
      if (!session.signedIn) {
        openLoginModal(async () => {
          await refresh()
          // Yield so React can commit session + cart state before addItem runs
          await new Promise((r) => setTimeout(r, 80))
          await doAddToCart(product)
        })
        return
      }
      await doAddToCart(product)
    },
    [session.signedIn, doAddToCart, refresh, openLoginModal]
  )

  // Fetch real products from MongoDB
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/catha/inventory")
        if (!response.ok) {
          applyFallbackData()
          return
        }
        const data = await response.json()
        if (!data.success || !data.products) {
          applyFallbackData()
          return
        }

        const categoryMap: Record<string, "Infused Jaba" | "Liquor" | "Spirits" | "Wines" | "Soft Drinks"> = {
          whiskey: "Spirits",
          vodka: "Spirits",
          rum: "Spirits",
          gin: "Spirits",
          beer: "Liquor",
          wine: "Wines",
          cocktails: "Liquor",
          "soft-drinks": "Soft Drinks",
          jaba: "Infused Jaba",
          other: "Liquor",
        }

        const productMap = new Map<
          string,
          { id: string; name: string; category: string; sizes: { size: string; price: number; available: boolean }[]; image: string; description: string; inStock: boolean; isJaba: boolean }
        >()
        data.products.forEach((p: any) => {
            const productName = p.name.trim()
            const category = categoryMap[p.category] || "Liquor"
            const size = p.size || "Standard"
            const price = p.price || 0
            const available = p.stock > 0
            const isJaba = p.isJaba === true
            if (productMap.has(productName)) {
              const existing = productMap.get(productName)!
              existing.isJaba = existing.isJaba || isJaba
              existing.inStock = existing.inStock || available
              const sizeExists = existing.sizes.some((s) => s.size === size)
              if (!sizeExists) {
                existing.sizes.push({ size, price, available })
                existing.sizes.sort((a, b) => a.price - b.price)
              } else {
                const existingSize = existing.sizes.find((s) => s.size === size)
                if (existingSize) existingSize.available = existingSize.available || available
              }
            } else {
              productMap.set(productName, {
                id: p.id || p._id,
                name: productName,
                category,
                sizes: [{ size, price, available }],
                image: p.image || "/placeholder.svg?height=400&width=300",
                description: p.notes || `${productName} - Premium quality product`,
                inStock: available,
                isJaba,
              })
            }
          })

        const mappedProducts: EcommerceProduct[] = Array.from(productMap.values()).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category as EcommerceProduct["category"],
          price: Math.min(...p.sizes.map((s) => s.price)),
          image: p.image,
          description: p.description,
          sizes: p.sizes,
          rating: 4.5,
          reviewCount: 0,
          reviews: [],
          inStock: p.inStock,
          featured: p.isJaba,
          trending: false,
          isJaba: p.isJaba,
        }))
        setProducts(mappedProducts)

        const categoryCounts: Record<string, number> = {}
        const categoryImageMap: Record<string, string> = {}
        mappedProducts.forEach((p) => {
          categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1
          if (!categoryImageMap[p.category]) categoryImageMap[p.category] = p.image
        })
        const categoryIdMap: Record<string, string> = {
          "Infused Jaba": "infused-jaba",
          Liquor: "liquor",
          Spirits: "spirits",
          Wines: "wines",
          "Soft Drinks": "soft-drinks",
        }
        setCategories(
          Object.entries(categoryCounts)
            .filter(([, count]) => count > 0)
            .map(([name, productCount]) => ({
              id: categoryIdMap[name] || name.toLowerCase().replace(" ", "-"),
              name,
              image: categoryImageMap[name] || CATEGORY_IMAGES[name] || "/placeholder.svg",
              productCount,
            }))
        )
      } catch (err) {
        console.error("Error fetching products:", err)
        applyFallbackData()
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [applyFallbackData])

  const featuredProducts = products.slice(0, 6)
  const trendingProducts = products.slice(0, 8)

  useEffect(() => {
    document.title = "Home | Catha Lounge"
  }, [])

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <EcommerceHeader cartCount={cart.reduce((s, i) => s + i.quantity, 0)} />

      <main>
        {/* Hero Section */}
        <section className="homepage-hero relative overflow-hidden bg-gradient-to-br from-[#0B2E26] via-[#0F3D32] to-[#0B1F1A] py-20 sm:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(22,101,78,0.18),transparent_65%)]" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="mx-auto max-w-4xl text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white shadow-sm mb-6 hover-lift backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                Catha Lounge
              </div>

              {/* Main Heading */}
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl font-heading">
                Discover Premium Spirits
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                  Delivered to Your Door
                </span>
              </h1>

              {/* Subheading */}
              <p className="mb-8 text-lg text-white/75 sm:text-xl max-w-2xl mx-auto">
                Curated selection of the finest liquors and handcrafted Catha Lounge products. Quality you can
                taste, delivered with care.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/shop">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl px-8 h-12 text-base font-semibold bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                    Shop Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/shop?category=infused-jaba">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto rounded-xl px-8 h-12 text-base font-semibold border-2 border-[#BE123C] text-[#BE123C] hover:bg-[#BE123C]/10"
                  >
                    Explore Jaba
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/40 to-transparent" />
        </section>

        {/* Categories */}
        <section className="py-12 sm:py-24 bg-slate-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 sm:mb-12 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1F2937] mb-2 sm:mb-3 font-heading">Shop by Category</h2>
              <p className="text-sm sm:text-base text-[#6B7280]">Browse our curated collections</p>
            </div>
            
            {/* Mobile: Horizontal Scrolling */}
            <div className="block sm:hidden relative">
              <div className="overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 snap-x snap-mandatory scroll-smooth">
                <div className="flex gap-4 w-max">
                  {loading ? (
                    <div className="flex gap-4 w-full justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                    </div>
                  ) : (
                  categories.map((category) => (
                    <div key={category.id} className="snap-start flex-shrink-0 w-[85vw] max-w-[320px]">
                      <CategoryCard category={category} />
                    </div>
                  ))
                  )}
                </div>
              </div>
              {/* Scroll indicator hint */}
              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none flex items-center justify-end pr-2">
                <div className="flex flex-col gap-1 opacity-60">
                  <div className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse"></div>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse delay-75"></div>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse delay-150"></div>
                </div>
              </div>
            </div>

            {/* Desktop/Tablet: Grid Layout */}
            <div className="hidden sm:grid grid-cols-2 gap-6 lg:grid-cols-4">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                </div>
              ) : (
                categories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="bg-[#F3F4F6] py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#1F2937] sm:text-4xl mb-3 font-heading">Featured Products</h2>
                <p className="text-[#6B7280]">Handpicked favorites from our collection</p>
              </div>
              <Link href="/shop?featured=true">
                <Button variant="outline" className="hidden sm:flex rounded-xl border-[#10B981] text-[#10B981] hover:bg-green-50">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 xl:gap-4">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                </div>
              ) : (
                featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} compact />
                ))
              )}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link href="/shop?featured=true">
                <Button variant="outline" className="rounded-full">
                  View All Featured <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Trending Products */}
        <section className="py-16 sm:py-24 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#1F2937] sm:text-4xl mb-3 font-heading">Trending Now</h2>
                <p className="text-[#6B7280]">What's hot right now</p>
              </div>
              <Link href="/shop?sort=trending">
                <Button variant="outline" className="hidden sm:flex rounded-xl border-[#10B981] text-[#10B981] hover:bg-green-50">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 xl:gap-4">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                </div>
              ) : (
                trendingProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} compact />
                ))
              )}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link href="/shop?sort=trending">
                <Button variant="outline" className="rounded-full">
                  View All Trending <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-[#1F2937]">Catha Lounge</h3>
              <p className="text-sm text-[#6B7280]">
                Premium liquor and Catha Lounge products delivered to your door.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-[#1F2937]">Shop</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li>
                  <Link href="/shop" className="hover:text-[#10B981] transition-colors">
                    All Products
                  </Link>
                </li>
                <li>
                  <Link href="/shop?category=infused-jaba" className="hover:text-[#8B1A26] transition-colors">
                    Jaba Section
                  </Link>
                </li>
                <li>
                  <Link href="/shop?category=spirits" className="hover:text-[#8B1A26] transition-colors">
                    Spirits
                  </Link>
                </li>
                <li>
                  <Link href="/shop?category=liquor" className="hover:text-[#8B1A26] transition-colors">
                    Liquor
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-[#1F2937]">Account</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li>
                  <Link href="/account" className="hover:text-[#8B1A26] transition-colors">
                    My Account
                  </Link>
                </li>
                <li>
                  <Link href="/track" className="hover:text-[#8B1A26] transition-colors">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link href="/supplier" className="hover:text-[#8B1A26] transition-colors">
                    Become a Supplier
                  </Link>
                </li>
                <li>
                  <Link href="/jaba-distributor" className="hover:text-[#10B981] transition-colors font-semibold">
                    Become a Catha Lounge Distributor
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-[#1F2937]">Contact</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li>Email: jaba.infusion@gmail.com</li>
                <li>Phone: +254 757477664</li>
                <li className="pt-1">
                  <span className="block font-medium text-[#1F2937] mb-0.5">Catha Lounge</span>
                  <a
                    href="https://www.google.com/maps/dir//-1.2906645,36.7672055"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#10B981] font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 rounded"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Get directions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-[#E5E7EB] pt-8 text-center text-sm text-[#6B7280]">
            <p>&copy; {new Date().getFullYear()} Catha Lounge. All rights reserved.</p>
        </div>
      </div>
    </footer>
    </div>
  )
}
