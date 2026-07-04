"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface CampaignRow {
  id: string
  name: string
  description: string | null
  status: "active" | "inactive" | "archived"
  priority: number
  startAt: string | null
  endAt: string | null
  color: string | null
  icon: string | null
  effectivelyActive?: boolean
  linkedProductCount?: number
  linkedCategoryCount?: number
}

const defaultForm = (): {
  name: string
  description: string
  status: CampaignRow["status"]
  priority: string
  startAt: string
  endAt: string
  color: string
  icon: string
} => ({
  name: "",
  description: "",
  status: "inactive" as const,
  priority: "0",
  startAt: "",
  endAt: "",
  color: "#f59e0b",
  icon: "🔥",
})

const ICON_OPTIONS = ["🔥", "🎉", "⭐", "🍻", "🎄", "💎", "🖤", "👑", "🌙", "🎁"]

export function PromotionCampaignsTab({
  onChanged,
}: {
  onChanged?: () => void
}) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/campaigns", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setCampaigns(data.campaigns || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load campaigns")
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
  }

  const startEdit = (c: CampaignRow) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      description: c.description || "",
      status: c.status,
      priority: String(c.priority),
      startAt: c.startAt ? c.startAt.slice(0, 16) : "",
      endAt: c.endAt ? c.endAt.slice(0, 16) : "",
      color: c.color || "#f59e0b",
      icon: c.icon || "🔥",
    })
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Campaign name is required")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: parseInt(form.priority, 10) || 0,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        color: form.color || null,
        icon: form.icon || null,
      }
      const res = await fetch("/api/catha/pos-discounts/campaigns", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(editingId ? "Campaign updated" : "Campaign created")
      resetForm()
      load()
      onChanged?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (c: CampaignRow, status: CampaignRow["status"]) => {
    try {
      const res = await fetch("/api/catha/pos-discounts/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, name: c.name, status, priority: c.priority }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      load()
      onChanged?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  const remove = async (c: CampaignRow) => {
    if (!confirm(`Delete campaign "${c.name}"? Linked discounts will be unlinked.`)) return
    try {
      const res = await fetch(`/api/catha/pos-discounts/campaigns?id=${c.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success("Campaign deleted")
      load()
      onChanged?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    }
  }

  return (
    <div className="px-4 py-4 sm:p-5 space-y-6">
      <section className="rounded-lg border p-3 sm:p-4 space-y-4">
        <h3 className="text-sm font-semibold">{editingId ? "Edit campaign" : "New campaign"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Campaign name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 h-10" placeholder="Happy Hour" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 h-10" placeholder="Optional" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CampaignRow["status"] }))}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Color</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="mt-1 h-10 p-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Icon</Label>
            <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((ic) => (
                  <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Starts</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ends</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} className="mt-1 h-10" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? "Update campaign" : "Create campaign"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Campaigns ({campaigns.length})</h3>
        {loading ? (
          <p className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">No campaigns yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {campaigns.map((c) => (
              <div key={c.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{c.icon || "🔥"}</span>
                    <p className="font-semibold">{c.name}</p>
                    <Badge variant={c.effectivelyActive ? "default" : "secondary"} className="text-[10px]">
                      {c.effectivelyActive ? "Live" : c.status}
                    </Badge>
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.linkedProductCount ?? 0} products · {c.linkedCategoryCount ?? 0} categories · priority {c.priority}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                  {c.status !== "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "active")}>Activate</Button>
                  )}
                  {c.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "inactive")}>Deactivate</Button>
                  )}
                  {c.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "archived")}>Archive</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)}>
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

export function CampaignSelect({
  value,
  onChange,
  campaigns,
}: {
  value: string
  onChange: (id: string) => void
  campaigns: CampaignRow[]
}) {
  return (
    <div>
      <Label className="text-sm text-muted-foreground mb-1.5 block">Campaign (optional)</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger className="h-10"><SelectValue placeholder="No campaign" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No campaign</SelectItem>
          {campaigns.filter((c) => c.status !== "archived").map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.icon} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
