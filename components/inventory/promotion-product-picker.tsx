"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { Loader2, Plus, Search, X } from "lucide-react"

export interface PickedProduct {
  id: string
  name: string
  price: number
  category?: string
  size?: string
  image?: string
}

interface SearchProductRow {
  id: string
  name: string
  category: string
  price: number
  image: string
  size?: string
}

function formatKsh(amount: number) {
  return `KSh ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export async function resolvePickedProducts(ids: string[]): Promise<PickedProduct[]> {
  if (ids.length === 0) return []
  const unique = [...new Set(ids)]
  const rows = await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await fetch(
          `/api/catha/pos-discounts/search?q=${encodeURIComponent(id)}&limit=5`,
          { cache: "no-store" }
        )
        const data = await res.json()
        const match =
          (data.products as SearchProductRow[] | undefined)?.find((p) => p.id === id) ??
          (data.products as SearchProductRow[] | undefined)?.[0]
        if (match) {
          return {
            id: match.id,
            name: match.name,
            price: match.price,
            category: match.category,
            size: match.size,
            image: match.image,
          }
        }
      } catch {
        /* fall through */
      }
      return { id, name: `Product ${id.slice(-6)}`, price: 0 }
    })
  )
  return rows
}

export function PromotionProductPicker({
  value,
  onChange,
  minProducts = 2,
  label = "Products in bundle",
  hint = "Search and add products — one unit of each is required per bundle set.",
}: {
  value: PickedProduct[]
  onChange: (products: PickedProduct[]) => void
  minProducts?: number
  label?: string
  hint?: string
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 250)
  const [filterCategory, setFilterCategory] = useState("all")
  const [categories, setCategories] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<SearchProductRow[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const selectedIds = useMemo(() => new Set(value.map((p) => p.id)), [value])

  const hasSearchCriteria =
    debouncedSearch.trim().length > 0 || filterCategory !== "all"

  useEffect(() => {
    if (!hasSearchCriteria) {
      setSearchResults([])
      return
    }

    const params = new URLSearchParams()
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
    if (filterCategory !== "all") params.set("category", filterCategory)
    params.set("limit", "25")

    let cancelled = false
    setIsSearching(true)
    fetch(`/api/catha/pos-discounts/search?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSearchResults(data.products || [])
        if (Array.isArray(data.categories)) setCategories(data.categories)
      })
      .catch(() => {
        if (!cancelled) setSearchResults([])
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, filterCategory, hasSearchCriteria])

  const addProduct = (product: SearchProductRow) => {
    if (selectedIds.has(product.id)) return
    onChange([
      ...value,
      {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        size: product.size,
        image: product.image,
      },
    ])
  }

  const removeProduct = (id: string) => {
    onChange(value.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="gap-1.5 py-1.5 pl-2 pr-1 max-w-full text-xs font-normal"
            >
              <span className="truncate max-w-[14rem]">
                {p.name}
                {p.size ? ` · ${p.size}` : ""}
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0">{formatKsh(p.price)}</span>
              <button
                type="button"
                onClick={() => removeProduct(p.id)}
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {value.length} selected
        {minProducts > 0 && value.length < minProducts
          ? ` · need at least ${minProducts}`
          : ""}
      </p>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search name, barcode, or category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-background"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-background overflow-hidden max-h-56 overflow-y-auto">
          {isSearching && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching…
            </p>
          )}
          {!isSearching && !hasSearchCriteria && (
            <p className="py-8 text-center text-sm text-muted-foreground px-3">
              Type to search or pick a category.
            </p>
          )}
          {!isSearching && hasSearchCriteria && searchResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
          )}
          {searchResults.map((p) => {
            const alreadyAdded = selectedIds.has(p.id)
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 border-b last:border-b-0 px-3 py-2.5",
                  alreadyAdded ? "bg-muted/40 opacity-70" : "hover:bg-muted/30"
                )}
              >
                <div className="relative h-9 w-9 rounded overflow-hidden bg-muted shrink-0">
                  <Image src={p.image || "/placeholder.svg"} alt="" fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.category}
                    {p.size ? ` · ${p.size}` : ""}
                  </p>
                  <p className="text-xs font-semibold tabular-nums mt-0.5">{formatKsh(p.price)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={alreadyAdded ? "secondary" : "outline"}
                  disabled={alreadyAdded}
                  className="shrink-0 h-8 gap-1"
                  onClick={() => addProduct(p)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {alreadyAdded ? "Added" : "Add"}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
