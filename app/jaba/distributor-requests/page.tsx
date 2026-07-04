"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, Clock, CheckCircle2, XCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

type RequestStatus = "pending" | "approved" | "rejected"

type DistributorRequest = {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  products: string
  status: RequestStatus
  submittedAt: string
}

export default function JabaDistributorRequestsPage() {
  const [requests, setRequests] = useState<DistributorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/jaba/distributor-requests")
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to fetch distributor requests")
      setRequests(data.requests ?? [])
    } catch (e: any) {
      toast.error(e?.message || "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return requests.filter((r) => {
      const matchesQuery =
        r.name.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || r.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [requests, query, statusFilter])

  const updateStatus = async (id: string, status: RequestStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/jaba/distributor-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to update request")
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
      toast.success(`Request ${status}`)
    } catch (e: any) {
      toast.error(e?.message || "Failed to update request")
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteRequest = async (id: string) => {
    if (!confirm("Delete this request?")) return
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/jaba/distributor-requests/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to delete request")
      setRequests((prev) => prev.filter((r) => r.id !== id))
      toast.success("Request deleted")
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete request")
    } finally {
      setUpdatingId(null)
    }
  }

  const badgeClass = (status: RequestStatus) => {
    if (status === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-300"
    if (status === "rejected") return "bg-red-100 text-red-800 border-red-300"
    return "bg-amber-100 text-amber-800 border-amber-300"
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jaba Distributor Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests..." />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Products/Area</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          {r.contact}
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{r.products}</TableCell>
                        <TableCell>
                          <Badge className={`border capitalize ${badgeClass(r.status)}`}>
                            {r.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {r.status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {r.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(r.submittedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            {r.status !== "approved" && (
                              <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => updateStatus(r.id, "approved")}>
                                Approve
                              </Button>
                            )}
                            {r.status !== "rejected" && (
                              <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => updateStatus(r.id, "rejected")}>
                                Reject
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" disabled={updatingId === r.id} onClick={() => deleteRequest(r.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
