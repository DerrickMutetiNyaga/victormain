"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, CheckCircle2, Smartphone, Banknote, ChevronRight, XCircle, AlertCircle } from "lucide-react"

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  phone?: string
  onSuccess: (method: "mpesa" | "cash", mpesaReceiptNumber?: string) => void
  /** Skip the choose screen and go straight to M-Pesa */
  skipToMpesa?: boolean
  /** Hide cash option entirely — for orders already at the bar */
  mpesaOnly?: boolean
}

type Step = "choose" | "mpesa" | "processing" | "success" | "cash" | "error"

export function PaymentModal({
  open,
  onOpenChange,
  amount,
  phone = "",
  onSuccess,
  skipToMpesa = false,
  mpesaOnly = false,
}: PaymentModalProps) {
  const [step, setStep] = useState<Step>("choose")
  const [phoneNumber, setPhoneNumber] = useState(phone)
  const [errorMsg, setErrorMsg] = useState("")
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef(0)

  // Sync phone when prop changes
  useEffect(() => {
    if (phone) setPhoneNumber(phone)
  }, [phone])

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(skipToMpesa ? "mpesa" : "choose")
      setErrorMsg("")
      setCheckoutRequestId(null)
      pollCountRef.current = 0
    } else {
      stopPolling()
    }
  }, [open, skipToMpesa])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const handleClose = () => {
    if (step === "processing" || step === "success") return
    stopPolling()
    setStep("choose")
    onOpenChange(false)
  }

  const handleMpesaSTK = async () => {
    if (!phoneNumber.trim()) return
    setErrorMsg("")
    setStep("processing")

    try {
      const ref = `MENU${Date.now().toString().slice(-8)}`
      const res = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          amount,
          accountReference: ref,
          transactionDesc: `Table order ${ref}`,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setErrorMsg(data.error || "Failed to initiate M-Pesa payment. Please try again.")
        setStep("error")
        return
      }

      const cid = data.data?.checkoutRequestID
      setCheckoutRequestId(cid || null)
      pollCountRef.current = 0

      // Poll every 4 s for up to ~2 min (30 attempts)
      pollRef.current = setInterval(async () => {
        pollCountRef.current += 1
        if (pollCountRef.current > 30) {
          stopPolling()
          setErrorMsg("Payment confirmation timed out. Please try again or pay in cash.")
          setStep("error")
          return
        }

        try {
          const search = cid || ref
          const txRes = await fetch(`/api/mpesa/transactions?search=${encodeURIComponent(search)}`)
          const txData = await txRes.json()
          const tx = Array.isArray(txData.transactions) ? txData.transactions[0] : null

          if (tx?.status === "COMPLETED" || tx?.result_code === "0") {
            stopPolling()
            const receipt: string | undefined =
              tx.mpesaReceiptNumber || tx.mpesa_receipt_number || tx.MpesaReceiptNumber || undefined
            setStep("success")
            setTimeout(() => {
              onSuccess("mpesa", receipt)
              setStep("choose")
              onOpenChange(false)
            }, 1800)
          } else if (tx?.status === "CANCELLED" || tx?.result_code === "1032") {
            stopPolling()
            setErrorMsg("Payment was cancelled. Please try again.")
            setStep("error")
          } else if (tx?.status === "FAILED") {
            stopPolling()
            setErrorMsg(tx.result_desc || "Payment failed. Please try again.")
            setStep("error")
          }
        } catch {
          // polling error — keep trying
        }
      }, 4000)
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again.")
      setStep("error")
    }
  }

  const handleCashConfirm = () => {
    onSuccess("cash")
    setStep("choose")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm rounded-3xl border border-white/[0.08] bg-[#13131E] shadow-2xl shadow-black/60 p-0 overflow-hidden">
        {/* Accent bar */}
        <div
          className={`h-1 w-full transition-all duration-300 ${
            step === "cash"
              ? "bg-gradient-to-r from-amber-500 to-orange-400"
              : step === "success"
              ? "bg-gradient-to-r from-emerald-500 to-green-400"
              : step === "error"
              ? "bg-gradient-to-r from-red-500 to-rose-400"
              : "bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"
          }`}
        />

        <div className="p-6">
          {/* ── STEP: CHOOSE ── */}
          {step === "choose" && (
            <>
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl font-bold text-white text-left">
                  How would you like to pay?
                </DialogTitle>
                <DialogDescription className="text-white/45 text-sm text-left mt-1" asChild>
                  <div>
                    <div className="flex justify-between text-white/40 text-xs mt-1">
                      <span>Amount</span>
                      <span>KES {amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-sm mt-1.5 pt-1.5 border-t border-white/[0.08]">
                      <span>Total</span>
                      <span>KES {amount.toLocaleString()}</span>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("mpesa")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-[0.98] group"
                >
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-white text-[15px]">M-Pesa</p>
                    <p className="text-white/45 text-xs mt-0.5">Pay via STK push — instant</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors" />
                </button>

                {!mpesaOnly && (
                  <button
                    onClick={() => setStep("cash")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all active:scale-[0.98] group"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Banknote className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-white text-[15px]">Cash</p>
                      <p className="text-white/45 text-xs mt-0.5">Pay in cash at the bar</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── STEP: MPESA DETAILS ── */}
          {step === "mpesa" && (
            <>
              <DialogHeader className="mb-5">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-emerald-400" />
                </div>
                <DialogTitle className="text-xl font-bold text-white text-left">
                  M-Pesa Payment
                </DialogTitle>
                <DialogDescription className="text-white/45 text-sm text-left mt-1">
                  We'll send an STK push to your phone
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.07]">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Amount Due</p>
                  <p className="text-3xl font-extrabold text-white">
                    KES {amount.toLocaleString()}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-white/35 text-xs">Total: KES {amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 block">
                    M-Pesa Number
                  </label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XX XXX XXX"
                    type="tel"
                    className="w-full h-12 px-4 rounded-xl bg-white/[0.07] border border-white/[0.10] text-white placeholder:text-white/25 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                  />
                </div>

                <button
                  onClick={handleMpesaSTK}
                  disabled={!phoneNumber || phoneNumber.length < 9}
                  className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-gradient-to-r from-emerald-500 to-green-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Smartphone className="h-4 w-4" strokeWidth={2.5} />
                  Send STK Push
                </button>

                {!mpesaOnly && (
                  <button
                    onClick={() => setStep("choose")}
                    className="w-full h-10 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 transition-colors"
                  >
                    ← Back
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── STEP: CASH CONFIRM ── */}
          {step === "cash" && (
            <>
              <DialogHeader className="mb-5">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
                  <Banknote className="h-6 w-6 text-amber-400" />
                </div>
                <DialogTitle className="text-xl font-bold text-white text-left">
                  Pay with Cash
                </DialogTitle>
                <DialogDescription className="text-white/45 text-sm text-left mt-1">
                  Your order will be sent to the bar. Please have your cash ready when it arrives.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.07]">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Amount to Pay</p>
                  <p className="text-3xl font-extrabold text-white">
                    KES {amount.toLocaleString()}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-white/35 text-xs">Total: KES {amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-amber-400/80 text-xs mt-2 font-medium">Cash payment at the bar</p>
                </div>

                <button
                  onClick={handleCashConfirm}
                  className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-gradient-to-r from-amber-500 to-amber-400 text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Banknote className="h-4 w-4" strokeWidth={2.5} />
                  Send Order to Bar
                </button>

                <button
                  onClick={() => setStep("choose")}
                  className="w-full h-10 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 transition-colors"
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {/* ── STEP: PROCESSING ── */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Waiting for payment…</p>
                <p className="text-white/45 text-sm mt-1">Check your phone for the STK push</p>
              </div>
              <button
                onClick={() => {
                  stopPolling()
                  setStep("mpesa")
                }}
                className="text-white/35 text-xs hover:text-white/60 transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">Payment Successful!</p>
                <p className="text-white/45 text-sm mt-1">Your order is being sent to the bar</p>
              </div>
            </div>
          )}

          {/* ── STEP: ERROR ── */}
          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-9 w-9 text-red-400" />
              </div>
              <div className="text-center px-2">
                <p className="text-white font-bold text-base">Payment Failed</p>
                <p className="text-white/45 text-sm mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setErrorMsg(""); setStep("mpesa") }}
                className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => setStep("cash")}
                className="w-full py-3 rounded-xl font-bold text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-all"
              >
                Pay with Cash Instead
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
