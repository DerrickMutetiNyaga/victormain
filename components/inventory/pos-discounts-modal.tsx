"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { validateDiscountInput } from "@/lib/pos-product-discounts"
import {
  DiscountEligibilityFields,
  defaultEligibilityState,
  eligibilityPayloadFromState,
  type DiscountEligibilityState,
} from "@/components/inventory/discount-eligibility-fields"
import { PromotionCampaignsTab, CampaignSelect, type CampaignRow } from "@/components/inventory/promotion-campaigns-tab"
import { PromotionAnalyticsTab } from "@/components/inventory/promotion-analytics-tab"

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
  eligibilityScope?: string
  eligibleCustomers?: string[]
  campaignId?: string | null
  campaignName?: string | null
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
  eligibilityScope?: string
  eligibleCustomers?: string[]
  campaignId?: string | null
  campaignName?: string | null
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

function auditSummary(entry: AuditEntry) {
  const d = entry.details
  const value =
    d.discountType === "percentage"
      ? `${d.discountValue}%`
      : typeof d.discountValue === "number"
        ? formatKsh(d.discountValue)
        : String(d.discountValue ?? "")
  const actionLabels: Record<string, string> = {
    created: "Applied",
    updated: "Updated",
    bulk_applied: "Bulk applied",
    disabled: "Turned off",
    enabled: "Turned on",
    deleted: "Removed",
    category_applied: "Category set",
    eligibility_changed: "Eligibility changed",
    campaign_created: "Campaign created",
    campaign_updated: "Campaign updated",
    campaign_activated: "Campaign activated",
    campaign_disabled: "Campaign disabled",
    campaign_archived: "Campaign archived",
    campaign_deleted: "Campaign deleted",
  }

  if (entry.action === "eligibility_changed") {
    const change = d.change === "removed" ? "Removed" : "Added"
    const customer = String(d.customerName ?? d.customerId ?? "Customer")
    const promo = String(d.promotionName ?? entry.targetName)
    return {
      who: entry.actorName || entry.actorEmail || "Unknown",
      action: `${change} ${customer} ${d.change === "removed" ? "from" : "to"} ${promo}`,
      product: entry.targetName,
      value: "—",
      when: new Date(entry.createdAt).toLocaleString(),
    }
  }

  return {
    who: entry.actorName || entry.actorEmail || "Unknown",
    action: actionLabels[entry.action] || entry.action,
    product: entry.targetName,
    value: value !== "undefined" && value !== "" ? value : "—",
    when: new Date(entry.createdAt).toLocaleString(),
  }
}

