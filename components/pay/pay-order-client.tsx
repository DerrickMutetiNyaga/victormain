"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Loader2,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Wine,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Printer as PrinterIcon,
} from "lucide-react"
import { formatKsh, RECEIPT_DISPLAY_TILL_NUMBER } from "@/lib/receipt-utils"
import { normalizeKenyaPhone, getPhoneValidationError } from "@/lib/phone-utils"
import { toast } from "sonner"
import type { MpesaStatus } from "@/lib/mpesa-status"

type PayOrderData = {
  orderId: string
  businessName: string
  tillNumber: string | null
  payUrl: string
  isPaid: boolean
  paymentStatus: string
  amountDue: number
  orderTotal: number
  totalPaid: number
  mpesaReceiptNumber?: string | null
  itemCount: number
  items: Array<{ name: string; quantity: number; price: number }>
  stkStatus?: MpesaStatus | null
  stkMessage?: string | null
  checkoutRequestId?: string | null
}

type PaymentUiState = "idle" | "awaiting_pin" | "paid" | "cancelled" | "failed" | "timeout"

const POLL_CAP_MS = 180_000
const FAST_PHASE_MS = 30_000
const FAST_INTERVAL = 2000
const SLOW_INTERVAL = 5000

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0c0a09] text-stone-100 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-700/10 blur-[100px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-8 sm:pt-12">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10">
            <Wine className="h-5 w-5 text-amber-300" />
          </div>
          <p className="font-serif text-2xl tracking-[0.3em] text-amber-100 uppercase">
            Catha Lounge
          </p>
          <div className="mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-stone-400">
            Infusion Jaba
          </p>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500/70" />
          Secured by M-Pesa · infusionjaba.co.ke
        </footer>
      </div>
    </div>
  )
}

