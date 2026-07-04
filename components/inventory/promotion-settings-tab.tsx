"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type ConflictMode = "never_stack" | "best_discount" | "highest_priority" | "allow_stacking"

export function PromotionSettingsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<ConflictMode>("never_stack")
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/settings", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setMode(data.conflictMode)
      setOptions(data.options || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/catha/pos-discounts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictMode: mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success("Promotion conflict rule saved")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline" />
      </p>
    )
  }

  return (
    <div className="px-4 py-4 sm:p-5 space-y-5 max-w-xl">
      <section className="rounded-lg border p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Promotion conflict resolution</h3>
          <p className="text-xs text-muted-foreground mt-1">
            When a product and category discount both qualify on the same line, this rule decides how pricing is applied.
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Rule</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as ConflictMode)}>
            <SelectTrigger className="mt-1 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save rule
        </Button>
      </section>
    </div>
  )
}
