"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, CheckCircle2, Smartphone, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatKsh } from "@/lib/receipt-utils"
import { normalizeKenyaPhone, getPhoneValidationError } from "@/lib/phone-utils"
import { toast } from "sonner"

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
  itemCount: number
  items: Array<{ name: string; quantity: number; price: number }>
}

export function PayOrderClient({ orderId }: { orderId: string }) {
  const [data, setData] = useState<PayOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [phone, setPhone] = useState("")
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(orderId)}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Order not found")
      setData(json)
      if (json.isPaid) setPaid(true)
      setError("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load order")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts += 1
      if (attempts > 40) {
        if (pollRef.current) clearInterval(pollRef.current)
        return
      }
      const res = await fetch(`/api/public/pay/${encodeURIComponent(orderId)}`, { cache: "no-store" })
      const json = await res.json()
      if (json.isPaid) {
        setPaid(true)
        setData(json)
        if (pollRef.current) clearInterval(pollRef.current)
        toast.success("Payment received!")
      }
    }, 3000)
  }, [orderId])

  const handlePay = async () => {
    if (!data || data.isPaid) return
    const err = getPhoneValidationError(phone)
    if (err) {
      toast.error(err)
      return
    }
    const normalized = normalizeKenyaPhone(phone)
    if (!normalized) return

    setPaying(true)
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
      toast.success("Check your phone — enter M-Pesa PIN", { duration: 8000 })
      startPolling()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Payment failed")
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-emerald-800">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-sm font-medium">Loading your bill…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">Order not found</p>
        <p className="text-sm text-slate-600 mt-2">{error || "This link may be invalid or expired."}</p>
      </div>
    )
  }

  if (paid || data.isPaid) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Paid!</h1>
        <p className="font-mono text-lg font-bold text-emerald-700">#{data.orderId}</p>
        <p className="text-slate-600">Thank you — your payment was received.</p>
        <a
          href={`/r/${encodeURIComponent(data.orderId)}`}
          className="inline-block text-sm font-semibold text-emerald-700 underline"
        >
          View receipt
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-950">
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        <div className="text-center text-white mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300/90">catha lounge</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight flex items-center justify-center gap-2">
            <Zap className="h-7 w-7 text-amber-400" />
            Quick Pay
          </h1>
          <p className="mt-1 text-sm text-emerald-200/80">M-Pesa — takes seconds</p>
        </div>

        <div className="rounded-2xl bg-white shadow-2xl shadow-emerald-950/50 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-950/80">Your order</p>
            <p className="font-mono text-2xl font-black text-amber-950 break-all">#{data.orderId}</p>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {data.items.length > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1.5 max-h-32 overflow-y-auto">
                {data.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-slate-700 truncate">{item.quantity}× {item.name}</span>
                    <span className="font-semibold tabular-nums shrink-0">{formatKsh(item.price * item.quantity)}</span>
                  </div>
                ))}
                {data.itemCount > data.items.length && (
                  <p className="text-xs text-slate-500">+{data.itemCount - data.items.length} more items</p>
                )}
              </div>
            )}

            <div className="text-center py-2">
              <p className="text-xs uppercase font-semibold text-slate-500">Amount to pay</p>
              <p className="text-4xl font-black text-emerald-700 tabular-nums">{formatKsh(data.amountDue)}</p>
              {data.totalPaid > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatKsh(data.totalPaid)} already paid · {formatKsh(data.orderTotal)} total
                </p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 font-semibold">or pay with number</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-phone" className="text-slate-700 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" /> M-Pesa phone
              </Label>
              <Input
                id="pay-phone"
                type="tel"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 text-lg font-semibold"
                autoComplete="tel"
              />
            </div>

            <Button
              onClick={handlePay}
              disabled={paying}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
            >
              {paying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Sending prompt…
                </>
              ) : (
                <>Pay {formatKsh(data.amountDue)} now</>
              )}
            </Button>

            {data.tillNumber && (
              <p className="text-center text-xs text-slate-500">
                Manual pay? Use Till <span className="font-mono font-bold text-slate-800">{data.tillNumber}</span> · Ref{" "}
                <span className="font-mono font-bold">{data.orderId}</span>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-emerald-300/60 mt-6">infusionjaba.co.ke · Secure M-Pesa</p>
      </div>
    </div>
  )
}
