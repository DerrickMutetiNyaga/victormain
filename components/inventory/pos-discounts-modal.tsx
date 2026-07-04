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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Calendar,
  Sparkles,
  CheckCircle2,
  Info,
  Package,
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

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
      {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</p>}
    </div>
  )
}

function DiscountFieldsForm({
  fields,
  onChange,
  originalPrice,
  compact,
}: {
  fields: DiscountFields
  onChange: (patch: Partial<DiscountFields>) => void
  originalPrice?: number
  compact?: boolean
}) {
  const preview =
    originalPrice != null
      ? validateDiscountInput(fields.discountType, parseFloat(fields.discountValue), originalPrice)
      : null

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      <div>
        <SectionLabel hint="Choose how the discount is calculated">Discount type</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ discountType: "percentage" })}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all",
              fields.discountType === "percentage"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background hover:border-primary/30"
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                fields.discountType === "percentage" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Percent className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Percentage</span>
            </div>
            <span className="text-[11px] text-muted-foreground pl-10">e.g. 10% off catalog price</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ discountType: "fixed" })}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all",
              fields.discountType === "fixed"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background hover:border-primary/30"
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                fields.discountType === "fixed" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Tag className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Fixed amount</span>
            </div>
            <span className="text-[11px] text-muted-foreground pl-10">e.g. KSh 200 off catalog price</span>
          </button>
        </div>
      </div>

      <div>
        <SectionLabel hint={fields.discountType === "percentage" ? "Percent taken off the catalog price" : "KSh amount taken off the catalog price"}>
          {fields.discountType === "percentage" ? "Percent off" : "Amount off (KSh)"}
        </SectionLabel>
        <div className="relative">
          {fields.discountType === "percentage" ? (
            <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">KSh</span>
          )}
          <Input
            type="number"
            min={0}
            value={fields.discountValue}
            onChange={(e) => onChange({ discountValue: e.target.value })}
            className={cn("h-11 text-base font-semibold", fields.discountType === "percentage" ? "pl-9" : "pl-12")}
          />
        </div>
      </div>

      <div>
        <SectionLabel hint="Shown on POS — optional label for staff">Promotion name</SectionLabel>
        <Input
          placeholder="e.g. Happy Hour, Weekend Special"
          value={fields.promotionName}
          onChange={(e) => onChange({ promotionName: e.target.value })}
          className="h-10"
        />
      </div>

      <div>
        <SectionLabel hint="Leave blank to start immediately and run until you turn it off">Schedule (optional)</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="h-3 w-3" /> Starts
            </Label>
            <Input
              type="datetime-local"
              value={fields.startAt}
              onChange={(e) => onChange({ startAt: e.target.value })}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="h-3 w-3" /> Ends
            </Label>
            <Input
              type="datetime-local"
              value={fields.endAt}
              onChange={(e) => onChange({ endAt: e.target.value })}
              className="h-10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Discount status</p>
          <p className="text-xs text-muted-foreground">
            {fields.status === "active" ? "Live on POS when schedule allows" : "Saved but not applied on POS"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", fields.status === "active" ? "text-emerald-700" : "text-muted-foreground")}>
            {fields.status === "active" ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={fields.status === "active"}
            onCheckedChange={(c) => onChange({ status: c ? "active" : "inactive" })}
          />
        </div>
      </div>

      {originalPrice != null && preview && (
        <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 mb-2">Price preview</p>
          {preview.ok ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground line-through">{formatKsh(originalPrice)}</span>
              <span className="text-xl font-bold text-emerald-700">{formatKsh(preview.discountedPrice)}</span>
              <Badge className="bg-emerald-600 text-white text-[10px]">
                {fields.discountType === "percentage"
                  ? `${fields.discountValue}% off`
                  : `${formatKsh(parseFloat(fields.discountValue) || 0)} off`}
              </Badge>
            </div>
          ) : (
            <span className="text-sm text-destructive">{preview.error}</span>
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

  const [activeDiscounts, setActiveDiscounts] = useState<ActiveDiscount[]>([])
  const [isLoadingActive, setIsLoadingActive] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")

  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscount[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; label: string }[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [categoryFields, setCategoryFields] = useState<DiscountFields>(defaultFields())

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

  const selectAllVisible = () => {
    setSelectedIds(new Set(searchResults.map((p) => p.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

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

  const hasSearchCriteria =
    debouncedSearch.trim() ||
    filterCategory !== "all" ||
    filterBrand !== "all" ||
    filterDiscount !== "all"

  const previewPrice =
    selectedIds.size === 1
      ? searchResults.find((p) => selectedIds.has(p.id))?.price
      : undefined

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
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-gradient-to-br from-white via-white to-amber-50/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pr-8">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-600" />
                POS Product Discounts
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm">
                Set temporary POS prices without changing your catalog. Find products, configure the discount, then apply.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Badge variant="outline" className="text-[11px] font-normal gap-1 bg-white">
                <Info className="h-3 w-3" /> POS only
              </Badge>
              <Badge variant="outline" className="text-[11px] font-normal gap-1 bg-white">
                <Package className="h-3 w-3" /> Product beats category
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="px-6 pt-3 border-b border-border/40 bg-muted/20">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/60">
              <TabsTrigger value="search" className="flex flex-col sm:flex-row items-center gap-1 py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Search className="h-4 w-4 shrink-0" />
                <span>Apply</span>
              </TabsTrigger>
              <TabsTrigger value="active" className="flex flex-col sm:flex-row items-center gap-1 py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <List className="h-4 w-4 shrink-0" />
                <span>Active</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex flex-col sm:flex-row items-center gap-1 py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Layers className="h-4 w-4 shrink-0" />
                <span>Categories</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center gap-1 py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <History className="h-4 w-4 shrink-0" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>
            <p className="text-[11px] text-muted-foreground py-2">
              {tab === "search" && "Step 1: Find products · Step 2: Set discount on the right · Step 3: Apply"}
              {tab === "active" && "All product-level discounts currently saved"}
              {tab === "categories" && "Discount an entire category — individual product discounts override these"}
              {tab === "history" && "Who changed what and when"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="search" className="mt-0 p-4 sm:p-6">
              <div className="grid lg:grid-cols-5 gap-5 lg:gap-6">
                {/* Left: Find products */}
                <div className="lg:col-span-3 space-y-4">
                  <Card className="border-border/70 shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                        <div>
                          <CardTitle className="text-base">Find products</CardTitle>
                          <CardDescription className="text-xs">Filter or search, then select one or more items</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, SKU, or barcode…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-11"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground mb-1 block">Category</Label>
                          <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All categories</SelectItem>
                              {categories.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground mb-1 block">Brand / supplier</Label>
                          <Select value={filterBrand} onValueChange={setFilterBrand}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All brands</SelectItem>
                              {brands.map((b) => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground mb-1 block">Discount status</Label>
                          <Select value={filterDiscount} onValueChange={setFilterDiscount}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All products</SelectItem>
                              <SelectItem value="has_discount">Already discounted</SelectItem>
                              <SelectItem value="no_discount">No discount yet</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <p className="text-xs text-muted-foreground">
                            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                            {selectedIds.size > 0 && (
                              <span className="font-semibold text-foreground"> · {selectedIds.size} selected</span>
                            )}
                          </p>
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllVisible}>
                              Select all
                            </Button>
                            {selectedIds.size > 0 && (
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border bg-muted/10 min-h-[220px] max-h-[340px] overflow-y-auto">
                        {isSearching && (
                          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            Searching products…
                          </div>
                        )}
                        {!isSearching && !hasSearchCriteria && (
                          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
                            <Search className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium text-foreground">Start with a search or filter</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                              Type a product name, pick a category, or filter by discount status to see results here.
                            </p>
                          </div>
                        )}
                        {!isSearching && hasSearchCriteria && searchResults.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
                            <Package className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium">No products match</p>
                            <p className="text-xs text-muted-foreground">Try different filters or search terms.</p>
                          </div>
                        )}
                        {searchResults.map((p) => {
                          const selected = selectedIds.has(p.id)
                          return (
                            <div
                              key={p.id}
                              className={cn(
                                "flex items-center gap-3 p-3 border-b last:border-b-0 transition-colors cursor-pointer",
                                selected ? "bg-amber-50/80 border-l-2 border-l-amber-500" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                              )}
                              onClick={() => toggleSelect(p.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelect(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border/50">
                                <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.category}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold tabular-nums">{formatKsh(p.price)}</p>
                                {p.hasProductDiscount && (
                                  <Badge variant="secondary" className="text-[10px] mt-0.5">Discounted</Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 hidden sm:flex"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  saveSingleProduct(p)
                                }}
                              >
                                Apply
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Discount config */}
                <div className="lg:col-span-2">
                  <Card className="border-primary/20 shadow-sm lg:sticky lg:top-0 bg-gradient-to-b from-white to-amber-50/20">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                        <div>
                          <CardTitle className="text-base">Discount details</CardTitle>
                          <CardDescription className="text-xs">These settings apply when you hit Apply</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-4">
                      <DiscountFieldsForm
                        fields={bulkFields}
                        onChange={(p) => setBulkFields((f) => ({ ...f, ...p }))}
                        originalPrice={previewPrice}
                        compact
                      />

                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
                          <p className="text-sm font-semibold">Apply discount</p>
                        </div>
                        {selectedIds.size > 0 ? (
                          <Button
                            onClick={saveBulk}
                            disabled={isBulkSaving}
                            className="w-full h-11 gap-2 text-base font-semibold"
                            size="lg"
                          >
                            {isBulkSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Apply to {selectedIds.size} selected product{selectedIds.size !== 1 ? "s" : ""}
                          </Button>
                        ) : (
                          <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center">
                            <Sparkles className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">
                              Select products on the left, or use <strong className="text-foreground">Apply</strong> on a single row.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="active" className="mt-0 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Active product discounts</h3>
                  <p className="text-xs text-muted-foreground">Catalog price vs what customers pay on POS</p>
                </div>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-full sm:w-48 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show all</SelectItem>
                    <SelectItem value="active">Live now</SelectItem>
                    <SelectItem value="inactive">Turned off</SelectItem>
                    <SelectItem value="scheduled">Scheduled (not started)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoadingActive ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin inline" />
                </div>
              ) : filteredActive.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <Tag className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-medium">No discounts found</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the Apply tab to create your first discount.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredActive.map((d) => (
                    <Card key={d.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{d.product?.name ?? d.productId}</p>
                              <Badge variant={d.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                                {d.effectivelyActive ? "Live on POS" : d.status === "inactive" ? "Off" : "Scheduled"}
                              </Badge>
                            </div>
                            {d.promotionName && (
                              <p className="text-xs text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> {d.promotionName}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {d.discountType === "percentage" ? `${d.discountValue}% off` : `${formatKsh(d.discountValue)} off`}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                            <div className="text-center">
                              <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Catalog</p>
                              <p className="text-sm tabular-nums text-muted-foreground line-through">
                                {d.catalogPrice != null ? formatKsh(d.catalogPrice) : "—"}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] uppercase text-emerald-700 mb-0.5 font-medium">POS price</p>
                              <p className="text-lg font-bold tabular-nums text-emerald-700">
                                {d.discountedPrice != null ? formatKsh(d.discountedPrice) : "—"}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {d.status === "active" && (
                                <Button size="sm" variant="outline" onClick={() => disableDiscount(d)}>
                                  Turn off
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteDiscount(d)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="mt-0 p-4 sm:p-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4" /> New category discount
                    </CardTitle>
                    <CardDescription>
                      Applies to every product in the category. A product-specific discount always wins.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Category</Label>
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DiscountFieldsForm
                      fields={categoryFields}
                      onChange={(p) => setCategoryFields((f) => ({ ...f, ...p }))}
                      compact
                    />
                    <Button onClick={saveCategoryDiscount} className="w-full gap-2 h-11" disabled={!newCategory}>
                      <Save className="h-4 w-4" /> Save category discount
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Saved category discounts</CardTitle>
                    <CardDescription>{categoryDiscounts.length} rule{categoryDiscounts.length !== 1 ? "s" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {categoryDiscounts.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground text-center">No category discounts yet.</p>
                    ) : (
                      <div className="divide-y max-h-[420px] overflow-y-auto">
                        {categoryDiscounts.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20">
                            <div>
                              <p className="font-semibold">{c.label}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {c.discountType === "percentage" ? `${c.discountValue}% off` : `${formatKsh(c.discountValue)} off`}
                              </p>
                              {c.promotionName && (
                                <p className="text-xs text-amber-700 mt-0.5">{c.promotionName}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={c.effectivelyActive ? "default" : "secondary"}>
                                {c.effectivelyActive ? "Live" : "Off"}
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
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 p-4 sm:p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" /> Change log
                  </CardTitle>
                  <CardDescription>Recent discount creates, updates, and removals</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[480px] overflow-y-auto divide-y">
                    {auditLog.length === 0 ? (
                      <p className="p-8 text-center text-sm text-muted-foreground">No history yet.</p>
                    ) : (
                      auditLog.map((entry) => (
                        <div key={entry.id} className="px-4 py-3 hover:bg-muted/20">
                          <p className="text-sm">{formatAuditMessage(entry)}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
