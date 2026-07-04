"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Clock } from "lucide-react"

type Preview = {
  verificationId: string
  transactionCode: string
  orderId: string
  amount: number
  enteredBy: string
  notes: string | null
  expiresAt: string
  expired: boolean
  used: boolean
}

export default function ApproveMpesaTokenPage() {
  const params = useParams()
  const token = String(params?.token || "")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [done, setDone] = useState<"approve" | "reject" | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/catha/orders/manual-mpesa/approve-token/${encodeURIComponent(token)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Invalid link")
      setPreview(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (action: "approve" | "reject") => {
    setActing(true)
    try {
      const res = await fetch(
        `/api/catha/orders/manual-mpesa/approve-token/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: rejectReason.trim() || undefined }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Action failed")
      setDone(action)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setActing(false)
    }
  }

  const disabled = !preview || preview.expired || preview.used || acting || !!done

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-green-200/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-green-700" />
          </div>
          <CardTitle className="text-xl">Manual M-Pesa Approval</CardTitle>
          <CardDescription>Catha Lounge · one-time secure link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!loading && error && !preview && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 text-center">
              {error}
            </div>
          )}

          {preview && (
            <>
              {(preview.expired || preview.used) && !done && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  {preview.used
                    ? "This link has already been used."
                    : "This approval link has expired. Ask staff to resubmit or approve from Catha."}
                </div>
              )}

              {done === "approve" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                  <p className="font-semibold text-emerald-900">Payment approved</p>
                  <p className="text-xs text-emerald-800">
                    {preview.transactionCode} linked to {preview.orderId}
                  </p>
                </div>
              )}

              {done === "reject" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center space-y-1">
                  <XCircle className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="font-semibold">Entry rejected</p>
                  <p className="text-xs text-muted-foreground">No payment was linked.</p>
                </div>
              )}

              {!done && (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm rounded-lg bg-muted/40 p-3">
                    <span className="text-muted-foreground">Transaction</span>
                    <span className="font-mono font-semibold text-right">{preview.transactionCode}</span>
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-mono font-medium text-right">{preview.orderId}</span>
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-semibold text-right">
                      KES {Number(preview.amount || 0).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">Entered by</span>
                    <span className="text-right">{preview.enteredBy}</span>
                  </div>
                  {preview.notes && (
                    <div className="text-xs rounded-md border bg-white p-2.5">
                      <p className="text-muted-foreground font-medium">Reason</p>
                      <p className="mt-0.5">{preview.notes}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reject-reason-token">Reject reason (optional)</Label>
                    <Textarea
                      id="reject-reason-token"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Only needed if rejecting"
                      className="min-h-[64px] text-sm"
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={disabled}
                      onClick={() => void submit("approve")}
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & link payment"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      disabled={disabled}
                      onClick={() => void submit("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {error && preview && !done && (
            <p className="text-xs text-red-600 text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
