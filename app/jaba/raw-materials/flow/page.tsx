"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Shuffle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type FlowDirection = "in" | "out" | "transfer"

type FlowEntry = {
  id: string
  at: string
  direction: FlowDirection
  source: string
  materialName: string
  quantity: number
  unit: string
  reference: string
  detail: string
  afterStock: number | null
  category: string
}

export default function RawMaterialFlowPage() {
  const [entries, setEntries] = useState<FlowEntry[]>([])
  const [summary, setSummary] = useState<{
    totalLines: number
    inCount: number
    outCount: number
    transferCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState<string>("all")
  const [material, setMaterial] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (direction && direction !== "all") p.set("direction", direction)
    if (material.trim()) p.set("material", material.trim())
    if (from) p.set("from", from)
    if (to) p.set("to", to)
    p.set("limit", "800")
    return p.toString()
  }, [direction, material, from, to])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jaba/raw-materials/flow?${queryString}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load flow")
      setEntries(data.entries || [])
      setSummary(data.summary || null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load"
      toast.error(msg)
      setEntries([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    load()
  }, [load])

  const dirBadge = (d: FlowDirection) => {
    if (d === "in") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 font-medium">
          <ArrowDownLeft className="h-3 w-3" />
          In
        </Badge>
      )
    }
    if (d === "out") {
      return (
        <Badge className="bg-rose-600 hover:bg-rose-600 text-white gap-1 font-medium">
          <ArrowUpRight className="h-3 w-3" />
          Out
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1 font-medium border border-slate-300 dark:border-slate-600">
        <Shuffle className="h-3 w-3" />
        Internal
      </Badge>
    )
  }

  const formatWhen = (iso: string) => {
    try {
      const dt = new Date(iso)
      return dt.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    } catch {
      return iso
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-16 flex-col gap-3 border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">Raw material inflow &amp; outflow</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Supplier restocks, batch consumption, packaging use, and reversals in one place
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-slate-300 dark:border-slate-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/jaba/raw-materials">
            <Button variant="outline" size="sm" className="border-slate-300 dark:border-slate-700">
              <Package className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Raw materials</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Inflow lines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
                {summary?.inCount ?? "—"}
              </p>
              <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90 mt-1">Restocks &amp; returns</p>
            </CardContent>
          </Card>
          <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-rose-800 dark:text-rose-200">Outflow lines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 tabular-nums">
                {summary?.outCount ?? "—"}
              </p>
              <p className="text-xs text-rose-700/90 dark:text-rose-300/90 mt-1">Batches, packaging, usage</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-800 dark:text-slate-200">Internal / transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {summary?.transferCount ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">e.g. neutral → flavour lines</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Shown (filtered)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 tabular-nums">
                {summary?.totalLines ?? entries.length}
              </p>
              <p className="text-xs text-blue-700/90 dark:text-blue-300/90 mt-1">Rows in table below</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground">Direction</p>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All movements</SelectItem>
                  <SelectItem value="in">Inflow only</SelectItem>
                  <SelectItem value="out">Outflow only</SelectItem>
                  <SelectItem value="transfer">Internal / transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground">Material / reference</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Search name, batch, package…"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 w-full sm:w-auto sm:min-w-[140px]">
              <p className="text-xs font-medium text-muted-foreground">From</p>
              <Input className="h-10" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2 w-full sm:w-auto sm:min-w-[140px]">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input className="h-10" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button className="h-10 w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900" onClick={load} disabled={loading}>
              Apply
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading movements…</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm px-4">
                No lines match your filters. Try widening the date range or clearing search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900/80">
                      <TableHead className="whitespace-nowrap font-semibold">When</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">Direction</TableHead>
                      <TableHead className="font-semibold min-w-[160px]">Material</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">Qty</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">Source</TableHead>
                      <TableHead className="font-semibold min-w-[160px]">Reference</TableHead>
                      <TableHead className="font-semibold hidden lg:table-cell">Detail</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">Balance after</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "border-b border-slate-100 dark:border-slate-800",
                          row.direction === "in" && "bg-emerald-50/40 dark:bg-emerald-950/10",
                          row.direction === "out" && "bg-rose-50/30 dark:bg-rose-950/10"
                        )}
                      >
                        <TableCell className="text-sm whitespace-nowrap align-top">{formatWhen(row.at)}</TableCell>
                        <TableCell className="align-top">{dirBadge(row.direction)}</TableCell>
                        <TableCell className="font-medium text-sm align-top">{row.materialName}</TableCell>
                        <TableCell className="tabular-nums text-sm align-top">
                          {row.quantity.toLocaleString()} {row.unit}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground align-top">{row.source}</TableCell>
                        <TableCell className="text-sm align-top max-w-[220px] break-words">{row.reference}</TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top hidden lg:table-cell max-w-[280px]">
                          {row.detail}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums align-top">
                          {row.afterStock !== null && Number.isFinite(row.afterStock) ? row.afterStock.toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
