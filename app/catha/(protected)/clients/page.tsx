 "use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { UserCircle2, Pencil, Trash2, Loader2, Search } from "lucide-react"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

interface ClientRow {
  phone: string
  name: string
  visits: number
  spend: number
  status: string
  lastOrderAt: string | null
}

interface EligibleCampaignRow {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  discountSummary: string
}

export default function ClientsPage() {
  const { canEdit, canDelete } = useCathaPermissions("clients")
  const [clients, setClients] = useState<ClientRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [segmentFilter, setSegmentFilter] = useState<"all" | "inactive-repeat">("all")
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [eligibleCampaigns, setEligibleCampaigns] = useState<EligibleCampaignRow[]>([])
  const [loadingDiscounts, setLoadingDiscounts] = useState(false)

  const fetchClients = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch("/api/catha/clients")
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to fetch clients")
      }
      setClients(data.clients || [])
    } catch (e: any) {
      console.error("Error fetching clients:", e)
      setError(e?.message || "Failed to load clients")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams(window.location.search)
    if (p.get("segment") === "inactive-repeat") setSegmentFilter("inactive-repeat")
  }, [])

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - thirtyDaysMs

    return clients.filter((c) => {
      if (segmentFilter === "inactive-repeat") {
        if (c.visits < 2 || !c.lastOrderAt) return false
        const last = new Date(c.lastOrderAt).getTime()
        if (Number.isNaN(last) || last >= cutoff) return false
      }
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      )
    })
  }, [clients, searchQuery, segmentFilter])

  const openEdit = (client: ClientRow) => {
    setEditingClient(client)
    setEditName(client.name)
    setEditStatus(client.status)
    setEligibleCampaigns([])
    setLoadingDiscounts(true)
    fetch(`/api/catha/clients/eligible-discounts?phone=${encodeURIComponent(client.phone)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setEligibleCampaigns(data.campaigns || [])
      })
      .catch(() => setEligibleCampaigns([]))
      .finally(() => setLoadingDiscounts(false))
  }

  const saveEdit = async () => {
    if (!editingClient) return
    setSaving(true)
    try {
      const res = await fetch("/api/catha/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: editingClient.phone, name: editName, status: editStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update client")
      }
      setClients((prev) =>
        prev.map((c) =>
          c.phone === editingClient.phone ? { ...c, name: editName, status: editStatus } : c
        )
      )
      setEditingClient(null)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Failed to update client")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (client: ClientRow) => {
    if (!confirm(`Delete client ${client.name}? This hides them from the list but keeps order history.`)) {
      return
    }
    try {
      const res = await fetch(`/api/catha/clients?phone=${encodeURIComponent(client.phone)}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to delete client")
      }
      setClients((prev) => prev.filter((c) => c.phone !== client.phone))
      if (editingClient?.phone === client.phone) {
        setEditingClient(null)
      }
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Failed to delete client")
    }
  }

  return (
    <>
      <Header title="Clients" subtitle="Track frequent customers and groups" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-100 flex items-center justify-center">
              <UserCircle2 className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Customer List</h2>
              <p className="text-sm text-muted-foreground">
                From <span className="font-medium">orders</span> using the customer phone saved at checkout (POS /
                Orders payment prompt for M-Pesa). Visits include pending and completed; spend counts{" "}
                <span className="font-medium">completed</span> orders only (normalized phone).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full md:w-64 rounded-xl"
              />
            </div>
            <Button
              variant="outline"
              onClick={fetchClients}
              disabled={isLoading}
              className="gap-2 rounded-xl"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground">Clients</CardTitle>
            <CardDescription>
              Visits = orders with a phone (pending or completed). Spend = completed orders only. The phone shown is
              the customer phone saved on each order (POS checkout field or the number you enter for the M-Pesa STK
              prompt)—not the raw M-Pesa payer metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No clients found yet. Once you complete orders with a phone number, they will
                        appear here automatically.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.phone} className="border-border">
                        <TableCell className="text-sm text-foreground">{client.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{client.phone}</TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {client.visits}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">
                          Ksh {Math.round(client.spend || 0).toLocaleString("en-KE")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className="text-[11px] capitalize"
                            variant={client.status.toLowerCase() === "active" ? "default" : "outline"}
                          >
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(client)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => handleDelete(client)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Client details</DialogTitle>
            <DialogDescription>
              View customer profile, eligible POS discounts, and update display name or status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Phone
              </label>
              <Input value={editingClient?.phone || ""} disabled className="bg-muted" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Name
              </label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Status
              </label>
              <Input
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                placeholder="e.g. Active, Prospect, VIP"
                disabled={!canEdit}
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Eligible Campaigns
              </p>
              {loadingDiscounts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : eligibleCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active promotion campaigns for this customer.</p>
              ) : (
                <ul className="space-y-2">
                  {eligibleCampaigns.map((c) => (
                    <li key={c.id} className="text-sm flex items-start gap-2">
                      <span>{c.icon || "🔥"}</span>
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-muted-foreground">{c.discountSummary}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditingClient(null)}
              className="rounded-xl h-10"
            >
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
            <Button
              onClick={saveEdit}
              disabled={saving}
              className="rounded-xl h-10"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