export function PayOrderClient({ orderId }: { orderId: string }) {
  const [data, setData] = useState<PayOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [phone, setPhone] = useState("")
  const [paying, setPaying] = useState(false)
  const [paymentState, setPaymentState] = useState<PaymentUiState>("idle")
  const [paymentMessage, setPaymentMessage] = useState("")
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef(0)
  const checkoutIdRef = useRef<string | null>(null)
  const stoppedRef = useRef(false)

  const stopPolling = useCallback(() => {
    stoppedRef.current = true
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const fetchPayStatus = useCallback(
    async (checkoutId?: string | null) => {
      const qs = checkoutId ? `?checkoutRequestId=${encodeURIComponent(checkoutId)}` : ""
      const res = await fetch(`/api/public/pay/${encodeURIComponent(orderId)}${qs}`, {
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Order not found")
      return json as PayOrderData
    },
    [orderId]
  )

  const handlePaymentOutcome = useCallback(
    (json: PayOrderData) => {
      setData(json)

      if (json.isPaid) {
        stopPolling()
        setPaymentState("paid")
        setPaymentMessage("")
        return true
      }

      const stk = json.stkStatus
      if (stk === "COMPLETED") {
        return false
      }

      if (stk === "CANCELLED") {
        stopPolling()
        setPaymentState("cancelled")
        setPaymentMessage(
          json.stkMessage || "Payment was cancelled on your phone. No money was deducted."
        )
        return true
      }

      if (stk === "FAILED") {
        stopPolling()
        setPaymentState("failed")
        setPaymentMessage(
          json.stkMessage || "Payment failed. Check your M-Pesa balance and try again."
        )
        return true
      }

      return false
    },
    [stopPolling]
  )

  const startPolling = useCallback(
    (checkoutId: string) => {
      stopPolling()
      stoppedRef.current = false
      checkoutIdRef.current = checkoutId
      pollStartRef.current = Date.now()

      const poll = async () => {
        if (stoppedRef.current) return
        try {
          const json = await fetchPayStatus(checkoutIdRef.current)
          const terminal = handlePaymentOutcome(json)
          if (terminal || stoppedRef.current) return

          const elapsed = Date.now() - pollStartRef.current
          if (elapsed >= POLL_CAP_MS) {
            stopPolling()
            setPaymentState("timeout")
            setPaymentMessage(
              "We did not receive confirmation in time. If you entered your PIN, wait a moment and refresh — otherwise try again."
            )
            return
          }

          const delay = elapsed < FAST_PHASE_MS ? FAST_INTERVAL : SLOW_INTERVAL
          pollTimeoutRef.current = setTimeout(poll, delay)
        } catch {
          if (stoppedRef.current) return
          const elapsed = Date.now() - pollStartRef.current
          if (elapsed >= POLL_CAP_MS) {
            stopPolling()
            setPaymentState("timeout")
            setPaymentMessage(
              "We did not receive confirmation in time. If you entered your PIN, wait a moment and refresh — otherwise try again."
            )
            return
          }
          const delay = elapsed < FAST_PHASE_MS ? FAST_INTERVAL : SLOW_INTERVAL
          pollTimeoutRef.current = setTimeout(poll, delay)
        }
      }

      poll()
    },
    [fetchPayStatus, handlePaymentOutcome, stopPolling]
  )

  const load = useCallback(async () => {
    try {
      const json = await fetchPayStatus()
      setData(json)
      if (json.isPaid) setPaymentState("paid")
      setError("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load order")
    } finally {
      setLoading(false)
    }
  }, [fetchPayStatus])

  useEffect(() => {
    load()
    return () => stopPolling()
  }, [load, stopPolling])

  // If the tab was left open (e.g. customer paid earlier, comes back later),
  // re-check the order when the page regains focus so it flips to "paid".
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return
      fetchPayStatus()
        .then((json) => {
          setData(json)
          if (json.isPaid) setPaymentState("paid")
        })
        .catch(() => {})
    }
    document.addEventListener("visibilitychange", refreshIfVisible)
    window.addEventListener("focus", refreshIfVisible)
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible)
      window.removeEventListener("focus", refreshIfVisible)
    }
  }, [fetchPayStatus])

  const resetPaymentAttempt = () => {
    stopPolling()
    setPaymentState("idle")
    setPaymentMessage("")
    setCheckoutRequestId(null)
    checkoutIdRef.current = null
  }

  /** Prints an 80mm black & white customer copy via a hidden iframe. */
  const printCustomerReceipt = () => {
    if (!data) return
    const escapeHtml = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    const mono = "font-family:'Courier New',Courier,monospace;"
    const rowStyle = `display:flex;justify-content:space-between;gap:6px;${mono}font-size:11px;font-weight:700;line-height:1.5;`
    const itemsHtml = data.items
      .map(
        (item) => `
          <div style="margin:5px 0;">
            <div style="${mono}font-size:12px;font-weight:900;">${escapeHtml(item.name)}</div>
            <div style="${rowStyle}">
              <span>&nbsp;&nbsp;${item.quantity} x ${formatKsh(item.price)}</span>
              <span>${formatKsh(item.price * item.quantity)}</span>
            </div>
          </div>`
      )
      .join("")
    const moreItems =
      data.itemCount > data.items.length
        ? `<div style="${mono}font-size:10px;font-weight:700;">+${data.itemCount - data.items.length} more items</div>`
        : ""

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${escapeHtml(data.orderId)}</title>
          <meta charset="UTF-8">
          <style>
            @page { size: 80mm auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 80mm;
              padding: 3mm 3mm 6mm;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          <div style="${mono}color:#000;font-weight:700;">
            <div style="text-align:center;">
              <div style="${mono}font-size:20px;font-weight:900;letter-spacing:1px;">catha lounge</div>
              <div style="${mono}font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Restaurant &amp; Bar</div>
            </div>
            <div style="border-top:2px solid #000;margin:6px 0;"></div>
            <div style="text-align:center;">
              <div style="${mono}font-size:9px;font-weight:700;letter-spacing:3px;">ORDER ID</div>
              <div style="${mono}font-size:17px;font-weight:900;word-break:break-all;margin-top:1px;">#${escapeHtml(data.orderId)}</div>
              <div style="${mono}font-size:11px;font-weight:900;letter-spacing:2px;margin-top:3px;">*** PAID ***</div>
              ${
                data.mpesaReceiptNumber
                  ? `<div style="${mono}font-size:10px;font-weight:700;margin-top:3px;">M-Pesa: ${escapeHtml(data.mpesaReceiptNumber)}</div>`
                  : ""
              }
              <div style="${mono}font-size:10px;font-weight:700;margin-top:3px;">${new Date().toLocaleString("en-KE")}</div>
            </div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>
            <div style="${rowStyle}font-size:10px;"><span>ITEM</span><span>AMOUNT</span></div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>
            ${itemsHtml}
            ${moreItems}
            <div style="border-top:2px solid #000;margin:6px 0;"></div>
            <div style="display:flex;justify-content:space-between;${mono}font-size:16px;font-weight:900;">
              <span>TOTAL PAID</span><span>${formatKsh(data.orderTotal || data.totalPaid)}</span>
            </div>
            <div style="margin-top:10px;border:2px solid #000;background:#000;color:#fff;padding:8px 4px;text-align:center;${mono}font-size:15px;font-weight:900;letter-spacing:5px;">
              * PAID *
            </div>
            <div style="border-top:1px dashed #000;margin:10px 0 6px;"></div>
            <div style="text-align:center;">
              <div style="${mono}font-size:12px;font-weight:900;">Thank you for your order!</div>
              <div style="${mono}font-size:9px;font-weight:700;margin-top:6px;">Printed: ${new Date().toLocaleString("en-KE")}</div>
              <div style="${mono}font-size:9px;font-weight:700;margin-top:2px;">Powered by Infusion POS</div>
            </div>
          </div>
        </body>
      </html>
    `

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      return
    }
    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }

  const handlePay = async () => {
    if (!data || data.isPaid || paymentState === "awaiting_pin") return
    const err = getPhoneValidationError(phone)
    if (err) {
      toast.error(err)
      return
    }
    const normalized = normalizeKenyaPhone(phone)
    if (!normalized) return

    setPaying(true)
    setPaymentMessage("")
    try {
      const res = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: normalized,
          amount: data.amountDue,
          accountReference: orderId,
          transactionDesc: `Pay ${orderId}`,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not send M-Pesa prompt")
      }

      const checkoutId = String(json.data?.checkoutRequestID || "")
      if (!checkoutId) throw new Error("Missing checkout reference from M-Pesa")

      setCheckoutRequestId(checkoutId)
      setPaymentState("awaiting_pin")
      startPolling(checkoutId)
    } catch (e: unknown) {
      setPaymentState("failed")
      setPaymentMessage(e instanceof Error ? e.message : "Payment failed")
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6 backdrop-blur">
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-6 w-40 rounded-full bg-stone-800" />
            <div className="mx-auto h-12 w-32 rounded-xl bg-stone-800" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full rounded bg-stone-800" />
              <div className="h-4 w-3/4 rounded bg-stone-800" />
            </div>
            <div className="h-12 w-full rounded-xl bg-stone-800" />
          </div>
          <p className="mt-5 text-center text-xs tracking-widest text-stone-500 uppercase">
            Preparing your bill…
          </p>
        </div>
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-8 text-center backdrop-blur">
          <p className="font-serif text-xl text-stone-100">Order not found</p>
          <p className="mt-2 text-sm text-stone-400">{error || "This link may be invalid or expired."}</p>
          <p className="mt-4 font-mono text-xs text-stone-500 break-all">{orderId}</p>
        </div>
      </Shell>
    )
  }

  if (paymentState === "paid" || data.isPaid) {
    const paidAt = new Date().toLocaleString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    return (
      <Shell>
        <div className="overflow-hidden rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]">
          {/* Gold success banner */}
          <div className="relative bg-gradient-to-b from-stone-900 via-stone-950 to-black px-6 pb-8 pt-9 text-center">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-500/15 blur-[70px]" />
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
              <span className="absolute inset-[-8px] rounded-full border border-amber-400/30" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-400/10 shadow-[0_0_40px_rgba(251,191,36,0.3)]">
                <CheckCircle2 className="h-12 w-12 text-amber-200" />
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/90">Success</p>
            <h1 className="mt-1 font-serif text-[2rem] leading-tight text-amber-50">Payment received</h1>
            <p className="mt-3 font-serif text-4xl tabular-nums text-amber-100">
              {formatKsh(data.orderTotal || data.totalPaid)}
            </p>
            <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>

          {/* Ivory receipt panel */}
          <div className="bg-[#faf7f0] px-6 py-5 text-stone-900">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-stone-500">Order</span>
                <span className="font-mono font-black break-all text-right">#{data.orderId}</span>
              </div>
              {data.mpesaReceiptNumber && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-stone-500">M-Pesa receipt</span>
                  <span className="font-mono font-bold">{data.mpesaReceiptNumber}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-stone-500">Date</span>
                <span className="font-semibold">{paidAt}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-stone-500">Status</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Paid
                </span>
              </div>
            </div>

            {data.items.length > 0 && (
              <>
                <div className="my-4 border-t border-dashed border-stone-300" />
                <div className="max-h-32 space-y-1.5 overflow-y-auto text-sm">
                  {data.items.map((item, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="text-stone-700">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="flex-1 border-b border-dotted border-stone-300" />
                      <span className="font-semibold tabular-nums">{formatKsh(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {data.itemCount > data.items.length && (
                    <p className="text-xs text-stone-500">+{data.itemCount - data.items.length} more items</p>
                  )}
                </div>
              </>
            )}

            <p className="mt-5 text-center text-sm text-stone-600">
              Thank you for choosing <span className="font-serif font-semibold">Catha Lounge</span>. Enjoy your evening.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={printCustomerReceipt}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 text-sm font-bold text-amber-100 transition hover:bg-stone-800 active:scale-[0.99]"
              >
                <PrinterIcon className="h-4 w-4" />
                Print receipt
              </button>
              <a
                href={`/r/${encodeURIComponent(data.orderId)}`}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-stone-900 text-sm font-bold text-stone-900 transition hover:bg-stone-100 active:scale-[0.99]"
              >
                View receipt
              </a>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  const showBillCard = paymentState === "idle" || paymentState === "awaiting_pin"

  return (
    <Shell>
      {showBillCard ? (
        <div className="overflow-hidden rounded-3xl bg-[#faf7f0] text-stone-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-stone-200 bg-white/60 px-5 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Your order</p>
              <p className="font-mono text-lg font-black tracking-tight break-all">#{data.orderId}</p>
            </div>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Bill
            </span>
          </div>

          <div className="px-5 py-4">
            {data.items.length > 0 && (
              <div className="mb-4 max-h-36 space-y-2 overflow-y-auto text-sm">
                {data.items.map((item, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <span className="text-stone-700">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="flex-1 border-b border-dotted border-stone-300" />
                    <span className="font-semibold tabular-nums">{formatKsh(item.price * item.quantity)}</span>
                  </div>
                ))}
                {data.itemCount > data.items.length && (
                  <p className="text-xs text-stone-500">+{data.itemCount - data.items.length} more items</p>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-stone-900 px-4 py-4 text-center text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">Amount due</p>
              <p className="mt-1 font-serif text-[2.6rem] leading-none tabular-nums text-amber-50">
                {formatKsh(data.amountDue)}
              </p>
              {data.totalPaid > 0 && (
                <p className="mt-2 text-[11px] text-stone-400">
                  {formatKsh(data.totalPaid)} paid of {formatKsh(data.orderTotal)}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-dashed border-stone-300 bg-white px-5 py-5">
            {paymentState === "awaiting_pin" ? (
              <div className="text-center">
                <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600">
                    <Smartphone className="h-7 w-7 text-white" />
                  </span>
                </div>
                <p className="text-lg font-bold text-stone-900">Check your phone</p>
                <p className="mt-1 text-sm text-stone-600">
                  Enter your <span className="font-semibold">M-Pesa PIN</span> to complete the payment.
                  This page updates automatically when payment is confirmed or cancelled.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for confirmation…
                </div>
              </div>
            ) : (
              <>
                <label htmlFor="pay-phone" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  M-Pesa phone number
                </label>
                <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-stone-300 bg-white focus-within:border-stone-900 transition-colors">
                  <span className="flex items-center bg-stone-100 px-3 text-sm font-bold text-stone-600">🇰🇪</span>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="07XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="min-h-[52px] w-full bg-transparent px-3 text-lg font-semibold outline-none placeholder:text-stone-400"
                  />
                </div>

                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-lg font-bold text-amber-100 shadow-lg transition active:scale-[0.99] hover:bg-stone-800 disabled:opacity-60"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending prompt…
                    </>
                  ) : (
                    <>Pay {formatKsh(data.amountDue)}</>
                  )}
                </button>

                <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                    Or pay manually · Buy Goods
                  </p>
                  <p className="mt-0.5 text-sm text-stone-700">
                    Till <span className="font-mono text-base font-black text-stone-900">{RECEIPT_DISPLAY_TILL_NUMBER}</span>
                    {" · "}Ref <span className="font-mono font-bold">{data.orderId}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-[#faf7f0] text-stone-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="px-5 py-8 text-center">
            {paymentState === "cancelled" ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <XCircle className="h-9 w-9 text-amber-700" />
                </div>
                <h2 className="text-xl font-bold text-stone-900">Payment cancelled</h2>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{paymentMessage}</p>
              </>
            ) : paymentState === "timeout" ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-200">
                  <AlertTriangle className="h-9 w-9 text-stone-700" />
                </div>
                <h2 className="text-xl font-bold text-stone-900">Still waiting?</h2>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{paymentMessage}</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-9 w-9 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-stone-900">Payment failed</h2>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{paymentMessage}</p>
              </>
            )}

            <p className="mt-4 font-mono text-xs text-stone-500 break-all">#{data.orderId}</p>
            {checkoutRequestId && (
              <p className="mt-1 font-mono text-[10px] text-stone-400 break-all">{checkoutRequestId}</p>
            )}

            <button
              onClick={resetPaymentAttempt}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-bold text-amber-100 transition hover:bg-stone-800"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
