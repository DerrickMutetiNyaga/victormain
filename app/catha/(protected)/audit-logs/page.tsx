"use client"

import { useCallback, useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AuditLogRow = {
  id: string
  type: "SECURITY" | "FINANCIAL" | "SYSTEM"
  action: string
  status: "SUCCESS" | "DENIED"
  reason: string | null
  userId: string | null
  role: string | null
  shiftId: string | null
  endpoint: string
  payloadSummary: Record<string, unknown>
  createdAt: string
}

type AuditAnalytics = {
  window: string
  denied24h: number
  success24h: number
  total24h: number
  deniedRate24h: number
  deniedByUser: Array<{ userId: string; deniedCount: number }>
  deniedByDay: Array<{ day: string; deniedCount: number }>
}

export default function AuditLogsPage() {
  const [type, setType] = useState("all")
  const [status, setStatus] = useState("all")
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [analytics, setAnalytics] = useState<AuditAnalytics | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (type !== "all") params.set("type", type)
      if (status !== "all") params.set("status", status)
      if (userId.trim()) params.set("userId", userId.trim())
      params.set("limit", "200")
      const response = await fetch(`/api/catha/audit-logs?${params.toString()}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load logs")
      setRows(Array.isArray(data.logs) ? data.logs : [])
      setAnalytics(data.analytics || null)
    } catch {
      setRows([])
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [status, type, userId])

  useEffect(() => {
    loadLogs().catch(() => {})
  }, [loadLogs])

  return (
    <>
      <Header title="Audit Logs" subtitle="Security and financial event trail" />
      <div className="p-4 sm:p-6 space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="SECURITY">Security</SelectItem>
                  <SelectItem value="FINANCIAL">Financial</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="DENIED">Denied</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
              <Button onClick={() => loadLogs().catch(() => {})} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Denied (24h)</p>
                <p className="text-2xl font-semibold">{analytics?.denied24h ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Success (24h)</p>
                <p className="text-2xl font-semibold">{analytics?.success24h ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Total (24h)</p>
                <p className="text-2xl font-semibold">{analytics?.total24h ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Denied rate (24h)</p>
                <p className="text-2xl font-semibold">{analytics?.deniedRate24h ?? 0}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded border p-3">
                <p className="font-medium mb-2">Top denied users (24h)</p>
                <div className="space-y-2">
                  {(analytics?.deniedByUser || []).map((row) => (
                    <div key={row.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{row.userId}</span>
                      <span className="font-semibold">{row.deniedCount}</span>
                    </div>
                  ))}
                  {!(analytics?.deniedByUser || []).length ? (
                    <p className="text-sm text-muted-foreground">No denied events in last 24h.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded border p-3">
                <p className="font-medium mb-2">Denied by day</p>
                <div className="space-y-2">
                  {(analytics?.deniedByDay || []).map((row) => (
                    <div key={row.day} className="flex items-center justify-between text-sm">
                      <span>{row.day}</span>
                      <span className="font-semibold">{row.deniedCount}</span>
                    </div>
                  ))}
                  {!(analytics?.deniedByDay || []).length ? (
                    <p className="text-sm text-muted-foreground">No denied events in last 24h.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(row.createdAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>{row.type}</span>
                    <span>•</span>
                    <span className={row.status === "DENIED" ? "text-red-600" : "text-emerald-600"}>{row.status}</span>
                  </div>
                  <p className="mt-1 font-medium">{row.action}</p>
                  <p className="text-sm text-muted-foreground">{row.endpoint}</p>
                  {row.reason ? <p className="text-sm text-red-600 mt-1">{row.reason}</p> : null}
                </div>
              ))}
              {!rows.length && !loading ? <p className="text-sm text-muted-foreground">No audit logs found.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
