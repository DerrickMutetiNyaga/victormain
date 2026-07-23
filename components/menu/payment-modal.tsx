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
      <DialogContent className="sm:max-w-sm rounded-[1.15rem] border border-[rgba(185,138,68,0.22)] bg-[#14100c] shadow-2xl shadow-black/60 p-0 overflow-hidden">
        <div
          className={`h-px w-full transition-all duration-700 ${
            step === "cash"
              ? "bg-gradient-to-r from-transparent via-[#c8722a] to-transparent"
              : step === "success"
              ? "bg-gradient-to-r from-transparent via-[#b98a44] to-transparent"
              : step === "error"
              ? "bg-gradient-to-r from-transparent via-[#5e1f1f] to-transparent"
              : "bg-gradient-to-r from-transparent via-[#b98a44] to-transparent"
          }`}
        />

        <div className="p-6">
          {step === "choose" && (
            <>
              <DialogHeader className="mb-6">
                <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#b98a44] mb-2 text-left">
                  Payment
                </p>
                <DialogTitle className="text-xl font-semibold text-[#f2e8d8] text-left font-[family-name:var(--menu-font-display)]">
                  How would you like to pay?
                </DialogTitle>
                <DialogDescription className="text-[rgba(242,232,216,0.45)] text-sm text-left mt-1" asChild>
                  <div>
                    <div className="flex justify-between text-[rgba(242,232,216,0.4)] text-xs mt-1">
                      <span>Amount</span>
                      <span className="tabular-nums">KES {(Number(amount) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[#f2e8d8] font-bold text-sm mt-1.5 pt-1.5 border-t border-[rgba(185,138,68,0.14)]">
                      <span>Total</span>
                      <span className="tabular-nums">KES {(Number(amount) || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("mpesa")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[rgba(185,138,68,0.1)] border border-[rgba(185,138,68,0.28)] hover:bg-[rgba(185,138,68,0.16)] hover:border-[rgba(185,138,68,0.4)] transition-all duration-500 active:scale-[0.98] group"
                >
                  <div className="h-12 w-12 rounded-2xl bg-[rgba(185,138,68,0.18)] flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-[#b98a44]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-[#f2e8d8] text-[15px]">M-Pesa</p>
                    <p className="text-[rgba(242,232,216,0.45)] text-xs mt-0.5">Pay via STK push — instant</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[rgba(242,232,216,0.25)] group-hover:text-[rgba(242,232,216,0.6)] transition-colors duration-500" />
                </button>

                {!mpesaOnly && (
                  <button
                    onClick={() => setStep("cash")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[rgba(200,114,42,0.1)] border border-[rgba(200,114,42,0.28)] hover:bg-[rgba(200,114,42,0.16)] hover:border-[rgba(200,114,42,0.4)] transition-all duration-500 active:scale-[0.98] group"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-[rgba(200,114,42,0.18)] flex items-center justify-center flex-shrink-0">
                      <Banknote className="h-6 w-6 text-[#e08a3c]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-[#f2e8d8] text-[15px]">Cash</p>
                      <p className="text-[rgba(242,232,216,0.45)] text-xs mt-0.5">Pay in cash at the bar</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[rgba(242,232,216,0.25)] group-hover:text-[rgba(242,232,216,0.6)] transition-colors duration-500" />
                  </button>
                )}
              </div>
            </>
          )}

          {step === "mpesa" && (
            <>
              <DialogHeader className="mb-5">
                <div className="h-12 w-12 rounded-2xl bg-[rgba(185,138,68,0.14)] border border-[rgba(185,138,68,0.28)] flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-[#b98a44]" />
                </div>
                <DialogTitle className="text-xl font-semibold text-[#f2e8d8] text-left font-[family-name:var(--menu-font-display)]">
                  M-Pesa Payment
                </DialogTitle>
                <DialogDescription className="text-[rgba(242,232,216,0.45)] text-sm text-left mt-1">
                  We'll send an STK push to your phone
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[rgba(28,20,16,0.7)] border border-[rgba(185,138,68,0.14)]">
                  <p className="text-[rgba(242,232,216,0.4)] text-[10px] font-semibold uppercase tracking-[0.16em] mb-1">Amount Due</p>
                  <p className="text-3xl font-extrabold text-[#c8722a] tabular-nums">
                    KES {(Number(amount) || 0).toLocaleString()}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[rgba(242,232,216,0.35)] text-xs tabular-nums">Total: KES {(Number(amount) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[rgba(242,232,216,0.5)] text-[10px] font-semibold uppercase tracking-[0.16em] mb-2 block">
                    M-Pesa Number
                  </label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XX XXX XXX"
                    type="tel"
                    className="w-full h-12 px-4 rounded-xl bg-[#0e0c0a] border border-[rgba(185,138,68,0.22)] text-[#f2e8d8] placeholder:text-[rgba(242,232,216,0.25)] text-base focus:outline-none focus:ring-2 focus:ring-[rgba(200,114,42,0.12)] focus:border-[rgba(200,114,42,0.55)] transition-all duration-500"
                  />
                </div>

                <button
                  onClick={handleMpesaSTK}
                  disabled={!phoneNumber || phoneNumber.length < 9}
                  className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-gradient-to-r from-[#c8722a] to-[#b98a44] text-[#0e0c0a] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-500 active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(200,114,42,0.28)]"
                >
                  <Smartphone className="h-4 w-4" strokeWidth={2.5} />
                  Send STK Push
                </button>

                {!mpesaOnly && (
                  <button
                    onClick={() => setStep("choose")}
                    className="w-full h-10 rounded-xl text-sm font-medium text-[rgba(242,232,216,0.4)] hover:text-[rgba(242,232,216,0.6)] transition-colors duration-500"
                  >
                    ← Back
                  </button>
                )}
              </div>
            </>
          )}

          {step === "cash" && (
            <>
              <DialogHeader className="mb-5">
                <div className="h-12 w-12 rounded-2xl bg-[rgba(200,114,42,0.14)] border border-[rgba(200,114,42,0.28)] flex items-center justify-center mb-4">
                  <Banknote className="h-6 w-6 text-[#e08a3c]" />
                </div>
                <DialogTitle className="text-xl font-semibold text-[#f2e8d8] text-left font-[family-name:var(--menu-font-display)]">
                  Pay with Cash
                </DialogTitle>
                <DialogDescription className="text-[rgba(242,232,216,0.45)] text-sm text-left mt-1">
                  Your order will be sent to the bar. Please have your cash ready when it arrives.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[rgba(28,20,16,0.7)] border border-[rgba(185,138,68,0.14)]">
                  <p className="text-[rgba(242,232,216,0.4)] text-[10px] font-semibold uppercase tracking-[0.16em] mb-1">Amount to Pay</p>
                  <p className="text-3xl font-extrabold text-[#c8722a] tabular-nums">
                    KES {(Number(amount) || 0).toLocaleString()}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[rgba(242,232,216,0.35)] text-xs tabular-nums">Total: KES {(Number(amount) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[rgba(200,114,42,0.8)] text-xs mt-2 font-medium">Cash payment at the bar</p>
                </div>

                <button
                  onClick={handleCashConfirm}
                  className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-gradient-to-r from-[#c8722a] to-[#b98a44] text-[#0e0c0a] transition-all duration-500 active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(200,114,42,0.28)]"
                >
                  <Banknote className="h-4 w-4" strokeWidth={2.5} />
                  Send Order to Bar
                </button>

                <button
                  onClick={() => setStep("choose")}
                  className="w-full h-10 rounded-xl text-sm font-medium text-[rgba(242,232,216,0.4)] hover:text-[rgba(242,232,216,0.6)] transition-colors duration-500"
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-16 w-16 rounded-full bg-[rgba(200,114,42,0.1)] border border-[rgba(185,138,68,0.22)] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#c8722a]" />
              </div>
              <div className="text-center">
                <p className="text-[#f2e8d8] font-semibold">Waiting for payment…</p>
                <p className="text-[rgba(242,232,216,0.45)] text-sm mt-1">Check your phone for the STK push</p>
              </div>
              <button
                onClick={() => {
                  stopPolling()
                  setStep("mpesa")
                }}
                className="text-[rgba(242,232,216,0.35)] text-xs hover:text-[rgba(242,232,216,0.6)] transition-colors duration-500 mt-2"
              >
                Cancel
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-16 w-16 rounded-full bg-[rgba(185,138,68,0.14)] border border-[rgba(185,138,68,0.28)] flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-[#b98a44]" />
              </div>
              <div className="text-center">
                <p className="text-[#f2e8d8] font-bold text-lg">Payment Successful!</p>
                <p className="text-[rgba(242,232,216,0.45)] text-sm mt-1">Your order is being sent to the bar</p>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-[rgba(94,31,31,0.2)] border border-[rgba(94,31,31,0.4)] flex items-center justify-center">
                <AlertCircle className="h-9 w-9 text-[#c07070]" />
              </div>
              <div className="text-center px-2">
                <p className="text-[#f2e8d8] font-bold text-base">Payment Failed</p>
                <p className="text-[rgba(242,232,216,0.45)] text-sm mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setErrorMsg(""); setStep("mpesa") }}
                className="w-full py-3 rounded-xl font-bold text-sm bg-[rgba(185,138,68,0.12)] border border-[rgba(185,138,68,0.28)] text-[#b98a44] hover:bg-[rgba(185,138,68,0.18)] transition-all duration-500"
              >
                Try Again
              </button>
              <button
                onClick={() => setStep("cash")}
                className="w-full py-3 rounded-xl font-bold text-sm bg-[rgba(200,114,42,0.1)] border border-[rgba(200,114,42,0.22)] text-[#e08a3c] hover:bg-[rgba(200,114,42,0.15)] transition-all duration-500"
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
