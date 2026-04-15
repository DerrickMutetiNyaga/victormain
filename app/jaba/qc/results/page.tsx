"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Hash, User, Calendar, FileText, BarChart3, LayoutGrid, List, Eye, Loader2, CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface QCResult {
  id: string
  batchId: string
  batchNumber: string
  inspector?: string
  status: "Pass" | "Fail" | "Pending"
  date: string | Date
  checklist?: {
    item: string
    result: "Pass" | "Fail" | "Pending"
    notes?: string
    checked?: boolean
  }[]
  notes?: string
  qcStage?: "initial" | "final"
}

export default function QCResultsPage() {
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [qcResults, setQcResults] = useState<QCResult[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingResult, setViewingResult] = useState<QCResult | null>(null)

  useEffect(() => {
    const fetchQCResults = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/jaba/batches')
        const data = await response.json()
        
        if (response.ok && data.batches) {
          // Transform batches with QC data into QC results
          const results: QCResult[] = data.batches
            .filter((batch: any) => batch.qcStatus && batch.qcStatus !== "Pending")
            .map((batch: any) => ({
              id: batch._id || batch.id,
              batchId: batch._id || batch.id,
              batchNumber: batch.batchNumber,
              inspector: batch.supervisor || "QC Inspector",
              status: batch.qcStatus === "Pass" ? "Pass" : batch.qcStatus === "Fail" ? "Fail" : "Pending",
              date: batch.date || batch.updatedAt || new Date(),
              checklist: batch.qcChecklist || [],
              notes: batch.qcNotes || "",
              qcStage: batch.qcStage || "initial",
            }))
            .sort((a: QCResult, b: QCResult) => {
              const dateA = new Date(a.date).getTime()
              const dateB = new Date(b.date).getTime()
              return dateB - dateA
            })
          
          setQcResults(results)
        }
      } catch (error) {
        console.error('Error fetching QC results:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchQCResults()
  }, [])

  const passCount = qcResults.filter((r) => r.status === "Pass").length
  const failCount = qcResults.filter((r) => r.status === "Fail").length
  const pendingCount = qcResults.filter((r) => r.status === "Pending").length

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <ClipboardCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Batch QC Results</h1>
            <p className="text-sm text-muted-foreground">Quality control test results</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        )}
        {!loading && (
          <div>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Passed</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">{passCount}</p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Quality approved</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">{failCount}</p>
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <XCircle className="h-3 w-3" />
                    <span>Needs attention</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Pending</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">{pendingCount}</p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" />
                    <span>Awaiting review</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">View:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "table"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4 mr-1.5" />
                Table
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "grid"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Grid
              </Button>
            </div>
          </div>
          <Badge className="bg-green-600 text-white border-0 shadow-sm text-xs">
            {qcResults.length} result{qcResults.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Table View */}
        {viewMode === "table" && (
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              QC Test Results ({qcResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="font-sans">
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        Batch No.
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-green-500 dark:text-green-400" />
                        QC Status
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                        Inspector
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        Date
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        Test Results Summary
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                        Notes
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3 px-4">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <ClipboardCheck className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-medium">No QC results found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    qcResults.map((result, idx) => {
                      const passCount = (result.checklist || []).filter((c) => c.result === "Pass").length
                      const failCount = (result.checklist || []).filter((c) => c.result === "Fail").length
                      return (
                        <TableRow
                          key={result.id}
                          className={cn(
                            "hover:bg-gradient-to-r hover:from-green-50/70 hover:to-green-50/30 dark:hover:from-green-950/30 dark:hover:to-green-950/10 transition-all border-b border-slate-200 dark:border-slate-800 group",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900/50" : "bg-slate-50/80 dark:bg-slate-900/30"
                          )}
                        >
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex-shrink-0">
                                <Hash className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                {result.batchNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Badge className={cn(
                              "font-semibold text-xs px-3 py-1.5 shadow-sm",
                              result.status === "Pass"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : result.status === "Fail"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            )}>
                              {result.status === "Pass" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                              {result.status === "Fail" && <XCircle className="h-3 w-3 mr-1 inline" />}
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {result.inspector}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {new Date(result.date).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50 font-semibold">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Pass: {passCount}
                              </Badge>
                              {failCount > 0 && (
                                <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50 font-semibold">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Fail: {failCount}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-rose-500 dark:text-rose-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate">
                                {result.notes ? result.notes.substring(0, 50) + "..." : "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingResult(result)}
                              className="h-8 text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1.5" />
                              View More
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {qcResults.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-medium">No QC results found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              qcResults.map((result) => {
                const passCount = (result.checklist || []).filter((c) => c.result === "Pass").length
                const failCount = (result.checklist || []).filter((c) => c.result === "Fail").length
                const totalChecks = (result.checklist || []).length
                const passPercentage = totalChecks > 0 ? (passCount / totalChecks) * 100 : 0

                return (
                  <Card
                    key={result.id}
                    className={cn(
                      "border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg hover:shadow-xl transition-all overflow-hidden",
                      result.status === "Pass" && "border-green-200 dark:border-green-900/50",
                      result.status === "Fail" && "border-red-200 dark:border-red-900/50",
                      result.status === "Pending" && "border-amber-200 dark:border-amber-900/50"
                    )}
                  >
                    {/* Card Header */}
                    <CardHeader className={cn(
                      "border-b pb-3",
                      result.status === "Pass" && "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900/50",
                      result.status === "Fail" && "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900/50",
                      result.status === "Pending" && "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-900/50"
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={cn(
                            "p-2 rounded-lg border flex-shrink-0",
                            result.status === "Pass" && "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-900/30",
                            result.status === "Fail" && "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-900/30",
                            result.status === "Pending" && "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-900/30"
                          )}>
                            <Hash className={cn(
                              "h-5 w-5",
                              result.status === "Pass" && "text-green-600 dark:text-green-400",
                              result.status === "Fail" && "text-red-600 dark:text-red-400",
                              result.status === "Pending" && "text-amber-600 dark:text-amber-400"
                            )} />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {result.batchNumber}
                            </CardTitle>
                            <Badge className={cn(
                              "font-semibold text-xs px-2.5 py-1 w-fit",
                              result.status === "Pass"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : result.status === "Fail"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            )}>
                              {result.status === "Pass" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                              {result.status === "Fail" && <XCircle className="h-3 w-3 mr-1 inline" />}
                              {result.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4">
                      {/* Test Results Summary */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                          <BarChart3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Test Results</p>
                        </div>
                        <div className="flex gap-2 mb-3">
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50 font-semibold">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Pass: {passCount}
                          </Badge>
                          {failCount > 0 && (
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50 font-semibold">
                              <XCircle className="h-3 w-3 mr-1" />
                              Fail: {failCount}
                            </Badge>
                          )}
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              passPercentage === 100 ? "bg-green-500" : passPercentage >= 75 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${passPercentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                          {passPercentage.toFixed(0)}% Pass Rate
                        </p>
                      </div>

                      {/* Inspector & Date */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Inspector</p>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {result.inspector}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Date</p>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {new Date(result.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Notes */}
                      {result.notes && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Notes</p>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                            {result.notes}
                          </p>
                        </div>
                      )}

                      {/* View More Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingResult(result)}
                        className="w-full mt-2"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View More Details
                      </Button>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
        </div>
        )}

        {/* View Details Dialog */}
        <Dialog open={!!viewingResult} onOpenChange={(open) => !open && setViewingResult(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                  <ClipboardCheck className="h-4 w-4 text-white" />
                </div>
                QC Results - {viewingResult?.batchNumber}
              </DialogTitle>
              <DialogDescription>
                Detailed quality control test results and checklist
              </DialogDescription>
            </DialogHeader>

            {viewingResult && (
              <div className="space-y-6">
                {/* Status and Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase mb-1">Status</p>
                    <Badge className={cn(
                      "font-semibold text-xs",
                      viewingResult.status === "Pass"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : viewingResult.status === "Fail"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {viewingResult.status === "Pass" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                      {viewingResult.status === "Fail" && <XCircle className="h-3 w-3 mr-1 inline" />}
                      {viewingResult.status}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase mb-1">QC Stage</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 capitalize">
                      {viewingResult.qcStage || "Initial"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase mb-1">Inspector</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {viewingResult.inspector || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase mb-1">Date</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {new Date(viewingResult.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Checklist Items */}
                {viewingResult.checklist && viewingResult.checklist.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-3 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Checklist Items
                    </h3>
                    <div className="space-y-2">
                      {viewingResult.checklist.map((item, idx) => {
                        const isPass = item.result === "Pass"
                        const isFail = item.result === "Fail"
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-4 rounded-lg border",
                              isPass
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                                : isFail
                                ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                                : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "p-1.5 rounded-md mt-0.5",
                                isPass
                                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                                  : isFail
                                  ? "bg-red-100 dark:bg-red-900/40"
                                  : "bg-slate-200 dark:bg-slate-700"
                              )}>
                                {isPass ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                ) : isFail ? (
                                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                  <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={cn(
                                    "text-sm font-semibold",
                                    isPass
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : isFail
                                      ? "text-red-700 dark:text-red-400"
                                      : "text-slate-700 dark:text-slate-300"
                                  )}>
                                    {item.item}
                                  </p>
                                  <Badge className={cn(
                                    "text-xs",
                                    isPass
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : isFail
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  )}>
                                    {item.result}
                                  </Badge>
                                </div>
                                {item.notes && (
                                  <div className="mt-2 p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes:</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.notes}</p>
                                  </div>
                                )}
                                {isFail && !item.notes && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                                    No notes provided for this failure
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Failed Items Summary */}
                {viewingResult.checklist && viewingResult.checklist.filter((item) => item.result === "Fail").length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800">
                    <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Failed Items Summary
                    </h3>
                    <div className="space-y-2">
                      {viewingResult.checklist
                        .filter((item) => item.result === "Fail")
                        .map((item, idx) => (
                          <div key={idx} className="p-3 rounded bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800">
                            <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                              {item.item}
                            </p>
                            {item.notes ? (
                              <p className="text-sm text-red-700 dark:text-red-300">{item.notes}</p>
                            ) : (
                              <p className="text-xs text-red-600 dark:text-red-400 italic">No reason provided</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Overall Notes */}
                {viewingResult.notes && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Overall Notes
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {viewingResult.notes}
                    </p>
                  </div>
                )}

                {/* Summary Stats */}
                {viewingResult.checklist && viewingResult.checklist.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Total</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        {viewingResult.checklist.length}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Passed</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        {viewingResult.checklist.filter((item) => item.result === "Pass").length}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Failed</p>
                      <p className="text-lg font-bold text-red-700 dark:text-red-400">
                        {viewingResult.checklist.filter((item) => item.result === "Fail").length}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
