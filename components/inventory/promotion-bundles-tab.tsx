"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CampaignSelect, type CampaignRow } from "@/components/inventory/promotion-campaigns-tab"
import {
  DiscountEligibilityFields,
  defaultEligibilityState,
  type DiscountEligibilityState,
} from "@/components/inventory/discount-eligibility-fields"
import {
  PromotionProductPicker,
  resolvePickedProducts,
  type PickedProduct,
} from "@/components/inventory/promotion-product-picker"

interface BundleRow {
  id: string
  name: string
  status: "active" | "inactive"
  productIds: string[]
  bundlePrice: number
  priority: number
  effectivelyActive?: boolean
}

const defaultForm = (): {
  name: string
  status: "active" | "inactive"
  bundlePrice: string
  priority: string
  campaignId: string
} => ({
  name: "",
  status: "inactive",
  bundlePrice: "",
  priority: "0",
  campaignId: "",
})

export function PromotionBundlesTab({ campaigns = [] }: { campaigns?: CampaignRow[] }) {
  const [bundles, setBundles] = useState<BundleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [selectedProducts, setSelectedProducts] = useState<PickedProduct[]>([])
  const [resolvingProducts, setResolvingProducts] = useState(false)
  const [eligibility, setEligibility] = useState<DiscountEligibilityState>(defaultEligibilityState())

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/bundles", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setBundles(data.bundles || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load bundles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm())
    setSelectedProducts([])
    setEligibility(defaultEligibilityState())
  }

  const startEdit = async (b: BundleRow) => {
    setEditingId(b.id)
    setForm({
      name: b.name,
      status: b.status,
      bundlePrice: String(b.bundlePrice),
      priority: String(b.priority),
      campaignId: "",
    })
    setResolvingProducts(true)
    try {
      const picked = await resolvePickedProducts(b.productIds)
      setSelectedProducts(picked)
    } finally {
      setResolvingProducts(false)
    }
  }

  const save = async () => {
    const productIds = selectedProducts.map((p) => p.id)
    if (productIds.length < 2) {
      toast.error("Add at least 2 products to the bundle")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name,
        status: form.status,
        productIds,
        bundlePrice: Number(form.bundlePrice),
        priority: Number(form.priority) || 0,
        campaignId: form.campaignId || null,
        eligibilityScope: eligibility.eligibilityScope,
        eligibleCustomers: eligibility.eligibleCustomers.map((c) => c.id),
      }
      const res = await fetch("/api/catha/pos-discounts/bundles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(editingId ? "Bundle updated" : "Bundle created")
      resetForm()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save bundle")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this bundle?")) return
    const res = await fetch(`/api/catha/pos-discounts/bundles?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete")
      return
    }
    toast.success("Bundle deleted")
    load()
  }

  const catalogSum = selectedProducts.reduce((sum, p) => sum + p.price, 0)

  return (
    <div className="px-4 py-4 sm:p-5 space-y-5">
      <section className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold">{editingId ? "Edit bundle" : "New bundle"}</h3>
        <p className="text-xs text-muted-foreground">
          Fixed price when all selected products are in the cart (one unit each per bundle set).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bundle price (KSh)</Label>
            <Input
              type="number"
              value={form.bundlePrice}
              onChange={(e) => setForm((f) => ({ ...f, bundlePrice: e.target.value }))}
              className="mt-1 h-10"
            />
            {selectedProducts.length >= 2 && catalogSum > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Catalog total: KSh {catalogSum.toLocaleString("en-KE")} per set
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 h-10"
            />
          </div>
          <div className="sm:col-span-2">
            {resolvingProducts ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading products…
              </p>
            ) : (
              <PromotionProductPicker
                value={selectedProducts}
                onChange={setSelectedProducts}
                minProducts={2}
              />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}
            >
              <SelectTrigger className="mt-1 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CampaignSelect value={form.campaignId} onChange={(id) => setForm((f) => ({ ...f, campaignId: id }))} campaigns={campaigns} />
        <DiscountEligibilityFields value={eligibility} onChange={setEligibility} />
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || resolvingProducts} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? "Update" : "Create"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Bundles ({bundles.length})</h3>
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline" />
          </p>
        ) : bundles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">No bundles yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {bundles.map((b) => (
              <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.name}</span>
                    <Badge variant={b.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                      {b.effectivelyActive ? "Live" : b.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    KSh {b.bundlePrice.toLocaleString()} · {b.productIds.length} products · priority {b.priority}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(b)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
