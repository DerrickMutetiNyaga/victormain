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

interface SpendRow {
  id: string
  name: string
  status: "active" | "inactive"
  threshold: number
  discountType: "percentage" | "fixed"
  discountValue: number
  priority: number
  effectivelyActive?: boolean
}

const defaultForm = () => ({
  name: "",
  status: "inactive" as const,
  threshold: "5000",
  discountType: "percentage" as const,
  discountValue: "10",
  priority: "0",
  campaignId: "",
})

export function PromotionSpendTab({ campaigns = [] }: { campaigns?: CampaignRow[] }) {
  const [promotions, setPromotions] = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [eligibility, setEligibility] = useState<DiscountEligibilityState>(defaultEligibilityState())

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/spend", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setPromotions(data.spendPromotions || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load spend promotions")
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
        name: form.name,
        status: form.status,
        threshold: Number(form.threshold),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        priority: Number(form.priority) || 0,
        campaignId: form.campaignId || null,
        eligibilityScope: eligibility.eligibilityScope,
        eligibleCustomers: eligibility.eligibleCustomers.map((c) => c.id),
      }
      const res = await fetch("/api/catha/pos-discounts/spend", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(editingId ? "Spend promotion updated" : "Spend promotion created")
      resetForm()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this spend promotion?")) return
    const res = await fetch(`/api/catha/pos-discounts/spend?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete")
      return
    }
    toast.success("Deleted")
    load()
  }

  return (
    <div className="px-4 py-4 sm:p-5 space-y-5">
      <section className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold">{editingId ? "Edit spend promotion" : "New spend promotion"}</h3>
        <p className="text-xs text-muted-foreground">Order-level discount when subtotal (after line discounts) meets the threshold.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min spend (KSh)</Label>
            <Input type="number" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Discount type</Label>
            <Select value={form.discountType} onValueChange={(v) => setForm((f) => ({ ...f, discountType: v as "percentage" | "fixed" }))}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Discount value</Label>
            <Input type="number" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} className="mt-1 h-10" />
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
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? "Update" : "Create"}
          </Button>
          {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Spend promotions ({promotions.length})</h3>
        {loading ? (
          <p className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></p>
        ) : promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">No spend promotions yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {promotions.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant={p.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                      {p.effectivelyActive ? "Live" : p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Spend KSh {p.threshold.toLocaleString()}+ → {p.discountType === "percentage" ? `${p.discountValue}%` : `KSh ${p.discountValue}`} off
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingId(p.id)
                    setForm({
                      name: p.name,
                      status: p.status,
                      threshold: String(p.threshold),
                      discountType: p.discountType,
                      discountValue: String(p.discountValue),
                      priority: String(p.priority),
                      campaignId: "",
                    })
                  }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>
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
