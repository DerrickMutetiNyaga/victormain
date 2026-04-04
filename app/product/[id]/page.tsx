"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Star,
  ShoppingCart,
  Minus,
  Plus,
  ArrowLeft,
  Check,
  Loader2,
  Copy,
  Wine,
  UtensilsCrossed,
  Package,
  AlertCircle,
  Sparkles,
  Zap,
  AlertTriangle,
} from "lucide-react"
import { EcommerceProduct, getProductDisplayName } from "@/lib/ecommerce-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ProductCard } from "@/components/ecommerce/product-card"
import { motion } from "framer-motion"

const CATEGORY_MAP: Record<string, "Infused Jaba" | "Liquor" | "Spirits" | "Wines" | "Soft Drinks"> = {
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

const RECENTLY_VIEWED_KEY = "catha_recently_viewed"
const MAX_RECENT = 4

function getCategorySlug(cat: string): string {
  const slug = Object.entries(CATEGORY_MAP).find(([, v]) => v === cat)?.[0] || "liquor"
  return slug
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { cart, session, addItem, refresh } = useShopCart()
  const openLoginModal = useShopLoginModal()
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const [product, setProduct] = useState<EcommerceProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [relatedProducts, setRelatedProducts] = useState<EcommerceProduct[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<{ id: string; name: string }[]>([])
  const [imageHover, setImageHover] = useState(false)
  const [addToCartJustAdded, setAddToCartJustAdded] = useState(false)
  const reviewsSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addToCartJustAdded) return
    const t = setTimeout(() => setAddToCartJustAdded(false), 2000)
    return () => clearTimeout(t)
  }, [addToCartJustAdded])

  const productDisplayName = product
    ? selectedSize && selectedSize !== "Standard"
      ? `${product.name} ${selectedSize}`
      : getProductDisplayName(product)
    : ""

  useEffect(() => {
    document.title = product ? `${productDisplayName} | Catha Lounge` : "Product | Catha Lounge"
  }, [product, productDisplayName])

  // Recently viewed: add current product and read list
  useEffect(() => {
    if (!product?.id || !product.name) return
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY)
      const list: { id: string; name: string }[] = raw ? JSON.parse(raw) : []
      const without = list.filter((x) => x.id !== product.id)
      const next = [{ id: product.id, name: product.name }, ...without].slice(0, MAX_RECENT)
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next))
      setRecentlyViewed(next.filter((x) => x.id !== product.id))
    } catch {
      setRecentlyViewed([])
    }
  }, [product?.id, product?.name])

  // Fetch product
  useEffect(() => {
    let cancelled = false
    
    const fetchProduct = async (retryCount = 0): Promise<void> => {
      let isRetrying = false
      try {
        setLoading(true)
        const response = await fetch(`/api/catha/inventory/${params.id}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        })

        if (cancelled) return

        if (!response.ok) {
          if (response.status === 404) {
            setProduct(null)
            setLoading(false)
            return
          }
          // Retry once on 500 (transient server/MongoDB issues)
          if (response.status === 500 && retryCount < 1) {
            console.warn("[ProductPage] Server error, retrying in 1s...")
            isRetrying = true
            await new Promise((r) => setTimeout(r, 1000))
            if (cancelled) return
            return fetchProduct(retryCount + 1)
          }
          const errBody = await response.text()
          console.error("[ProductPage] Failed to fetch product:", response.status, response.statusText, errBody?.substring(0, 200))
          setProduct(null)
          setLoading(false)
          return
        }

        const text = await response.text()
        if (cancelled) return
        if (!text) {
          console.error("[ProductPage] Empty response from product API")
          setProduct(null)
          setLoading(false)
          return
        }
        
        let data
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error("[ProductPage] Failed to parse product JSON:", parseError, "Response:", text.substring(0, 200))
          setProduct(null)
          setLoading(false)
          return
        }

        if (data.success && data.products && data.products.length > 0) {
          const productsWithSameName = data.products
          const firstProduct = productsWithSameName[0]
          const category = CATEGORY_MAP[firstProduct.category] || "Liquor"
          const productName = firstProduct.name.trim()

          const sizes = productsWithSameName.map((p: any) => ({
            size: p.size || "Standard",
            price: p.price || 0,
            available: (p.stock ?? 0) > 0,
            stock: p.stock ?? 0,
          }))

          const uniqueSizes = Array.from(new Map(sizes.map((s: any) => [s.size, s])).values()).sort(
            (a: any, b: any) => a.price - b.price
          )

          const lowestPrice =
            uniqueSizes.length > 0 ? Math.min(...uniqueSizes.map((s: any) => s.price)) : firstProduct.price || 0

          const mappedProduct: EcommerceProduct = {
            id: params.id as string,
            name: productName,
            category,
            price: lowestPrice,
            image: firstProduct.image || "/placeholder.svg?height=400&width=300",
            description: firstProduct.notes || firstProduct.description || `${productName} — Premium quality.`,
            sizes: uniqueSizes,
            rating: 4.5,
            reviewCount: 0,
            reviews: [],
            inStock: uniqueSizes.some((s: any) => s.available),
            featured: false,
            trending: false,
          }

          setProduct(mappedProduct)
          const firstAvailable = uniqueSizes.find((s: any) => s.available)
          if (firstAvailable) {
            setSelectedSize(firstAvailable.size)
          } else if (uniqueSizes.length > 0) {
            setSelectedSize(uniqueSizes[0].size)
          }
        } else {
          setProduct(null)
        }
      } catch (error) {
        if (cancelled) return
        // Retry once on network/abort errors
        if (retryCount < 1) {
          console.warn("[ProductPage] Fetch error, retrying in 1s...", error)
          isRetrying = true
          await new Promise((r) => setTimeout(r, 1000))
          if (cancelled) return
          return fetchProduct(retryCount + 1)
        }
        console.error("[ProductPage] Error fetching product:", error)
      } finally {
        if (!cancelled && !isRetrying) setLoading(false)
      }
    }

    if (params.id) fetchProduct()
    return () => { cancelled = true }
  }, [params.id])

  // Related products (same category)
  useEffect(() => {
    if (!product?.category) return
    const fetchRelated = async () => {
      try {
        const res = await fetch("/api/catha/inventory", { cache: "force-cache", next: { revalidate: 60 } })
        if (!res.ok) return
        const data = await res.json()
        if (!data.success || !data.products) return

        const targetCategory = getCategorySlug(product.category)
        const byName = new Map<
          string,
          { id: string; name: string; category: string; price: number; image: string; sizes: any[]; stock: number }
        >()
        data.products
          .filter((p: any) => p.category === targetCategory && p.name?.trim() !== product.name)
          .forEach((p: any) => {
            const name = p.name?.trim()
            if (!name) return
            const existing = byName.get(name)
            const stock = p.stock ?? 0
            const size = p.size || "Standard"
            const price = p.price ?? 0
            if (!existing) {
              byName.set(name, {
                id: p._id || p.id,
                name,
                category: product.category,
                price,
                image: p.image || "/placeholder.svg",
                sizes: [{ size, price, available: stock > 0, stock }],
                stock,
              })
            } else {
              const sz = existing.sizes.find((s: any) => s.size === size)
              if (!sz) existing.sizes.push({ size, price, available: stock > 0, stock })
              existing.sizes.sort((a: any, b: any) => a.price - b.price)
            }
          })

        const list: EcommerceProduct[] = Array.from(byName.values())
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category as EcommerceProduct["category"],
            price: p.sizes[0]?.price ?? p.price,
            image: p.image,
            description: "",
            sizes: p.sizes,
            rating: 4.5,
            reviewCount: 0,
            reviews: [],
            inStock: p.sizes.some((s: any) => s.available),
            featured: false,
            trending: false,
          }))
        setRelatedProducts(list)
      } catch {
        setRelatedProducts([])
      }
    }
    fetchRelated()
  }, [product?.category, product?.name])

  const selectedSizeData = product
    ? product.sizes.find((s) => s.size === selectedSize) || product.sizes[0]
    : null
  const displayPrice = selectedSizeData?.price ?? product?.price ?? 0
  const stockCount = selectedSizeData?.stock ?? 0
  const discount =
    product?.originalPrice && product?.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0

  const doAddToCart = useCallback(async (): Promise<boolean> => {
    if (!product || !selectedSizeData?.available) return false
    const size = selectedSize
    const price = selectedSizeData?.price || product.price
    const ok = await addItem({ id: product.id, name: product.name, price, image: product.image, quantity, size })
    if (ok) {
      toast.success(`${quantity} ${product.name}${size ? ` (${size})` : ""} added to cart`, { duration: 4000 })
      setAddToCartJustAdded(true)
    } else {
      toast.error(`Could not add ${product.name}. Try again.`)
    }
    return ok
    // Revalidate: refetch product so stock display can update
    fetch(`/api/catha/inventory/${params.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.products?.length > 0) {
          const productsWithSameName = data.products
          const firstProduct = productsWithSameName[0]
          const category = CATEGORY_MAP[firstProduct.category] || "Liquor"
          const productName = firstProduct.name.trim()
          const sizes = productsWithSameName.map((p: any) => ({
            size: p.size || "Standard",
            price: p.price || 0,
            available: (p.stock ?? 0) > 0,
            stock: p.stock ?? 0,
          }))
          const uniqueSizes = Array.from(new Map(sizes.map((s: any) => [s.size, s])).values()).sort(
            (a: any, b: any) => a.price - b.price
          )
          const lowestPrice =
            uniqueSizes.length > 0 ? Math.min(...uniqueSizes.map((s: any) => s.price)) : firstProduct.price || 0
          setProduct((prev) =>
            prev
              ? {
                  ...prev,
                  price: lowestPrice,
                  sizes: uniqueSizes,
                  inStock: uniqueSizes.some((s: any) => s.available),
                }
              : null
          )
        }
      })
      .catch(() => {})
  }, [product, selectedSize, selectedSizeData, quantity, addItem, params.id])

  const handleAddToCart = useCallback(async () => {
    if (!selectedSizeData?.available) {
      toast.error("This size is currently unavailable")
      return
    }
    if (!product) return
    if (!session.signedIn) {
      openLoginModal(async () => {
        await refresh()
        await doAddToCart()
      })
      return
    }
    await doAddToCart()
  }, [session.signedIn, product, selectedSizeData, doAddToCart, refresh, openLoginModal])

  const handleBuyNow = useCallback(async () => {
    if (!selectedSizeData?.available || !product) return
    if (!session.signedIn) {
      openLoginModal(async () => {
        await refresh()
        const ok = await doAddToCart()
        if (ok) router.push("/cart")
      })
      return
    }
    const ok = await doAddToCart()
    if (ok) router.push("/cart")
  }, [session.signedIn, product, selectedSizeData, doAddToCart, router, refresh, openLoginModal])

  const handleRelatedAddToCart = useCallback(
    async (p: EcommerceProduct) => {
      if (!p.inStock) return
      const firstSize = p.sizes.find((s) => s.available) || p.sizes[0]
      if (!firstSize) return
      if (!session.signedIn) {
        openLoginModal(async () => {
          await refresh()
          const ok = await addItem({
            id: p.id,
            name: p.name,
            price: firstSize.price,
            image: p.image,
            quantity: 1,
            size: firstSize.size,
          })
          if (ok) {
            toast.success(`${p.name}${firstSize.size !== "Standard" ? ` (${firstSize.size})` : ""} added to cart`, { duration: 4000 })
          } else {
            toast.error(`Could not add ${p.name}. Try again.`)
          }
        })
        return
      }
      const ok = await addItem({
        id: p.id,
        name: p.name,
        price: firstSize.price,
        image: p.image,
        quantity: 1,
        size: firstSize.size,
      })
      if (ok) {
        toast.success(`${p.name}${firstSize.size !== "Standard" ? ` (${firstSize.size})` : ""} added to cart`, { duration: 4000 })
      } else {
        toast.error(`Could not add ${p.name}. Try again.`)
      }
    },
    [session.signedIn, addItem, refresh, openLoginModal]
  )

  const handleShare = useCallback(
    (channel: "copy" | "whatsapp" | "facebook") => {
      const url = typeof window !== "undefined" ? window.location.href : ""
      const text = product ? `${productDisplayName} — Catha Lounge` : ""

      if (channel === "copy") {
        navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
        return
      }
      if (channel === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank")
        return
      }
      if (channel === "facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank")
      }
    },
    [product, productDisplayName]
  )

  // Stock badge: green / amber (urgent) / red
  const stockBadge = useMemo(() => {
    if (!product) return null
    if (stockCount === 0)
      return {
        label: "Out of Stock",
        className: "bg-red-500/15 text-red-700 border-red-200",
        urgent: true,
      }
    if (stockCount < 5)
      return {
        label: `Only ${stockCount} left in stock`,
        className: "bg-orange-500/15 text-orange-800 border-orange-300/60 animate-pulse-subtle",
        urgent: true,
      }
    return { label: "In Stock", className: "bg-[#10B981]/15 text-[#0E9F6E] border-[#10B981]/30", urgent: false }
  }, [product, stockCount])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <EcommerceHeader cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} />
        <div className="container mx-auto px-4 py-32 flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-[#10B981] border-t-transparent animate-spin mb-6" />
          <p className="text-lg font-semibold text-[#1a1a1a]">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <EcommerceHeader cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} />
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">Product not found</h1>
          <Link href="/shop">
            <Button className="rounded-full px-6 h-12 bg-[#10B981] hover:bg-[#0d9668] shadow-lg">
              Back to Shop
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const breadcrumbCategory = getCategorySlug(product.category)

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-44 sm:pb-12">
      <EcommerceHeader cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-6xl">
        {/* Breadcrumb + Back */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-4 sm:mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 font-medium text-[#475569] hover:text-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-[#cbd5e1]">/</span>
          <Link href="/shop" className="hover:text-[#1a1a1a] transition-colors">
            Shop
          </Link>
          <span className="text-[#cbd5e1]">/</span>
          <Link
            href={`/shop?category=${breadcrumbCategory}`}
            className="hover:text-[#1a1a1a] transition-colors capitalize"
          >
            {product.category}
          </Link>
          <span className="text-[#cbd5e1]">/</span>
          <span className="text-[#1a1a1a] font-medium truncate max-w-[140px] sm:max-w-xs">
            {product.name}
          </span>
        </nav>

        {/* Two-column layout: 60% image, 40% content */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
        >
          {/* Left: Image */}
          <div className="relative aspect-square w-full max-w-xl mx-auto lg:max-w-none overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
            <div
              className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-xl"
              aria-hidden
            />
            {discount > 0 && (
              <span className="absolute top-4 left-4 z-20 inline-flex items-center rounded-full bg-[#dc2626] px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                -{discount}% OFF
              </span>
            )}
            {(product.featured || product.trending) && (
              <span className="absolute top-4 right-4 z-20 inline-flex items-center gap-1 rounded-full bg-[#10B981] px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                {product.trending ? <Zap className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {product.trending ? "Popular" : "Best Seller"}
              </span>
            )}
            <div
              className={cn(
                "absolute inset-0 transition-transform duration-500 ease-out rounded-xl",
                imageHover && "scale-105"
              )}
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
            >
              <Image
                src={product.image}
                alt={productDisplayName}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
            </div>
          </div>

          {/* Right: Content - premium mobile-first structure */}
          <div className="flex flex-col lg:pl-2">
            {/* 1. Category - tiny uppercase, muted green */}
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#10B981]/80 mb-1.5">
              {product.category}
            </span>

            {/* 2. Title - 22–24px mobile, strong weight */}
            <h1 className="text-[22px] sm:text-2xl lg:text-4xl font-bold text-[#1a1a1a] tracking-[-0.02em] leading-tight mb-2 sm:mb-3">
              {productDisplayName}
            </h1>

            {/* Optional badges below title */}
            <div className="flex flex-wrap gap-2 mb-3">
              {product.trending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1a1a1a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Zap className="h-3 w-3" />
                  Popular this week
                </span>
              )}
              {product.featured && !product.trending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 text-[#0E9F6E] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border border-[#10B981]/30">
                  <Sparkles className="h-3 w-3" />
                  Catha Recommended
                </span>
              )}
            </div>

            {/* 3. Rating - gold stars, muted count, tap to scroll to reviews */}
            {product.rating != null && (
              <button
                type="button"
                onClick={() => reviewsSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-2 mb-5 text-left w-fit"
              >
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4 sm:h-4 sm:w-4",
                        i <= Math.floor(product.rating!)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-[#e2e8f0] text-[#e2e8f0]"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-[#1a1a1a]">{product.rating}</span>
                {product.reviewCount ? (
                  <span className="text-xs text-[#94a3b8]">({product.reviewCount} reviews)</span>
                ) : null}
              </button>
            )}

            {/* 4. Price - strong hierarchy, divider below */}
            <div className="mb-4 pb-4 border-b border-[#e2e8f0]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs sm:text-sm font-medium text-[#64748b] uppercase tracking-wide">KES</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#1a1a1a] tracking-tight tabular-nums">
                  {displayPrice.toLocaleString()}
                </span>
              </div>
              {product.originalPrice != null && product.originalPrice > displayPrice && (
                <span className="text-base text-[#94a3b8] line-through mt-1 inline-block">
                  KES {product.originalPrice.toLocaleString()}
                </span>
              )}
              <p className="text-xs text-[#10B981] font-medium mt-2">Pay with M-Pesa available</p>
            </div>

            <p className="text-[#475569] leading-relaxed mb-5 line-clamp-3 text-sm sm:text-base">{product.description}</p>

            {/* 5. Low stock badge - urgent, warning icon, rounded-full */}
            {stockBadge && (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold w-fit mb-5",
                  stockBadge.className
                )}
              >
                {stockBadge.urgent && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {!stockBadge.urgent && <span className="h-2 w-2 rounded-full bg-current opacity-90 shrink-0" />}
                {stockBadge.label}
              </div>
            )}

            {/* 6. Size selector - clear selected state, 12–14px gap */}
            {product.sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-bold text-[#1a1a1a] mb-2">Size</p>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size.size}
                      onClick={() => setSelectedSize(size.size)}
                      disabled={!size.available}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 min-h-[44px]",
                        selectedSize === size.size
                          ? "bg-[#10B981] text-white shadow-md shadow-[#10B981]/25"
                          : "bg-[#f1f5f9] text-[#475569] border-2 border-[#e2e8f0] hover:border-[#10B981]/40",
                        !size.available && "opacity-50 cursor-not-allowed line-through"
                      )}
                    >
                      {size.size}
                      {selectedSize === size.size && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#64748b] mt-2 font-medium">Selected: {selectedSize}</p>
              </div>
            )}

            {/* 7. Info block - SKU, Category, Availability grouped */}
            <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 mb-5 space-y-1.5">
              <p className="text-xs text-[#64748b]">
                <span className="font-semibold text-[#475569]">SKU:</span> {product.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-[#64748b]">
                <span className="font-semibold text-[#475569]">Category:</span> {product.category}
              </p>
              <p className="text-xs text-[#64748b]">
                <span className="font-semibold text-[#475569]">Availability:</span>{" "}
                {stockCount === 0 ? "Out of stock" : stockCount < 5 ? `Only ${stockCount} left` : "In stock"}
              </p>
            </div>

            {/* Purchase row - hidden on mobile (use sticky bar instead) */}
            <div className="hidden sm:flex flex-col sm:flex-row gap-3 mt-auto">
              <div className="flex items-center rounded-lg border border-[#e2e8f0] bg-white overflow-hidden flex-shrink-0 w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-10 w-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold tabular-nums">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-10 w-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  aria-label="Increase quantity"
                  disabled={selectedSizeData != null && quantity >= (selectedSizeData.stock ?? Infinity)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-1 sm:flex-initial sm:items-center">
                <Button
                  onClick={handleAddToCart}
                  disabled={!selectedSizeData?.available || stockCount === 0}
                  size="lg"
                  className="flex-1 sm:min-w-[180px] h-10 rounded-lg bg-[#10B981] hover:bg-[#0d9668] text-white font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {stockCount === 0 ? "Out of Stock" : "Add to Cart"}
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={!selectedSizeData?.available || stockCount === 0}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-initial h-10 rounded-lg border border-[#10B981] text-[#10B981] font-medium hover:bg-[#10B981]/5 text-sm"
                >
                  Buy Now
                </Button>
              </div>
            </div>

            {/* 8. Share - divider above, label, circular icons, brand hover */}
            <div className="mt-6 pt-5 border-t border-[#e2e8f0]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-3">Share this product</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleShare("copy")}
                  className="h-11 w-11 rounded-full bg-white border-2 border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:border-[#10B981] hover:text-[#10B981] hover:bg-[#10B981]/5 shadow-sm active:scale-95 transition-all"
                  title="Copy link"
                >
                  <Copy className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleShare("whatsapp")}
                  className="h-11 w-11 rounded-full bg-white border-2 border-[#e2e8f0] flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366] shadow-sm active:scale-95 transition-all"
                  title="Share on WhatsApp"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleShare("facebook")}
                  className="h-11 w-11 rounded-full bg-white border-2 border-[#e2e8f0] flex items-center justify-center text-[#1877f2] hover:bg-[#1877f2]/10 hover:border-[#1877f2] shadow-sm active:scale-95 transition-all"
                  title="Share on Facebook"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs (desktop) / Accordion (mobile) - ref for scroll-to-reviews */}
        <section ref={reviewsSectionRef} className="mt-12 sm:mt-16 scroll-mt-4">
          <h2 className="sr-only">Product details</h2>
          <div className="hidden sm:block">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full justify-start rounded-xl bg-[#f1f5f9] p-1 gap-1">
                <TabsTrigger value="description" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 font-semibold">
                  Description
                </TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 font-semibold">
                  Reviews
                </TabsTrigger>
              </TabsList>
              <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
                <TabsContent value="description" className="mt-0">
                  <div className="space-y-6 text-[#475569]">
                    <div>
                      <h3 className="flex items-center gap-2 text-[#1a1a1a] font-bold mb-2">
                        <Wine className="h-5 w-5 text-[#10B981]" />
                        About This Drink
                      </h3>
                      <p className="leading-relaxed">{product.description}</p>
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-[#1a1a1a] font-bold mb-2">
                        <UtensilsCrossed className="h-5 w-5 text-[#10B981]" />
                        Best Served With
                      </h3>
                      <p>Chilled, over ice, or as the base for premium cocktails. Perfect for sipping neat or in mixed drinks.</p>
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-[#1a1a1a] font-bold mb-2">
                        <UtensilsCrossed className="h-5 w-5 text-[#10B981]" />
                        Food Pairing
                      </h3>
                      <p>Pairs wonderfully with grilled meats, cheese boards, and light appetisers.</p>
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-[#1a1a1a] font-bold mb-2">
                        <Package className="h-5 w-5 text-[#10B981]" />
                        Storage
                      </h3>
                      <p>Store in a cool, dry place away from direct sunlight. Keep upright after opening.</p>
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-[#1a1a1a] font-bold mb-2">
                        <AlertCircle className="h-5 w-5 text-[#10B981]" />
                        Allergy Information
                      </h3>
                      <p>Contains alcohol. Enjoy responsibly. Check label for specific allergens.</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="reviews" className="mt-0">
                  {product.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {product.reviews.map((review) => (
                        <div key={review.id} className="border-b border-[#e2e8f0] pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#1a1a1a]">{review.userName}</span>
                            {review.verified && (
                              <Badge variant="secondary" className="text-xs bg-[#10B981]/10 text-[#10B981]">
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={cn("h-4 w-4", i <= review.rating ? "fill-amber-400 text-amber-400" : "fill-[#e2e8f0]")}
                              />
                            ))}
                          </div>
                          <p className="text-[#64748b]">{review.comment}</p>
                          <p className="text-xs text-[#94a3b8] mt-1">{review.date}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#64748b]">No reviews yet. Be the first to review this product.</p>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <Accordion type="single" collapsible className="sm:hidden mt-5 w-full border-0">
            <AccordionItem value="description" className="border-0 border-b border-[#e2e8f0] bg-transparent">
              <AccordionTrigger className="text-left font-bold text-[#1a1a1a] text-base py-5 min-h-[50px] hover:no-underline hover:bg-[#f8fafc]/80 data-[state=open]:bg-[#f1f5f9]/80 rounded-none px-0 transition-colors [&>svg]:transition-transform [&>svg]:duration-200">
                Description
              </AccordionTrigger>
              <AccordionContent className="text-[#475569] pb-5 pt-0 px-0 text-sm leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-[#1a1a1a] mb-1">About This Drink</h3>
                    <p>{product.description}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1a1a1a] mb-1">Best Served With</h3>
                    <p>Chilled, over ice, or as the base for premium cocktails.</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1a1a1a] mb-1">Storage</h3>
                    <p>Store in a cool, dry place away from direct sunlight.</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reviews" className="border-0 border-b border-[#e2e8f0] bg-transparent">
              <AccordionTrigger className="text-left font-bold text-[#1a1a1a] text-base py-5 min-h-[50px] hover:no-underline hover:bg-[#f8fafc]/80 data-[state=open]:bg-[#f1f5f9]/80 rounded-none px-0 transition-colors [&>svg]:transition-transform [&>svg]:duration-200">
                Reviews
              </AccordionTrigger>
              <AccordionContent className="pb-5 pt-0 px-0 text-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                {product.reviews.length > 0 ? (
                  product.reviews.map((review) => (
                    <div key={review.id} className="mb-4 pb-4 border-b border-[#e2e8f0] last:border-0">
                      <p className="font-semibold text-[#1a1a1a]">{review.userName}</p>
                      <p className="text-[#64748b] mt-1">{review.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[#64748b]">No reviews yet.</p>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping" className="border-0 border-b border-[#e2e8f0] bg-transparent">
              <AccordionTrigger className="text-left font-bold text-[#1a1a1a] text-base py-5 min-h-[50px] hover:no-underline hover:bg-[#f8fafc]/80 data-[state=open]:bg-[#f1f5f9]/80 rounded-none px-0 transition-colors [&>svg]:transition-transform [&>svg]:duration-200">
                Shipping & Returns
              </AccordionTrigger>
              <AccordionContent className="text-[#475569] pb-5 pt-0 px-0 text-sm leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <p>We deliver within our service area. Contact us for delivery options. Unopened bottles may be returned within 7 days in original packaging.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="storage" className="border-0 border-b border-[#e2e8f0] bg-transparent">
              <AccordionTrigger className="text-left font-bold text-[#1a1a1a] text-base py-5 min-h-[50px] hover:no-underline hover:bg-[#f8fafc]/80 data-[state=open]:bg-[#f1f5f9]/80 rounded-none px-0 transition-colors [&>svg]:transition-transform [&>svg]:duration-200">
                Storage & Serving Tips
              </AccordionTrigger>
              <AccordionContent className="text-[#475569] pb-5 pt-0 px-0 text-sm leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <p>Store in a cool, dry place away from direct sunlight. Keep upright after opening. Best served chilled or over ice. Enjoy responsibly.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Related Products - horizontal scrollable slider */}
        {relatedProducts.length > 0 && (
          <section className="mt-14 sm:mt-18">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a] mb-4 sm:mb-6 px-0">Related Products</h2>
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
              <div
                className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory pb-2 -mb-2 scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {relatedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex-shrink-0 w-[48vw] min-w-[48vw] sm:w-[200px] sm:min-w-[200px] md:w-[220px] md:min-w-[220px] lg:w-[240px] lg:min-w-[240px] snap-start"
                  >
                    <ProductCard product={p} compact onAddToCart={handleRelatedAddToCart} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mt-10 sm:mt-14">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a] mb-4">Recently Viewed</h2>
            <div className="flex flex-wrap gap-2">
              {recentlyViewed.map((item) => (
                <Link
                  key={item.id}
                  href={`/product/${item.id}`}
                  className="inline-flex items-center rounded-full border-2 border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:border-[#10B981] hover:text-[#10B981] transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile sticky purchase bar - premium, conversion-focused */}
      <div
        className="fixed bottom-0 left-0 right-0 sm:hidden z-40 bg-white border-t border-[#e2e8f0] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="px-4 pt-3 pb-3 flex flex-col gap-3 max-w-lg mx-auto">
          {/* Row 1: Quantity | Add to Cart with price */}
          <div className="flex items-stretch gap-3">
            {/* Quantity selector - 52px height, tap-friendly */}
            <div className="flex items-center rounded-xl bg-[#f1f5f9] border-2 border-[#e2e8f0] overflow-hidden flex-shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-[52px] min-w-[52px] flex items-center justify-center text-[#475569] active:bg-[#e2e8f0] transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="w-11 text-center text-base font-bold tabular-nums text-[#1a1a1a]">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="h-[52px] min-w-[52px] flex items-center justify-center text-[#475569] active:bg-[#e2e8f0] disabled:opacity-50 transition-colors"
                aria-label="Increase quantity"
                disabled={selectedSizeData != null && quantity >= (selectedSizeData.stock ?? Infinity)}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            {/* Add to Cart - primary CTA, 52–56px, strong green */}
            <button
              onClick={handleAddToCart}
              disabled={!selectedSizeData?.available || stockCount === 0}
              className={cn(
                "flex-1 min-h-[52px] h-[52px] rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                addToCartJustAdded ? "bg-[#0d9668]" : "bg-[#10B981] hover:bg-[#0d9668]"
              )}
            >
              {addToCartJustAdded ? (
                <>
                  <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  <span className="tracking-wide">Added</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5 shrink-0" />
                  <span className="tracking-wide">
                    Add to Cart
                    <span className="font-semibold opacity-90 ml-1">· KES {(displayPrice * quantity).toLocaleString()}</span>
                  </span>
                </>
              )}
            </button>
          </div>
          {/* Row 2: Buy Now - full width, dark premium */}
          <button
            onClick={handleBuyNow}
            disabled={!selectedSizeData?.available || stockCount === 0}
            className="w-full min-h-[52px] h-[52px] rounded-xl bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white font-bold text-base tracking-wide shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  )
}
