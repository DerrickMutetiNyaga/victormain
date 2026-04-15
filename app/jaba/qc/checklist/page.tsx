"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckSquare, ClipboardCheck, Package, Hash, Tag, Droplet, Calendar, Clock, User, X, CheckCircle2, Loader2 } from "lucide-react"
import { batches } from "@/lib/jaba-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Initial QC checklist items (after batch creation)
const initialQCChecklistItems = [
  "Taskings check",
  "Color check",
  "Viscosity",
  "Aroma test",
  "pH levels",
  "Alcohol content",
  "Microbial safety",
]

// Final QC checklist items (after packaging)
const finalQCChecklistItems = [
  "Packaging seal test",
  "Label correctness",
  "Final presentation check",
  "Bottle integrity",
  "Cap tightness",
  "Label alignment",
  "Batch number verification",
]

function QCChecklistPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [qcStage, setQcStage] = useState<"initial" | "final">("initial")
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [overallNotes, setOverallNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [batchesList, setBatchesList] = useState<any[]>([])

  // Get batchId and stage from URL params
  useEffect(() => {
    const batchIdParam = searchParams.get("batchId")
    const stageParam = searchParams.get("stage")
    
    if (batchIdParam) {
      setSelectedBatchId(batchIdParam)
    }
    if (stageParam === "initial" || stageParam === "final") {
      setQcStage(stageParam)
    }
  }, [searchParams])

  // Fetch batches from API
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await fetch('/api/jaba/batches')
        const data = await response.json()
        if (response.ok && data.batches) {
          setBatchesList(data.batches)
        }
      } catch (error) {
        console.error('Error fetching batches:', error)
      }
    }
    fetchBatches()
  }, [])

  const selectedBatch = batchesList.find((b) => b._id === selectedBatchId || b.id === selectedBatchId)
  const qcChecklistItems = qcStage === "initial" ? initialQCChecklistItems : finalQCChecklistItems

  const handleChecklistChange = (index: number, checked: boolean) => {
    setChecklistState({ ...checklistState, [index]: checked })
  }

  const handleNoteChange = (index: number, value: string) => {
    setNotes({ ...notes, [index]: value })
  }

  const handleQCPassed = async () => {
    if (!selectedBatch) {
      toast.error("Please select a batch")
      return
    }

    // Check if all items are checked
    const allChecked = qcChecklistItems.every((_, idx) => checklistState[idx] === true)
    if (!allChecked) {
      toast.error("Please complete all checklist items before marking as passed")
      return
    }

    setIsSubmitting(true)
    try {
      // Update batch QC status
      const response = await fetch(`/api/jaba/batches/${selectedBatch._id || selectedBatch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qcStatus: 'Pass',
          qcStage: qcStage,
          qcNotes: overallNotes,
          qcChecklist: qcChecklistItems.map((item, idx) => ({
            item,
            checked: checklistState[idx] || false,
            result: checklistState[idx] ? 'Pass' : 'Pending',
            notes: notes[idx] || "",
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update QC status')
      }

      toast.success(`QC ${qcStage === "initial" ? "Initial" : "Final"} passed successfully!`)

      // Redirect based on stage
      if (qcStage === "initial") {
        // After initial QC passes, go to packaging
        router.push(`/jaba/packaging-output/add?batchId=${selectedBatch._id || selectedBatch.id}`)
      } else {
        // After final QC passes, batch is ready for dispatch
        router.push(`/jaba/batches/${selectedBatch._id || selectedBatch.id}`)
      }
    } catch (error: any) {
      console.error('Error updating QC status:', error)
      toast.error(error.message || 'Failed to update QC status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQCFailed = async () => {
    if (!selectedBatch) {
      toast.error("Please select a batch")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/jaba/batches/${selectedBatch._id || selectedBatch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qcStatus: 'Fail',
          qcStage: qcStage,
          qcNotes: overallNotes,
          qcChecklist: qcChecklistItems.map((item, idx) => ({
            item,
            checked: checklistState[idx] || false,
            result: checklistState[idx] ? 'Fail' : 'Pending',
            notes: notes[idx] || "",
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update QC status')
      }

      toast.error(`QC ${qcStage === "initial" ? "Initial" : "Final"} failed. Batch requires attention.`)
      router.push(`/jaba/batches/${selectedBatch._id || selectedBatch.id}`)
    } catch (error: any) {
      console.error('Error updating QC status:', error)
      toast.error(error.message || 'Failed to update QC status')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            QC Checklist - {qcStage === "initial" ? "Initial QC" : "Final QC"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {qcStage === "initial" 
              ? "Quality control check for taskings, color, and product specifications"
              : "Quality control check for packaging, labels, and final presentation"}
          </p>
        </div>
      </header>

      <div className="p-6 max-w-5xl mx-auto space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
        {/* Batch Selection */}
        <Card className="border-0 bg-white dark:bg-slate-900 shadow-lg">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 pt-6 px-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                <Package className="h-4 w-4 text-white" />
              </div>
              Select Batch
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchSelect" className="text-sm font-medium text-slate-700 dark:text-slate-300">Batch Number *</Label>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger className="h-11 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500">
                  <SelectValue placeholder="Select a batch to perform QC check" />
                </SelectTrigger>
                <SelectContent>
                  {batchesList
                    .filter((b) => {
                      if (qcStage === "initial") {
                        return b.qcStatus === "Pending" || b.qcStatus === "In Progress"
                      } else {
                        // For final QC, show batches that passed initial QC and are ready for packaging QC
                        return b.qcStatus === "Pass" && b.status !== "Completed"
                      }
                    })
                    .map((batch) => (
                      <SelectItem key={batch._id || batch.id} value={batch._id || batch.id}>
                        {batch.batchNumber} - {batch.flavor} ({batch.totalLitres}L)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBatch && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Batch Number</p>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-50">{selectedBatch.batchNumber}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Product</p>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-50">{selectedBatch.flavor}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Litres</p>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-50">{selectedBatch.totalLitres}L</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Production Date</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {selectedBatch.date ? new Date(selectedBatch.date).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Shift</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedBatch.shift}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Supervisor</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedBatch.supervisor}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedBatch && (
          <Card className="border-0 bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 pt-6 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                    <CheckSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      QC Checklist - {selectedBatch.batchNumber}
                    </CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {qcStage === "initial" ? "Initial QC" : "Final QC"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Progress:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {Object.values(checklistState).filter(Boolean).length} / {qcChecklistItems.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {qcChecklistItems.map((item, idx) => (
                <div key={idx} className={cn(
                  "p-4 rounded-lg border transition-all",
                  checklistState[idx]
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2.5 rounded-lg transition-colors border",
                      checklistState[idx]
                        ? "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700"
                        : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                    )}>
                      <Checkbox
                        id={`check-${idx}`}
                        className="h-5 w-5 border-2 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        checked={checklistState[idx] || false}
                        onCheckedChange={(checked) => handleChecklistChange(idx, checked === true)}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`check-${idx}`} className={cn(
                        "text-sm font-semibold cursor-pointer flex items-center gap-2",
                        checklistState[idx] 
                          ? "text-emerald-700 dark:text-emerald-400" 
                          : "text-slate-900 dark:text-slate-50"
                      )}>
                        {checklistState[idx] && <CheckCircle2 className="h-4 w-4" />}
                        {item}
                      </Label>
                      <Textarea
                        placeholder="Add notes for this check..."
                        className={cn(
                          "min-h-[60px] text-sm border",
                          checklistState[idx]
                            ? "border-emerald-200 dark:border-emerald-800 focus:border-emerald-500 dark:focus:border-emerald-500 bg-white dark:bg-slate-900"
                            : "border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-600"
                        )}
                        value={notes[idx] || ""}
                        onChange={(e) => handleNoteChange(idx, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Overall Notes</Label>
                <Textarea
                  placeholder="Additional QC notes and observations..."
                  className="min-h-[100px] text-sm border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500"
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleQCFailed}
                  disabled={isSubmitting}
                  variant="outline"
                  className="flex-1 h-11 text-sm font-semibold border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Mark as Failed
                </Button>
                <Button 
                  onClick={handleQCPassed}
                  disabled={isSubmitting}
                  className="flex-1 h-11 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Mark as Passed
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedBatch && (
          <Card className="border-0 bg-white dark:bg-slate-900 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CheckSquare className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">Please select a batch to begin QC checklist</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose a batch from the dropdown above to start quality control checks</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

export default function QCChecklistPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <QCChecklistPageContent />
    </Suspense>
  )
}
