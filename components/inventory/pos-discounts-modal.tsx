"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Percent,
  Tag,
  Search,
  Loader2,
  Trash2,
  Save,
  Flame,
  History,
  Layers,
  List,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { validateDiscountInput } from "@/lib/pos-product-discounts"

type DiscountType = "percentage" | "fixed"
type DiscountStatus = "active" | "inactive"

interface SearchProduct {
  id: string
  name: string
  category: string
  price: number
  image: string
  barcode: string
  sku: string
  supplier: string
  hasProductDiscount?: boolean
}

interface ActiveDiscount {
  id: string
  productId: string
  discountType: DiscountType
  discountValue: number
  status: DiscountStatus
  startAt: string | null
  endAt: string | null
  promotionName: string | null
  effectivelyActive: boolean
  catalogPrice?: number
  discountedPrice?: number
  discountPercent?: number
  product?: {
    id: string
    name: string
    category: string
    price: number
    image: string
  } | null
}

interface CategoryDiscount {
  id: string
  category: string
  label: string
  discountType: DiscountType
  discountValue: number
  status: DiscountStatus
  startAt: string | null
  endAt: string | null
  promotionName: string | null
  effectivelyActive: boolean
}

interface AuditEntry {
  id: string
  action: string
  targetName: string
  actorName: string | null
  actorEmail: string | null
  details: Record<string, unknown>
  createdAt: string
}

interface DiscountFields {
  discountType: DiscountType
  discountValue: string
  status: DiscountStatus
  startAt: string
  endAt: string
  promotionName: string
}

const defaultFields = (): DiscountFields => ({
  discountType: "percentage",
  discountValue: "10",
  status: "active",
  startAt: "",
  endAt: "",
  promotionName: "",
})

