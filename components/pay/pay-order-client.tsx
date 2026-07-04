"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, CheckCircle2, Smartphone, ShieldCheck, Wine } from "lucide-react"
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0c0a09] text-stone-100 overflow-hidden">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-700/10 blur-[100px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-8 sm:pt-12">
        {/* Brand */}
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
  const [awaitingPin, setAwaitingPin] = useState(false)
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
        setAwaitingPin(false)
        return
      }
      try {
        const res = await fetch(`/api/public/pay/${encodeURIComponent(orderId)}`, { cache: "no-store" })
        const json = await res.json()
        if (json.isPaid) {
          setPaid(true)
          setData(json)
          setAwaitingPin(false)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // transient network error — keep polling
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
      setAwaitingPin(true)
      startPolling()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Payment failed")
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

  if (paid || data.isPaid) {
    return (
      <Shell>
        <div className="rounded-3xl border border-amber-400/30 bg-stone-900/70 p-8 text-center backdrop-blur">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400/10">
              <CheckCircle2 className="h-10 w-10 text-amber-300" />
            </span>
          </div>
          <h1 className="font-serif text-3xl text-amber-100">Payment received</h1>
          <p className="mt-2 font-mono text-sm font-bold tracking-wider text-stone-300">#{data.orderId}</p>
          <p className="mt-3 text-sm text-stone-400">
            Thank you for choosing Catha Lounge. Enjoy your evening.
          </p>
          <a
            href={`/r/${encodeURIComponent(data.orderId)}`}
            className="mt-6 inline-block rounded-full border border-amber-400/40 px-6 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10"
          >
            View receipt
          </a>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Ivory bill card */}
      <div className="overflow-hidden rounded-3xl bg-[#faf7f0] text-stone-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
        {/* Order strip */}
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
          {/* Items */}
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

          {/* Amount due */}
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

        {/* Payment area */}
        <div className="border-t border-dashed border-stone-300 bg-white px-5 py-5">
          {awaitingPin ? (
            <div className="text-center">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600">
                  <Smartphone className="h-7 w-7 text-white" />
                </span>
              </div>
              <p className="text-lg font-bold text-stone-900">Check your phone</p>
              <p className="mt-1 text-sm text-stone-600">
                Enter your <span className="font-semibold">M-Pesa PIN</span> to complete the payment. This page
                updates automatically.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for confirmation…
              </div>
              <button
                onClick={() => setAwaitingPin(false)}
                className="mt-4 text-xs font-semibold text-stone-500 underline underline-offset-2"
              >
                Didn&apos;t get the prompt? Try again
              </button>
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

              {data.tillNumber && (
                <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                    Or pay manually · Buy Goods
                  </p>
                  <p className="mt-0.5 text-sm text-stone-700">
                    Till <span className="font-mono text-base font-black text-stone-900">{data.tillNumber}</span>
                    {" · "}Ref <span className="font-mono font-bold">{data.orderId}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
