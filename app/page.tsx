"use client"
// Homepage component — uses same session/auth as account page; forces retention on mount

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { ProductCard } from "@/components/ecommerce/product-card"
import { SiteLogo } from "@/components/branding/site-logo"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, MapPin, Loader2, ShieldCheck, Truck, Gem, ChevronDown } from "lucide-react"
import { EcommerceProduct, Category, ecommerceProducts, ecommerceCategories } from "@/lib/ecommerce-data"
import { toast } from "sonner"

const CATEGORY_IMAGES: Record<string, string> = {
  "Infused Jaba": "/custom-drink.jpg",
  Liquor: "/johnnie-walker-black-label-whiskey-bottle.jpg",
  Spirits: "/johnnie-walker-black-label-whiskey-bottle.jpg",
  Wines: "/chivas-regal-12-year-scotch-whiskey.jpg",
  "Soft Drinks": "/corona-extra-beer-bottle.jpg",
}

const QUICK_SHOP = [
  { id: "wines", name: "Wines", image: "/chivas-regal-12-year-scotch-whiskey.jpg" },
  { id: "spirits", name: "Spirits", image: "/johnnie-walker-black-label-whiskey-bottle.jpg" },
  { id: "infused-jaba", name: "Jaba", image: "/custom-drink.jpg" },
  { id: "liquor", name: "Champagne", image: "/heineken-beer-bottle.jpg" },
  { id: "featured", name: "Offers", image: "/corona-extra-beer-bottle.jpg", query: "featured=true" },
] as const