function formatKsh(amount: number) {
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatAuditMessage(entry: AuditEntry): string {
  const who = entry.actorName || entry.actorEmail || "Someone"
  const d = entry.details
  switch (entry.action) {
    case "created":
      return `${who} applied ${d.discountValue}${d.discountType === "percentage" ? "%" : " KSh"} to ${entry.targetName}`
    case "updated":
    case "bulk_applied":
      return `${who} updated discount on ${entry.targetName}`
    case "disabled":
      return `${who} disabled discount on ${entry.targetName}`
    case "enabled":
      return `${who} enabled discount on ${entry.targetName}`
    case "deleted":
      return `${who} removed discount from ${entry.targetName}`
    case "category_applied":
      return `${who} set category discount on ${entry.targetName}`
    default:
      return `${who} — ${entry.action} — ${entry.targetName}`
  }
}

function DiscountFieldsForm({
  fields,
  onChange,
  originalPrice,
}: {
  fields: DiscountFields
  onChange: (patch: Partial<DiscountFields>) => void
  originalPrice?: number
}) {
  const preview =
    originalPrice != null
      ? validateDiscountInput(fields.discountType, parseFloat(fields.discountValue), originalPrice)
      : null

  return (
    <div className="space-y-3">
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={fields.discountType === "percentage"}
            onChange={() => onChange({ discountType: "percentage" })}
          />
          <Percent className="h-3.5 w-3.5" /> Percentage
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={fields.discountType === "fixed"}
            onChange={() => onChange({ discountType: "fixed" })}
          />
          <Tag className="h-3.5 w-3.5" /> Fixed Amount
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Discount Value</Label>
          <Input
            type="number"
            min={0}
            value={fields.discountValue}
            onChange={(e) => onChange({ discountValue: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Promotion Name (optional)</Label>
          <Input
            placeholder="Happy Hour"
            value={fields.promotionName}
            onChange={(e) => onChange({ promotionName: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Start Date & Time</Label>
          <Input
            type="datetime-local"
            value={fields.startAt}
            onChange={(e) => onChange({ startAt: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">End Date & Time</Label>
          <Input
            type="datetime-local"
            value={fields.endAt}
            onChange={(e) => onChange({ endAt: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={fields.status === "active"}
          onCheckedChange={(c) => onChange({ status: c ? "active" : "inactive" })}
        />
        <span className="text-sm">{fields.status === "active" ? "Active" : "Inactive"}</span>
      </div>
      {originalPrice != null && preview && (
        <div className="rounded-lg bg-muted/50 p-2 text-sm">
          {preview.ok ? (
            <>
              <span className="line-through text-muted-foreground mr-2">{formatKsh(originalPrice)}</span>
              <span className="font-bold text-emerald-700">{formatKsh(preview.discountedPrice)}</span>
            </>
          ) : (
            <span className="text-destructive text-xs">{preview.error}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function PosDiscountsModal({
  size = "default",
  className,
}: {
  size?: "default" | "sm"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState("search")

  // Search tab
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 200)
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterBrand, setFilterBrand] = useState("all")
  const [filterDiscount, setFilterDiscount] = useState("all")
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkFields, setBulkFields] = useState<DiscountFields>(defaultFields())
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  // Active tab
  const [activeDiscounts, setActiveDiscounts] = useState<ActiveDiscount[]>([])
  const [isLoadingActive, setIsLoadingActive] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")

  // Category tab
  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscount[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; label: string }[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [categoryFields, setCategoryFields] = useState<DiscountFields>(defaultFields())

  // History
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  const loadActiveDiscounts = useCallback(async () => {
    setIsLoadingActive(true)
    try {
      const res = await fetch("/api/catha/pos-discounts", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setActiveDiscounts(data.discounts || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load discounts")
    } finally {
      setIsLoadingActive(false)
    }
  }, [])

  const loadCategoryDiscounts = useCallback(async () => {
    try {
      const res = await fetch("/api/catha/pos-discounts/categories", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setCategoryDiscounts(data.discounts || [])
      setCategoryOptions(data.categories || [])
    } catch {
      /* ignore */
    }
  }, [])

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/catha/pos-discounts/audit?limit=50", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setAuditLog(data.entries || [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!open) return
    loadActiveDiscounts()
    loadCategoryDiscounts()
    loadAudit()
  }, [open, loadActiveDiscounts, loadCategoryDiscounts, loadAudit])

  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setSelectedIds(new Set())
      return
    }

    const params = new URLSearchParams()
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterBrand !== "all") params.set("brand", filterBrand)
    if (filterDiscount !== "all") params.set("discount", filterDiscount)

    if (
      !debouncedSearch.trim() &&
      filterCategory === "all" &&
      filterBrand === "all" &&
      filterDiscount === "all"
    ) {
      setSearchResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)
    fetch(`/api/catha/pos-discounts/search?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSearchResults(data.products || [])
        setCategories(data.categories || [])
        setBrands(data.brands || [])
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, filterCategory, filterBrand, filterDiscount, open])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveBulk = async () => {
    if (selectedIds.size === 0) return
    setIsBulkSaving(true)
    try {
      const res = await fetch("/api/catha/pos-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          productIds: Array.from(selectedIds),
          discountType: bulkFields.discountType,
          discountValue: parseFloat(bulkFields.discountValue),
          status: bulkFields.status,
          startAt: bulkFields.startAt || null,
          endAt: bulkFields.endAt || null,
          promotionName: bulkFields.promotionName || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(`Applied discount to ${selectedIds.size} products`)
      setSelectedIds(new Set())
      loadActiveDiscounts()
      loadAudit()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk save failed")
    } finally {
      setIsBulkSaving(false)
    }
  }

  const saveSingleProduct = async (product: SearchProduct) => {
    try {
      const res = await fetch("/api/catha/pos-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discounts: [
            {
              productId: product.id,
              discountType: bulkFields.discountType,
              discountValue: parseFloat(bulkFields.discountValue),
              status: bulkFields.status,
              startAt: bulkFields.startAt || null,
              endAt: bulkFields.endAt || null,
              promotionName: bulkFields.promotionName || null,
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(`Discount saved for ${product.name}`)
      loadActiveDiscounts()
      loadAudit()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    }
  }

  const disableDiscount = async (d: ActiveDiscount) => {
    await fetch("/api/catha/pos-discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, status: "inactive" }),
    })
    loadActiveDiscounts()
    loadAudit()
  }

  const deleteDiscount = async (d: ActiveDiscount) => {
    await fetch(`/api/catha/pos-discounts?id=${d.id}`, { method: "DELETE" })
    loadActiveDiscounts()
    loadAudit()
    toast.success("Discount removed")
  }

  const saveCategoryDiscount = async () => {
    if (!newCategory) return
    try {
      const res = await fetch("/api/catha/pos-discounts/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory,
          discountType: categoryFields.discountType,
          discountValue: parseFloat(categoryFields.discountValue),
          status: categoryFields.status,
          startAt: categoryFields.startAt || null,
          endAt: categoryFields.endAt || null,
          promotionName: categoryFields.promotionName || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success("Category discount saved")
      loadCategoryDiscounts()
      loadAudit()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const filteredActive = activeDiscounts.filter((d) => {
    if (activeFilter === "active") return d.effectivelyActive
    if (activeFilter === "inactive") return d.status === "inactive"
    if (activeFilter === "scheduled") return d.status === "active" && !d.effectivelyActive && d.startAt
    return true
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={cn(
            "gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm",
            size === "sm" && "text-xs h-10",
            className
          )}
        >
          <Flame className={cn("text-amber-600", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {size === "sm" ? "Discounts" : "POS Discounts"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60 bg-gradient-to-br from-white via-white to-amber-50/40">
          <DialogTitle className="text-xl font-bold">POS Product Discounts</DialogTitle>
          <DialogDescription>
            POS-only pricing. Product discounts override category discounts. Prices recalculate from live catalog.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-4 w-auto">
            <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5" /> Search
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1.5 text-xs sm:text-sm">
              <List className="h-3.5 w-3.5" /> Active
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5" /> Categories
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="search" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDiscount} onValueChange={setFilterDiscount}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Discount" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    <SelectItem value="has_discount">Discounted only</SelectItem>
                    <SelectItem value="no_discount">No discount</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              {selectedIds.size > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <p className="text-sm font-semibold">{selectedIds.size} products selected — bulk apply</p>
                  <DiscountFieldsForm fields={bulkFields} onChange={(p) => setBulkFields((f) => ({ ...f, ...p }))} />
                  <Button onClick={saveBulk} disabled={isBulkSaving} className="gap-2">
                    {isBulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Apply to {selectedIds.size} products
                  </Button>
                </div>
              )}

              <div className="rounded-xl border divide-y max-h-72 overflow-y-auto">
                {isSearching && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Searching…
                  </div>
                )}
                {!isSearching && searchResults.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Use filters or search to find products
                  </p>
                )}
                {searchResults.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4"
                    />
                    <div className="relative h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
                      <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category} · {formatKsh(p.price)}</p>
                    </div>
                    {p.hasProductDiscount && (
                      <Badge variant="outline" className="text-[10px]">Has discount</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => saveSingleProduct(p)}>
                      Add
                    </Button>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-4 bg-muted/20">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Quick apply settings</p>
                <DiscountFieldsForm fields={bulkFields} onChange={(p) => setBulkFields((f) => ({ ...f, ...p }))} />
              </div>
            </TabsContent>

            <TabsContent value="active" className="mt-0 space-y-3">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All discounts</SelectItem>
                  <SelectItem value="active">Active now</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>

              {isLoadingActive ? (
                <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
              ) : filteredActive.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No discounts found</p>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Product</th>
                        <th className="text-right p-3">Original</th>
                        <th className="text-right p-3">POS Price</th>
                        <th className="text-right p-3">Off</th>
                        <th className="text-center p-3">Status</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredActive.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/20">
                          <td className="p-3">
                            <p className="font-medium">{d.product?.name ?? d.productId}</p>
                            {d.promotionName && (
                              <p className="text-[10px] text-amber-600">{d.promotionName}</p>
                            )}
                          </td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">
                            {d.catalogPrice != null ? formatKsh(d.catalogPrice) : "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums font-bold text-emerald-700">
                            {d.discountedPrice != null ? formatKsh(d.discountedPrice) : "—"}
                          </td>
                          <td className="p-3 text-right">
                            {d.discountType === "percentage"
                              ? `${d.discountValue}%`
                              : formatKsh(d.discountValue)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={d.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                              {d.effectivelyActive ? "Live" : d.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            {d.status === "active" && (
                              <Button size="sm" variant="outline" onClick={() => disableDiscount(d)}>
                                Disable
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDiscount(d)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Category discounts apply to all products in a category. Individual product discounts take priority.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DiscountFieldsForm
                fields={categoryFields}
                onChange={(p) => setCategoryFields((f) => ({ ...f, ...p }))}
              />
              <Button onClick={saveCategoryDiscount} className="gap-2">
                <Save className="h-4 w-4" /> Save category discount
              </Button>

              {categoryDiscounts.length > 0 && (
                <div className="rounded-xl border divide-y mt-4">
                  {categoryDiscounts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-semibold">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `${formatKsh(c.discountValue)} off`}
                          {c.promotionName ? ` · ${c.promotionName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.effectivelyActive ? "default" : "secondary"}>
                          {c.effectivelyActive ? "Live" : c.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={async () => {
                            await fetch(`/api/catha/pos-discounts/categories?id=${c.id}`, { method: "DELETE" })
                            loadCategoryDiscounts()
                            loadAudit()
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="space-y-0 divide-y rounded-xl border max-h-96 overflow-y-auto">
                {auditLog.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No history yet</p>
                ) : (
                  auditLog.map((entry) => (
                    <div key={entry.id} className="p-3 text-sm">
                      <p>{formatAuditMessage(entry)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