/** Compact horizontal form — full width, no cramped cards */
function DiscountFieldsForm({
  fields,
  onChange,
  originalPrice,
  showScheduleDefault = false,
}: {
  fields: DiscountFields
  onChange: (patch: Partial<DiscountFields>) => void
  originalPrice?: number
  showScheduleDefault?: boolean
}) {
  const [scheduleOpen, setScheduleOpen] = useState(showScheduleDefault)

  const preview =
    originalPrice != null
      ? validateDiscountInput(fields.discountType, parseFloat(fields.discountValue), originalPrice)
      : null

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="w-full min-w-0">
        <Label className="text-sm text-muted-foreground mb-2 block">Type</Label>
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            type="button"
            onClick={() => onChange({ discountType: "percentage" })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors min-w-0",
              fields.discountType === "percentage"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <Percent className="h-4 w-4 shrink-0" />
            <span className="truncate">Percent</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ discountType: "fixed" })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors min-w-0",
              fields.discountType === "fixed"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <Tag className="h-4 w-4 shrink-0" />
            <span className="truncate">Fixed KSh</span>
          </button>
        </div>
      </div>

      <div className="w-full min-w-0">
        <Label className="text-sm text-muted-foreground mb-2 block">
          {fields.discountType === "percentage" ? "Percent off" : "KSh off"}
        </Label>
        <Input
          type="number"
          min={0}
          value={fields.discountValue}
          onChange={(e) => onChange({ discountValue: e.target.value })}
          className="h-11 w-full text-lg font-semibold tabular-nums"
        />
      </div>

      <div className="w-full min-w-0">
        <Label className="text-sm text-muted-foreground mb-2 block">Promotion label</Label>
        <Input
          placeholder="Optional, e.g. Happy Hour"
          value={fields.promotionName}
          onChange={(e) => onChange({ promotionName: e.target.value })}
          className="h-11 w-full"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3 w-full">
        <Label className="text-sm font-medium">
          {fields.status === "active" ? "Active on POS" : "Inactive"}
        </Label>
        <Switch
          checked={fields.status === "active"}
          onCheckedChange={(c) => onChange({ status: c ? "active" : "inactive" })}
        />
      </div>

      {/* Schedule toggle */}
      <button
        type="button"
        onClick={() => setScheduleOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {scheduleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Schedule (optional)
      </button>
      {scheduleOpen && (
        <div className="grid grid-cols-1 gap-4 w-full min-w-0">
          <div className="w-full min-w-0">
            <Label className="text-sm text-muted-foreground mb-1.5 block">Starts</Label>
            <Input
              type="datetime-local"
              value={fields.startAt}
              onChange={(e) => onChange({ startAt: e.target.value })}
              className="h-11 w-full min-w-0 text-sm"
            />
          </div>
          <div className="w-full min-w-0">
            <Label className="text-sm text-muted-foreground mb-1.5 block">Ends</Label>
            <Input
              type="datetime-local"
              value={fields.endAt}
              onChange={(e) => onChange({ endAt: e.target.value })}
              className="h-11 w-full min-w-0 text-sm"
            />
          </div>
        </div>
      )}

      {originalPrice != null && preview?.ok && (
        <p className="text-sm">
          <span className="text-muted-foreground">Preview: </span>
          <span className="line-through text-muted-foreground mr-2">{formatKsh(originalPrice)}</span>
          <span className="font-bold text-emerald-700">{formatKsh(preview.discountedPrice)}</span>
        </p>
      )}
      {originalPrice != null && preview && !preview.ok && (
        <p className="text-sm text-destructive">{preview.error}</p>
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
  const [bulkEligibility, setBulkEligibility] = useState<DiscountEligibilityState>(defaultEligibilityState())
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  const [activeDiscounts, setActiveDiscounts] = useState<ActiveDiscount[]>([])
  const [isLoadingActive, setIsLoadingActive] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")

  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscount[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; label: string }[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [categoryFields, setCategoryFields] = useState<DiscountFields>(defaultFields())
  const [categoryEligibility, setCategoryEligibility] = useState<DiscountEligibilityState>(defaultEligibilityState())
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [categoryCampaignId, setCategoryCampaignId] = useState("")

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/catha/pos-discounts/campaigns", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setCampaigns(data.campaigns || [])
    } catch {
      /* ignore */
    }
  }, [])

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
    loadCampaigns()
    loadAudit()
  }, [open, loadActiveDiscounts, loadCategoryDiscounts, loadCampaigns, loadAudit])

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
      const eligibility = eligibilityPayloadFromState(bulkEligibility)
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
          ...eligibility,
          campaignId: selectedCampaignId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(`Applied to ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}`)
      setSelectedIds(new Set())
      loadActiveDiscounts()
      loadAudit()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setIsBulkSaving(false)
    }
  }

  const saveSingleProduct = async (product: SearchProduct) => {
    try {
      const eligibility = eligibilityPayloadFromState(bulkEligibility)
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
              ...eligibility,
              campaignId: selectedCampaignId || null,
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(`Discount set on ${product.name}`)
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
    toast.success("Removed")
  }

  const saveCategoryDiscount = async () => {
    if (!newCategory) return
    try {
      const eligibility = eligibilityPayloadFromState(categoryEligibility)
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
          ...eligibility,
          campaignId: categoryCampaignId || null,
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

  const groupedActive = useMemo(() => {
    const groups = new Map<string, { title: string; items: ActiveDiscount[] }>()
    const ungrouped: ActiveDiscount[] = []
    for (const d of filteredActive) {
      if (d.campaignId && d.campaignName) {
        const g = groups.get(d.campaignId) || { title: d.campaignName, items: [] }
        g.items.push(d)
        groups.set(d.campaignId, g)
      } else {
        ungrouped.push(d)
      }
    }
    return { groups: [...groups.values()], ungrouped }
  }, [filteredActive])

  const renderActiveRow = (d: ActiveDiscount) => (
    <div key={d.id} className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{d.product?.name ?? d.productId}</p>
          {d.promotionName && !d.campaignName && (
            <p className="text-xs text-muted-foreground mt-0.5">{d.promotionName}</p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {d.discountType === "percentage" ? `${d.discountValue}%` : formatKsh(d.discountValue)}
          </p>
        </div>
        <Badge variant={d.effectivelyActive ? "default" : "secondary"} className="text-[10px] shrink-0">
          {d.effectivelyActive ? "Live" : d.status}
        </Badge>
      </div>
      <div className="flex gap-2">
        {d.status === "active" && (
          <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => disableDiscount(d)}>
            Turn off
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-9 text-destructive px-3" onClick={() => deleteDiscount(d)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

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
          {size === "sm" ? "Promotions" : "Promotions"}
        </Button>
      </DialogTrigger>

      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "!fixed !inset-0 !z-50 !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0",
          "sm:!inset-auto sm:!top-[50%] sm:!left-[50%] sm:!h-auto sm:!max-h-[min(90dvh,900px)] sm:!w-[min(920px,calc(100vw-1.5rem))] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-xl sm:!border"
        )}
      >
        <DialogHeader className="px-4 py-3 sm:px-5 sm:py-4 border-b shrink-0 pr-12">
          <DialogTitle className="text-base sm:text-lg font-semibold">Promotions</DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
            Product discounts, category discounts, campaigns, and schedules. Catalog prices stay unchanged.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="shrink-0 border-b overflow-x-auto">
            <TabsList className="inline-flex w-max min-w-full h-11 rounded-none bg-transparent px-4 gap-1 sm:gap-4">
              {(["search", "active", "categories", "campaigns", "analytics", "history"] as const).map((v) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="rounded-none border-b-2 border-transparent px-3 sm:px-0 pb-3 pt-2 text-sm whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none shrink-0"
                >
                  {v === "search"
                    ? "Apply"
                    : v === "analytics"
                      ? "Reports"
                      : v.charAt(0).toUpperCase() + v.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
            {/* ——— APPLY ——— */}
            <TabsContent value="search" className="mt-0 px-4 py-4 sm:p-5 space-y-4 sm:space-y-5">
              <section className="rounded-lg border bg-slate-50/50 p-3 sm:p-4 w-full min-w-0 overflow-hidden">
                <h3 className="text-sm font-semibold mb-3">Discount to apply</h3>
                <DiscountFieldsForm
                  fields={bulkFields}
                  onChange={(p) => setBulkFields((f) => ({ ...f, ...p }))}
                  originalPrice={previewPrice}
                />
                <div className="mt-4 pt-4 border-t space-y-4">
                  <CampaignSelect value={selectedCampaignId} onChange={setSelectedCampaignId} campaigns={campaigns} />
                  <DiscountEligibilityFields value={bulkEligibility} onChange={setBulkEligibility} />
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    onClick={saveBulk}
                    disabled={isBulkSaving}
                    className="mt-4 gap-2 w-full sm:w-auto"
                  >
                    {isBulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Apply to {selectedIds.size} selected
                  </Button>
                )}
              </section>

              {/* Search */}
              <section>
                <h3 className="text-sm font-semibold mb-3">Find products</h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search name, SKU, or barcode…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Brand</Label>
                    <Select value={filterBrand} onValueChange={setFilterBrand}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All brands</SelectItem>
                        {brands.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Discount filter</Label>
                    <Select value={filterDiscount} onValueChange={setFilterDiscount}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All products</SelectItem>
                        <SelectItem value="has_discount">Has discount</SelectItem>
                        <SelectItem value="no_discount">No discount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Results */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">
                    Results
                    {searchResults.length > 0 && (
                      <span className="font-normal text-muted-foreground ml-1">({searchResults.length})</span>
                    )}
                  </h3>
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear {selectedIds.size} selected
                    </button>
                  )}
                </div>

                <div className="rounded-lg border overflow-hidden">
                  {isSearching && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Searching…
                    </p>
                  )}
                  {!isSearching && !hasSearchCriteria && (
                    <p className="py-12 text-center text-sm text-muted-foreground px-4">
                      Search or pick a filter to list products.
                    </p>
                  )}
                  {!isSearching && hasSearchCriteria && searchResults.length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground">No matches.</p>
                  )}
                  {searchResults.map((p) => {
                    const selected = selectedIds.has(p.id)
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "px-3 py-3 border-b last:border-b-0 cursor-pointer",
                          selected ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                        onClick={() => toggleSelect(p.id)}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(p.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 mt-1"
                          />
                          <div className="relative h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
                            <Image src={p.image} alt="" fill className="object-cover" unoptimized />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug break-words">{p.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.category}</p>
                            <p className="text-sm font-semibold tabular-nums mt-1">{formatKsh(p.price)}</p>
                            {p.hasProductDiscount && (
                              <Badge variant="secondary" className="text-[10px] mt-1">On sale</Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full mt-2 h-9"
                          onClick={(e) => {
                            e.stopPropagation()
                            saveSingleProduct(p)
                          }}
                        >
                          Apply discount
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </section>
            </TabsContent>

            {/* ——— ACTIVE ——— */}
            <TabsContent value="active" className="mt-0 px-4 py-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-sm font-semibold">Product discounts</h3>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Live now</SelectItem>
                    <SelectItem value="inactive">Off</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoadingActive ? (
                <p className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></p>
              ) : filteredActive.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No discounts yet.</p>
              ) : (
                <div className="space-y-6">
                  {groupedActive.groups.map((group) => (
                    <section key={group.title}>
                      <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                        {group.title}
                        <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                      </h4>
                      <div className="space-y-2">
                        {group.items.map((d) => (
                          <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <span className="font-medium">{d.product?.name ?? d.productId}</span>
                            <span className="tabular-nums text-emerald-700 font-semibold">
                              {d.discountType === "percentage" ? `${d.discountValue}%` : formatKsh(d.discountValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                  {groupedActive.ungrouped.length > 0 && (
                    <section>
                      {groupedActive.groups.length > 0 && (
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Other discounts</h4>
                      )}
                      <div className="md:hidden space-y-3">
                        {groupedActive.ungrouped.map(renderActiveRow)}
                      </div>
                      <div className="hidden md:block rounded-lg border overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                              <th className="p-3 font-medium">Product</th>
                              <th className="p-3 font-medium text-right">Catalog</th>
                              <th className="p-3 font-medium text-right">POS price</th>
                              <th className="p-3 font-medium text-right">Discount</th>
                              <th className="p-3 font-medium text-center">Status</th>
                              <th className="p-3 w-24" />
                            </tr>
                          </thead>
                          <tbody>
                            {groupedActive.ungrouped.map((d) => (
                              <tr key={d.id} className="border-b last:border-b-0 hover:bg-muted/30">
                                <td className="p-3">
                                  <p className="font-medium">{d.product?.name ?? d.productId}</p>
                                  {d.promotionName && (
                                    <p className="text-xs text-muted-foreground">{d.promotionName}</p>
                                  )}
                                </td>
                                <td className="p-3 text-right tabular-nums text-muted-foreground">
                                  {d.catalogPrice != null ? formatKsh(d.catalogPrice) : "—"}
                                </td>
                                <td className="p-3 text-right tabular-nums font-semibold text-emerald-700">
                                  {d.discountedPrice != null ? formatKsh(d.discountedPrice) : "—"}
                                </td>
                                <td className="p-3 text-right tabular-nums">
                                  {d.discountType === "percentage" ? `${d.discountValue}%` : formatKsh(d.discountValue)}
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant={d.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                                    {d.effectivelyActive ? "Live" : d.status}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-end gap-1">
                                    {d.status === "active" && (
                                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => disableDiscount(d)}>
                                        Off
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => deleteDiscount(d)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  {groupedActive.groups.length === 0 && groupedActive.ungrouped.length > 0 && (
                    <div className="md:hidden space-y-3">
                      {groupedActive.ungrouped.map(renderActiveRow)}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ——— CATEGORIES ——— */}
            <TabsContent value="categories" className="mt-0 px-4 py-4 sm:p-5 space-y-4 sm:space-y-6">
              <section className="rounded-lg border p-3 sm:p-4 w-full min-w-0 overflow-hidden">
                <h3 className="text-sm font-semibold mb-1">New category discount</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Applies to all products in a category. Product-specific discounts override this.
                </p>
                <div className="mb-4 w-full min-w-0">
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose category" /></SelectTrigger>
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
                />
                <div className="mt-4 pt-4 border-t space-y-4">
                  <CampaignSelect value={categoryCampaignId} onChange={setCategoryCampaignId} campaigns={campaigns} />
                  <DiscountEligibilityFields value={categoryEligibility} onChange={setCategoryEligibility} />
                </div>
                <Button onClick={saveCategoryDiscount} disabled={!newCategory} className="mt-4 gap-2 w-full sm:w-auto">
                  <Save className="h-4 w-4" /> Save category discount
                </Button>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-3">
                  Saved ({categoryDiscounts.length})
                </h3>
                {categoryDiscounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">None yet.</p>
                ) : (
                  <div className="rounded-lg border divide-y">
                    {categoryDiscounts.map((c) => (
                      <div key={c.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{c.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {c.discountType === "percentage" ? `${c.discountValue}% off` : `${formatKsh(c.discountValue)} off`}
                            {c.promotionName ? ` · ${c.promotionName}` : ""}
                          </p>
                          {c.eligibilityScope === "selected_customers" &&
                            (c.eligibleCustomers?.length ?? 0) > 0 && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                {c.eligibleCustomers!.length} customer
                                {c.eligibleCustomers!.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={c.effectivelyActive ? "default" : "secondary"}>
                            {c.effectivelyActive ? "Live" : "Off"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8"
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
              </section>
            </TabsContent>

            <TabsContent value="campaigns" className="mt-0 flex-1 min-h-0 overflow-y-auto">
              <PromotionCampaignsTab onChanged={() => { loadCampaigns(); loadActiveDiscounts(); loadAudit() }} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 flex-1 min-h-0 overflow-y-auto">
              <PromotionAnalyticsTab />
            </TabsContent>

            {/* ——— HISTORY ——— */}
            <TabsContent value="history" className="mt-0 px-4 py-4 sm:p-5">
              {auditLog.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <>
                  <div className="md:hidden space-y-2">
                    {auditLog.map((entry) => {
                      const row = auditSummary(entry)
                      return (
                        <div key={entry.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium break-words">{row.product}</p>
                            <span className="text-xs font-semibold tabular-nums shrink-0">{row.value}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {row.action} · {row.who}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">{row.when}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="hidden md:block rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="p-3 font-medium whitespace-nowrap">When</th>
                          <th className="p-3 font-medium">Who</th>
                          <th className="p-3 font-medium">Action</th>
                          <th className="p-3 font-medium">Product</th>
                          <th className="p-3 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((entry) => {
                          const row = auditSummary(entry)
                          return (
                            <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30">
                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{row.when}</td>
                              <td className="p-3">{row.who}</td>
                              <td className="p-3">{row.action}</td>
                              <td className="p-3 font-medium">{row.product}</td>
                              <td className="p-3 text-right tabular-nums">{row.value}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
