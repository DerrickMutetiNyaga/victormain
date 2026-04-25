"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type Shift = {
  _id: string
  status: string
  startedAt: string
  cashSales: number
  mpesaSales: number
  totalRevenue: number
  ordersServed: number
}

export function ShiftWidget({ cashierName }: { cashierName: string }) {
  const router = useRouter()
  const [shift, setShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClockInDialog, setShowClockInDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showClosingReminder, setShowClosingReminder] = useState(false)
  const [openingFloat, setOpeningFloat] = useState("")
  const [countedDrawerAmount, setCountedDrawerAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [breakBusy, setBreakBusy] = useState(false)
  const [issueText, setIssueText] = useState("")
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [showPendingDialog, setShowPendingDialog] = useState(false)
  const [reminderSnoozeUntil, setReminderSnoozeUntil] = useState<number>(0)

  const refresh = useCallback(async () => {
    const response = await fetch("/api/catha/shifts/active", { cache: "no-store" })
    const data = await response.json()
    setShift(data.shift ?? null)
    if (data?.shift?.status === "PENDING_CLOSURE") {
      const started = new Date(data.shift.startedAt)
      const today = new Date()
      const yesterdayPending = started.toDateString() !== today.toDateString()
      if (yesterdayPending) setShowPendingDialog(true)
    }
    setLoading(false)
  }, [])

  const queuePending = useCallback((entry: { endpoint: string; body: Record<string, unknown> }) => {
    const raw = localStorage.getItem("catha_shift_pending_queue")
    const list = raw ? (JSON.parse(raw) as Array<{ endpoint: string; body: Record<string, unknown> }>) : []
    list.push(entry)
    localStorage.setItem("catha_shift_pending_queue", JSON.stringify(list))
  }, [])

  const flushPending = useCallback(async () => {
    const raw = localStorage.getItem("catha_shift_pending_queue")
    if (!raw) return
    const list = JSON.parse(raw) as Array<{ endpoint: string; body: Record<string, unknown> }>
    const remaining: typeof list = []
    for (const item of list) {
      try {
        const res = await fetch(item.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        })
        if (!res.ok) remaining.push(item)
      } catch {
        remaining.push(item)
      }
    }
    if (remaining.length) localStorage.setItem("catha_shift_pending_queue", JSON.stringify(remaining))
    else localStorage.removeItem("catha_shift_pending_queue")
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    flushPending().catch(() => {})
    const onOnline = () => flushPending().catch(() => {})
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [flushPending])

  useEffect(() => {
    if (!loading && !shift) {
      setShowClockInDialog(true)
      const timer = setTimeout(() => {
        toast.message("Shift reminder", { description: "You can start your shift anytime from the shift widget." })
      }, 5 * 60 * 1000)
      return () => clearTimeout(timer)
    }
  }, [loading, shift])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      if (Date.now() < reminderSnoozeUntil) return
      if (now.getHours() === 23 && now.getMinutes() === 0) setShowClosingReminder(true)
    }, 60_000)
    return () => clearInterval(timer)
  }, [reminderSnoozeUntil])

  const onClockIn = async () => {
    const response = await fetch("/api/catha/shifts/clock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openingFloat: Number(openingFloat || 0),
        notes,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      queuePending({ endpoint: "/api/catha/shifts/clock-in", body: { openingFloat: Number(openingFloat || 0), notes } })
      toast.error(data.error || "Failed to start shift")
      return
    }
    setShift(data.shift)
    setShowClockInDialog(false)
    toast.success("Shift started")
  }

  const onCloseShift = async () => {
    const response = await fetch("/api/catha/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countedDrawerAmount: Number(countedDrawerAmount || 0),
        notes,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      queuePending({ endpoint: "/api/catha/shifts/close", body: { countedDrawerAmount: Number(countedDrawerAmount || 0), notes } })
      toast.error(data.error || "Failed to close shift")
      return
    }
    setShift(null)
    setShowCloseDialog(false)
    setCountedDrawerAmount("")
    setNotes("")
    toast.success("Shift closed")
  }

  const onBreakStart = async (breakType: "TEA" | "LUNCH" | "EMERGENCY") => {
    setBreakBusy(true)
    try {
      const response = await fetch("/api/catha/shifts/break/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakType }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to start break")
      toast.success(`${breakType} break started`)
    } catch (error: any) {
      toast.error(error?.message || "Failed to start break")
    } finally {
      setBreakBusy(false)
    }
  }

  const onBreakEnd = async () => {
    setBreakBusy(true)
    try {
      const response = await fetch("/api/catha/shifts/break/end", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to resume shift")
      toast.success("Shift resumed from break")
      refresh().catch(() => {})
    } catch (error: any) {
      toast.error(error?.message || "Failed to resume shift")
    } finally {
      setBreakBusy(false)
    }
  }

  const onSaveDraft = () => {
    localStorage.setItem(
      "catha_shift_close_draft",
      JSON.stringify({ countedDrawerAmount: Number(countedDrawerAmount || 0), notes, at: new Date().toISOString() })
    )
    toast.success("Shift close draft saved")
  }

  const onReportIssue = async () => {
    const response = await fetch("/api/catha/shifts/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue: issueText }),
    })
    const data = await response.json()
    if (!response.ok) {
      toast.error(data.error || "Failed to report issue")
      return
    }
    setIssueText("")
    setShowIssueDialog(false)
    toast.success("Issue reported")
  }

  const onClosePreviousShift = async () => {
    if (!shift?._id) return
    const response = await fetch("/api/catha/shifts/pending/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift._id, countedDrawerAmount: 0, notes: "Resolved from next login prompt" }),
    })
    const data = await response.json()
    if (!response.ok) {
      toast.error(data.error || "Failed to close previous shift")
      return
    }
    setShowPendingDialog(false)
    setShift(null)
    toast.success("Previous shift closed")
  }

  const badge = useMemo(() => {
    if (!shift) return "bg-slate-100 text-slate-700"
    if (shift.status === "ACTIVE") return "bg-emerald-100 text-emerald-700"
    if (shift.status === "PENDING_CLOSURE") return "bg-amber-100 text-amber-700"
    return "bg-slate-100 text-slate-700"
  }, [shift])

  return (
    <>
      <button
        type="button"
        onClick={() => (shift ? setShowCloseDialog(true) : setShowClockInDialog(true))}
        className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs shadow-sm transition-colors hover:bg-muted/50 ${badge}`}
      >
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          <span className="font-semibold">{shift ? `Shift ${shift.status}` : "Start Shift"}</span>
        </div>
        <div className="mt-1">{cashierName}</div>
        {shift ? (
          <div className="mt-1 text-[11px]">
            Sales KES {Math.round(shift.totalRevenue).toLocaleString()} | Orders {shift.ordersServed}
          </div>
        ) : null}
      </button>
      {shift && (
        <div className="ml-1 hidden items-center gap-1 md:flex">
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={breakBusy} onClick={() => onBreakStart("TEA")}>
            Tea Break
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={breakBusy} onClick={onBreakEnd}>
            Resume
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowIssueDialog(true)}>
            Report Issue
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push("/catha/shift-history")}>
            View Shift Summary
          </Button>
        </div>
      )}

      <Dialog open={showClockInDialog} onOpenChange={setShowClockInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Shift?</DialogTitle>
            <DialogDescription>Clock in now and optionally record opening float.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Opening Float (optional)</Label>
              <Input value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Busy night" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClockInDialog(false)}>Cancel</Button>
              <Button onClick={onClockIn}>Clock In Now</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Shift Summary</DialogTitle>
            <DialogDescription>Review and confirm shift close.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Cash {shift?.cashSales?.toLocaleString() ?? 0} | M-Pesa {shift?.mpesaSales?.toLocaleString() ?? 0}
            </div>
            <div>
              <Label>Counted Drawer Amount</Label>
              <Input value={countedDrawerAmount} onChange={(e) => setCountedDrawerAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shift note" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
              <Button variant="outline" onClick={onSaveDraft}>Save Draft</Button>
              <Button onClick={onCloseShift}>Confirm Close Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClosingReminder} onOpenChange={setShowClosingReminder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Business Closing Time Reached</DialogTitle>
            <DialogDescription>Would you like to close your shift?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowClosingReminder(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setReminderSnoozeUntil(Date.now() + 30 * 60 * 1000); setShowClosingReminder(false) }}>Extend Shift 30 mins</Button>
            <Button variant="outline" onClick={() => { setReminderSnoozeUntil(Date.now() + 10 * 60 * 1000); setShowClosingReminder(false) }}>Remind Later</Button>
            <Button onClick={() => { setShowClosingReminder(false); setShowCloseDialog(true) }}>Close Shift Now</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Shift Issue</DialogTitle>
            <DialogDescription>Describe any POS, cash, or handover issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={issueText} onChange={(e) => setIssueText(e.target.value)} placeholder="POS issue..." />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIssueDialog(false)}>Cancel</Button>
              <Button onClick={onReportIssue}>Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You had an open shift yesterday</DialogTitle>
            <DialogDescription>Choose how you want to proceed.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPendingDialog(false)}>Resume Shift</Button>
            <Button variant="outline" onClick={() => setShowIssueDialog(true)}>Ask Manager</Button>
            <Button onClick={onClosePreviousShift}>Close Previous Shift</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