export default function HomePage() {
  const { cart, session, addItem, refresh } = useShopCart()
  const openLoginModal = useShopLoginModal()
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const trendingCarouselRef = useRef<HTMLDivElement | null>(null)
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
        openLoginModal()
        return
      }
      await doAddToCart(product)
    },
    [session.signedIn, doAddToCart, openLoginModal]
  )

  // Fetch real products from MongoDB
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/catha/inventory?visibleOnly=true")
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
          { id: string; name: string; category: string; sizes: { size: string; price: number; available: boolean }[]; image: string; description: string; inStock: boolean; isJaba: boolean; isFeatured: boolean }
        >()
        data.products.forEach((p: any) => {
            if (!p || !p.name) return
            const productName = String(p.name).trim()
            if (!productName) return
            const category = categoryMap[p.category] || "Liquor"
            const size = p.size || "Standard"
            const price = p.price || 0
            const available = p.stock > 0
            const isJaba = p.isJaba === true
            const isFeatured = p.isFeatured === true
            if (productMap.has(productName)) {
              const existing = productMap.get(productName)!
              existing.isJaba = existing.isJaba || isJaba
              existing.isFeatured = existing.isFeatured || isFeatured
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
                isFeatured,
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
          featured: p.isFeatured,
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

  const featuredProducts = products.filter((p) => p.featured).slice(0, 8)
  const trendingProducts = products.slice(0, 10)
  const jabaProducts = products.filter((p) => p.isJaba).slice(0, 4)

  useEffect(() => {
    const container = trendingCarouselRef.current
    if (!container || trendingProducts.length <= 1) return

    const interval = setInterval(() => {
      const firstCard = container.firstElementChild as HTMLElement | null
      if (!firstCard) return

      const step = firstCard.getBoundingClientRect().width + 12 // gap-3
      const maxScrollLeft = container.scrollWidth - container.clientWidth
      const next = container.scrollLeft + step

      if (next >= maxScrollLeft - 4) {
        container.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        container.scrollTo({ left: next, behavior: "smooth" })
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [trendingProducts.length])

  useEffect(() => {
    document.title = "Home | Infusion Jaba"
  }, [])

  return (
    <div className="min-h-screen bg-[var(--brand-cream)]">
      <EcommerceHeader cartCount={cart.reduce((s, i) => s + i.quantity, 0)} />

      <main>
        {/* Hero Section */}
        <section className="homepage-hero relative overflow-hidden bg-[radial-gradient(circle_at_14%_20%,rgba(47,143,79,0.2)_0%,transparent_45%),radial-gradient(circle_at_82%_2%,rgba(217,121,47,0.16)_0%,transparent_40%),linear-gradient(140deg,#120f0f_0%,#211714_44%,#1a1210_100%)] pt-8 pb-12 sm:py-24">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,232,198,0.06),transparent_35%,rgba(0,0,0,0.35))]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#f2dfb8_0.6px,transparent_0.6px)] [background-size:6px_6px]" />
          <div className="pointer-events-none absolute -left-16 top-14 h-44 w-44 rounded-full bg-[var(--brand-green)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-10 h-52 w-52 rounded-full bg-[var(--brand-orange)]/20 blur-3xl" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex justify-center">
                <SiteLogo
                  priority
                  className="h-14 w-[200px] sm:h-16 sm:w-[230px]"
                  imageClassName="drop-shadow-[0_7px_16px_rgba(0,0,0,0.35)]"
                />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f4e5c5]/10 border border-[var(--brand-green)]/35 px-4 py-2 text-sm font-medium text-[#f4e5c5] shadow-sm mb-6 hover-lift backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                Catha Lounge
              </div>

              {/* Main Heading */}
              <h1 className="mb-5 text-3xl font-bold tracking-tight text-white sm:text-5xl font-heading">
                Curated Wines & Rare Spirits
                <br />
                <span className="bg-gradient-to-r from-[#f6e7c8] via-[var(--brand-orange-soft)] to-[var(--brand-green)] bg-clip-text text-transparent">
                  Delivered With Lounge Elegance
                </span>
              </h1>

              {/* Subheading */}
              <p className="mb-7 text-sm text-[#d6c7b0] sm:text-lg max-w-2xl mx-auto">
                Discover top-shelf bottles, boutique labels, and house infusions in a premium delivery experience.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/shop">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl px-7 h-11 text-sm font-semibold bg-[#f3e4c1] text-[#221716] shadow-lg hover:bg-[color-mix(in_srgb,#f3e4c1_82%,var(--brand-green)_18%)] hover:text-[var(--brand-green-strong)] transition-all hover:scale-[1.02] focus-visible:ring-[var(--brand-green)]/40">
                    Shop Spirits
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/shop?category=infused-jaba">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto rounded-xl px-7 h-11 text-sm font-semibold border border-[var(--brand-border-beige)] bg-[var(--brand-espresso)]/82 text-[#f7e6c6] hover:bg-[color-mix(in_srgb,var(--brand-espresso)_80%,var(--brand-green)_20%)] hover:border-[var(--brand-green)]/45"
                  >
                    Explore The Lounge
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#1a1311] to-transparent" />
        </section>

        {/* Quick Shop Categories */}
        <section className="py-12 sm:py-20 bg-[var(--brand-cream)]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 sm:mb-12 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#2a1f1b] mb-2 sm:mb-3 font-heading">Quick Shop</h2>
              <p className="text-sm sm:text-base text-[#6f6257]">Fast categories for one-handed browsing</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {QUICK_SHOP.map((item) => (
                  <Link
                    key={item.id}
                    href={item.query ? `/shop?${item.query}` : `/shop?category=${item.id}`}
                    className="group relative h-24 overflow-hidden rounded-2xl border border-[#3a2f2a] shadow-[0_8px_20px_rgba(0,0,0,0.2)] sm:h-28"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140f0d]/90 via-[#140f0d]/45 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-sm font-semibold text-[#f3e5c8]">{item.name}</p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="bg-[#ece5dc] py-16 sm:py-20 border-y border-[var(--brand-border-beige)]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#2a1f1b] sm:text-4xl mb-3 font-heading">Featured Products</h2>
                <p className="text-[#6f6257]">Editorial picks from our bottle room</p>
              </div>
              <Link href="/shop?featured=true">
                <Button variant="outline" className="hidden sm:flex rounded-xl border-[var(--brand-border-beige)] text-[#5e4724] hover:border-[var(--brand-green)]/45 hover:text-[var(--brand-green-strong)] hover:bg-[var(--brand-green)]/10">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#7e6741]" />
                </div>
              ) : (
                featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Trending Products */}
        <section className="py-14 sm:py-18 bg-[#f4efe8]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#2a1f1b] sm:text-4xl mb-3 font-heading">Trending Now</h2>
                <p className="text-[#6f6257]">Fast-moving bottles this week</p>
              </div>
              <Link href="/shop?sort=trending">
                <Button variant="outline" className="hidden sm:flex rounded-xl border-[var(--brand-border-beige)] text-[#5e4724] hover:border-[var(--brand-green)]/45 hover:text-[var(--brand-green-strong)] hover:bg-[var(--brand-green)]/10">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#f4efe8] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#f4efe8] to-transparent" />
              <div
                ref={trendingCarouselRef}
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory pr-2 scrollbar-hide"
              >
              {loading ? (
                <div className="w-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#7e6741]" />
                </div>
              ) : (
                trendingProducts.map((product) => (
                  <div key={product.id} className="min-w-[46vw] sm:min-w-[250px] lg:min-w-[280px] snap-start first:ml-0">
                    <ProductCard product={product} onAddToCart={handleAddToCart} compact />
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        </section>

        {jabaProducts.length > 0 && (
          <section className="py-16 sm:py-20 bg-[radial-gradient(circle_at_16%_12%,rgba(47,143,79,0.14)_0%,transparent_42%),radial-gradient(circle_at_82%_6%,rgba(217,121,47,0.12)_0%,transparent_36%),linear-gradient(to_bottom,#1a1312,#1d1514,#120e0d)] border-y border-[#2d2422]">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-10 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-[#f2e4c5] sm:text-4xl mb-2 font-heading">Jaba Collection</h2>
                  <p className="text-[#cdbda2]">Signature house infusions and exclusive lounge blends</p>
                </div>
                <Link href="/shop?category=infused-jaba">
                  <Button variant="outline" className="hidden sm:flex rounded-xl border-[var(--brand-green)]/40 text-[#f2e4c5] hover:bg-[var(--brand-green)]/15">
                    Browse Collection <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {jabaProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} compact />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="bg-[#ece3d8] border-y border-[var(--brand-border-beige)] py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, title: "Fast Delivery", text: "Reliable doorstep service across your city." },
                { icon: Gem, title: "Premium Selection", text: "Curated labels, rare spirits, and top shelf picks." },
                { icon: ShieldCheck, title: "Trusted Quality", text: "Only verified inventory from trusted partners." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-[#d1c0ab] bg-[#f8f2e8] px-4 py-3">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-espresso)] text-[#f1e0bf]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#2a1f1b]">{title}</h3>
                  <p className="mt-1 text-xs text-[#6f6257]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#332824] bg-[#15110f] pt-10 pb-20 sm:pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile footer */}
          <div className="sm:hidden">
            <div className="pb-5">
              <SiteLogo
                className="h-12 w-[160px]"
                imageClassName="drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
              />
              <p className="mt-2 text-sm leading-relaxed text-[#c9baa0]">
                Premium wines and spirits, thoughtfully curated for elevated evenings.
              </p>
            </div>
            <div className="h-px w-full bg-[#312724]" />

            <div className="divide-y divide-[#312724]">
              <details className="group py-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-[#e5d5b8]">
                  Shop
                  <ChevronDown className="h-4 w-4 text-[var(--brand-green)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="pb-3 text-sm text-[#ccbda3] space-y-2">
                  <Link href="/shop" className="block hover:text-[var(--brand-green)] transition-colors">All Products</Link>
                  <Link href="/shop?category=wines" className="block hover:text-[var(--brand-green)] transition-colors">Wines</Link>
                  <Link href="/shop?category=spirits" className="block hover:text-[var(--brand-green)] transition-colors">Spirits</Link>
                  <Link href="/shop?category=liquor" className="block hover:text-[var(--brand-green)] transition-colors">Liquor</Link>
                </div>
              </details>

              <details className="group py-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-[#e5d5b8]">
                  Business
                  <ChevronDown className="h-4 w-4 text-[var(--brand-green)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="pb-3 text-sm text-[#ccbda3] space-y-2">
                  <Link href="/supplier" className="block hover:text-[var(--brand-green)] transition-colors">Become a Supplier</Link>
                  <Link href="/jaba-distributor" className="block hover:text-[var(--brand-green)] transition-colors">Distributor Program</Link>
                </div>
              </details>

              <details className="group py-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-[#e5d5b8]">
                  Contact
                  <ChevronDown className="h-4 w-4 text-[var(--brand-green)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="pb-3 text-sm text-[#ccbda3] space-y-2">
                  <p>jaba.infusion@gmail.com</p>
                  <p>+254 757 477 664</p>
                </div>
              </details>

              <details className="group py-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-[#e5d5b8]">
                  Visit
                  <ChevronDown className="h-4 w-4 text-[var(--brand-green)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="pb-3 text-sm text-[#ccbda3]">
                  <p className="mb-2">Catha Lounge, Nairobi</p>
                  <a
                    href="https://www.google.com/maps/dir//-1.2906645,36.7672055"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#4a3d39] bg-[#1e1715] px-2.5 py-1.5 text-[#f2e3c5] hover:bg-[color-mix(in_srgb,#1e1715_80%,var(--brand-green)_20%)] transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Get directions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </details>
            </div>
          </div>

          {/* Desktop footer */}
          <div className="hidden rounded-2xl border border-[#3a302d] bg-[#171110]/85 p-5 sm:block sm:p-7 shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
            <div className="mb-6 border-b border-[#302724] pb-5">
              <SiteLogo
                className="h-14 w-[196px]"
                imageClassName="drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
              />
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#c9baa0]">
                Curated wines and premium spirits, delivered with care for memorable evenings and elevated hosting.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
              <div>
                <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-green)]">Shop</h4>
                <ul className="space-y-2 text-[#d8ccb7]">
                  <li><Link href="/shop" className="hover:text-[var(--brand-green)] transition-colors">All Products</Link></li>
                  <li><Link href="/shop?category=wines" className="hover:text-[var(--brand-green)] transition-colors">Wines</Link></li>
                  <li><Link href="/shop?category=spirits" className="hover:text-[var(--brand-green)] transition-colors">Spirits</Link></li>
                  <li><Link href="/shop?category=liquor" className="hover:text-[var(--brand-green)] transition-colors">Liquor</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-green)]">Business</h4>
                <ul className="space-y-2 text-[#d8ccb7]">
                  <li><Link href="/supplier" className="hover:text-[var(--brand-green)] transition-colors">Become a Supplier</Link></li>
                  <li><Link href="/jaba-distributor" className="hover:text-[var(--brand-green)] transition-colors">Distributor Program</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-green)]">Contact</h4>
                <ul className="space-y-2 text-[#d8ccb7]">
                  <li>jaba.infusion@gmail.com</li>
                  <li>+254 757 477 664</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-green)]">Visit</h4>
                <p className="text-[#d8ccb7]">Catha Lounge, Nairobi</p>
                <a
                  href="https://www.google.com/maps/dir//-1.2906645,36.7672055"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#4a3d39] bg-[#1e1715] px-2.5 py-1.5 text-[#f2e3c5] hover:bg-[color-mix(in_srgb,#1e1715_80%,var(--brand-green)_20%)] transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Get directions
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-xs text-[#9f9180]">
            &copy; {new Date().getFullYear()} Catha Lounge. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
