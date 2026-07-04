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

interface CouponRow {
  id: string
  code: string
  label: string | null
  discountType: "percentage" | "fixed"
  discountValue: number
  status: "active" | "inactive"
  minSpend: number
  maxRedemptions: number | null
  redemptionCount: number
  singleUsePerCustomer: boolean
  effectivelyActive?: boolean
}

const defaultForm = () => ({
  code: "",
  label: "",
  discountType: "percentage" as const,
  discountValue: "10",
  status: "inactive" as const,
  minSpend: "0",
  maxRedemptions: "",
  singleUsePerCustomer: false,
  campaignId: "",
})

export function PromotionCouponsTab({ campaigns = [] }: { campaigns?: CampaignRow[] }) {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [eligibility, setEligibility] = useState<DiscountEligibilityState>(defaultEligibilityState())

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/coupons", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setCoupons(data.coupons || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load coupons")
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
    setEligibility(defaultEligibilityState())
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        code: form.code,
        label: form.label || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        status: form.status,
        minSpend: Number(form.minSpend) || 0,
        maxRedemptions: form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null,
        singleUsePerCustomer: form.singleUsePerCustomer,
        campaignId: form.campaignId || null,
        eligibilityScope: eligibility.eligibilityScope,
        eligibleCustomers: eligibility.eligibleCustomers.map((c) => c.id),
      }
      const res = await fetch("/api/catha/pos-discounts/coupons", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(editingId ? "Coupon updated" : "Coupon created")
      resetForm()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save coupon")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this coupon?")) return
    const res = await fetch(`/api/catha/pos-discounts/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete")
      return
    }
    toast.success("Coupon deleted")
    load()
  }

  return (
    <div className="px-4 py-4 sm:p-5 space-y-5">
      <section className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold">{editingId ? "Edit coupon" : "New promo code"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Code</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="mt-1 h-10 uppercase"
              placeholder="SUMMER20"
              disabled={Boolean(editingId)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={form.discountType} onValueChange={(v) => setForm((f) => ({ ...f, discountType: v as "percentage" | "fixed" }))}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input type="number" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min spend (KSh)</Label>
            <Input type="number" value={form.minSpend} onChange={(e) => setForm((f) => ({ ...f, minSpend: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max redemptions</Label>
            <Input type="number" value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))} className="mt-1 h-10" placeholder="Unlimited" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CampaignSelect value={form.campaignId} onChange={(id) => setForm((f) => ({ ...f, campaignId: id }))} campaigns={campaigns} />
        <DiscountEligibilityFields value={eligibility} onChange={setEligibility} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.singleUsePerCustomer} onChange={(e) => setForm((f) => ({ ...f, singleUsePerCustomer: e.target.checked }))} />
          One use per customer
        </label>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? "Update" : "Create"}
          </Button>
          {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Promo codes ({coupons.length})</h3>
        {loading ? (
          <p className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">No promo codes yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {coupons.map((c) => (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{c.code}</span>
                    <Badge variant={c.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                      {c.effectivelyActive ? "Live" : c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.discountType === "percentage" ? `${c.discountValue}%` : `KSh ${c.discountValue}`} off
                    {c.minSpend > 0 ? ` · min KSh ${c.minSpend}` : ""}
                    {c.maxRedemptions != null ? ` · ${c.redemptionCount}/${c.maxRedemptions} used` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingId(c.id)
                    setForm({
                      code: c.code,
                      label: c.label || "",
                      discountType: c.discountType,
                      discountValue: String(c.discountValue),
                      status: c.status,
                      minSpend: String(c.minSpend),
                      maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : "",
                      singleUsePerCustomer: c.singleUsePerCustomer,
                      campaignId: "",
                    })
                  }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}>
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
