"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  ArrowLeft, Check, Smartphone, Loader2, MapPin, Store,
  Shield, Truck, Wine, LogIn, Phone, User, Info,
} from "lucide-react"
import { toast } from "sonner"
import { calculateCartTotals } from "@/lib/ecommerce/pricing"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { normalizeMpesaStatus } from "@/lib/mpesa-status"
import { cn } from "@/lib/utils"

/* ─────────────── phone helpers ─────────────── */
function localDigits(raw: string): string {
  if (!/^\+?[0-9\s().-]+$/.test(raw.trim())) return ""
  let v = raw.trim().replace(/^\+/, "")
  if (v.startsWith("254")) v = v.slice(3)
  if (v.startsWith("0")) v = v.slice(1)
  return v.replace(/\D/g, "").slice(0, 9)
}
function displayDigits(d: string) {
  return d.replace(/(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) =>
    c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a
  )
}

/* ─────────────── delivery options ─────────────── */
const DEFAULT_DELIVERY_OPTIONS = [
  { value: "deliver_to_my_location", label: "Deliver to My Location", fee: 1000, icon: MapPin, subtext: "Delivery fee applies" },
  { value: "collect_at_catha_lodge", label: "Collect at Catha Lounge", fee: 0, icon: Store, subtext: "Free · Pick up in-store" },
  { value: "nairobi_cbd", label: "Deliver within Nairobi CBD", fee: 450, icon: MapPin, subtext: "KES 450 delivery" },
  { value: "westlands", label: "Deliver within Westlands", fee: 350, icon: MapPin, subtext: "KES 350 delivery" },
  { value: "kilimani", label: "Deliver within Kilimani", fee: 200, icon: MapPin, subtext: "KES 200 delivery" },
] as const

type DeliveryOption = { value: string; label: string; fee: number; subtext: string; icon: typeof MapPin }

type OpeningHoursGate = {
  showNotice: boolean
  message: string | null
  blockCheckout: boolean
}

const DEFAULT_PICKUP = "Catha Lounge – Nairobi (exact address confirmed at order)"

/* ══════════════════════════════════════════════════════════
   CHECKOUT PAGE
══════════════════════════════════════════════════════════ */
export default function CheckoutPage() {
  const router = useRouter()
  const { cart, clearCart, loading: cartLoading } = useShopCart()
  const { session } = useShopSession()
  const openLoginModal = useShopLoginModal()

  useEffect(() => {
    document.title = "Checkout | Infusion Jaba"
  }, [])

  /* ── Customer details ── */
  const [fullName, setFullName] = useState("")
  const [phoneDigits, setPhoneDigits] = useState("") // 9 digits after +254
  const phoneRef = useRef<HTMLInputElement>(null)

  /* ── Delivery ── */
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(() =>
    DEFAULT_DELIVERY_OPTIONS.map(o => ({ ...o, icon: o.value === "collect_at_catha_lodge" || o.value.startsWith("collect_") ? Store : MapPin }))
  )
  const [selectedDelivery, setSelectedDelivery] = useState("")
  const [locationNote, setLocationNote] = useState("")
  const [pickupAddress, setPickupAddress] = useState(DEFAULT_PICKUP)
  const [pickupDirectionsUrl, setPickupDirectionsUrl] = useState("")

  /* ── Payment state ── */
  const [mpesaEnabled, setMpesaEnabled] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [pendingCheckoutSessionId, setPendingCheckoutSessionId] = useState<string | null>(null)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [showMpesaDialog, setShowMpesaDialog] = useState(false)

  // M-Pesa payment number (separate from order phone, pre-filled from session)
  const [mpesaDigits, setMpesaDigits] = useState("")
  const [paymentError, setPaymentError] = useState<{ message: string; status: string } | null>(null)
  const [hoursGate, setHoursGate] = useState<OpeningHoursGate | null>(null)

  /* ── Computed ── */
  const deliveryItem = deliveryOptions.find(o => o.value === selectedDelivery)
  const deliveryFee = deliveryItem?.fee ?? 0
  const { subtotal, total: cartTotal } = calculateCartTotals(cart)
  const total = cartTotal + deliveryFee
  const showLocationInput = selectedDelivery === "deliver_to_my_location"
  const showCollectInfo = selectedDelivery === "collect_at_catha_lodge"
  const fullPhone = `+254${phoneDigits}`
  const isPhoneValid = phoneDigits.length === 9
  const mpesaFullPhone = `+254${mpesaDigits}`
  const isMpesaValid = mpesaDigits.length === 9
  const closedCheckoutNotice =
    hoursGate?.showNotice && typeof hoursGate.message === "string" && hoursGate.message.trim()
      ? hoursGate.message.trim()
      : null
  const checkoutBlocked = hoursGate?.blockCheckout === true

  /* ── Pre-fill phone from session ── */
  useEffect(() => {
    if (session.signedIn && session.customer?.phone) {
      const d = localDigits(session.customer.phone)
      setPhoneDigits(d)
      setMpesaDigits(d)
    }
  }, [session.signedIn, session.customer?.phone])

  /* ── Load settings ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/catha/settings")
        if (!res.ok) return
        const data = await res.json()
        if (data.success && data.settings) {
          const m = data.settings?.mpesa
          if (m?.enabled && (m?.credentialsConfigured || (m?.consumerKey && m?.consumerSecret && m?.passkey && m?.shortcode))) setMpesaEnabled(true)
          const d = data.settings?.delivery
          if (d) {
            if (d.pickupAddress) setPickupAddress(d.pickupAddress)
            if (d.pickupDirectionsUrl) setPickupDirectionsUrl(d.pickupDirectionsUrl.trim())
            if (d.options?.length) {
              setDeliveryOptions(
                d.options.filter((o: any) => o.enabled !== false).map((o: any) => ({
                  ...o, icon: o.value === "collect_at_catha_lodge" || String(o.value || "").startsWith("collect_") ? Store : MapPin,
                }))
              )
            }
          }
        }
      } catch {}
    }
    load()
  }, [])

  useEffect(() => {
    const loadHours = async () => {
      try {
        const res = await fetch("/api/ecommerce/opening-hours-status", { cache: "no-store" })
        const d = await res.json().catch(() => ({}))
        if (d.success) {
          setHoursGate({
            showNotice: Boolean(d.showNotice),
            message: typeof d.message === "string" ? d.message : null,
            blockCheckout: Boolean(d.blockCheckout),
          })
        }
      } catch {
        setHoursGate(null)
      }
    }
    loadHours()
  }, [])

  /* ── Payment status polling (M-Pesa txn → checkout session → real order id) ── */
  useEffect(() => {
    if (!pendingCheckoutSessionId) return
    let stopped = false
    let tid: ReturnType<typeof setTimeout> | null = null
    const start = Date.now()
    const CAP = 180_000, FAST_END = 30_000, FAST = 2000, SLOW = 5000

    const stop = () => { stopped = true; if (tid) clearTimeout(tid) }

    const resolveOrderIdAfterPayment = async (): Promise<string | null> => {
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        try {
          const sRes = await fetch(`/api/ecommerce/checkout-sessions/${encodeURIComponent(pendingCheckoutSessionId)}`, {
            credentials: "include",
            cache: "no-store",
          })
          const sData = await sRes.json().catch(() => ({}))
          if (sRes.ok && sData.success && typeof sData.orderId === "string" && sData.orderId) {
            return sData.orderId
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000))
      }
      return null
    }

    const poll = async () => {
      if (stopped) return
      try {
        const q = checkoutRequestId || pendingCheckoutSessionId
        const res = await fetch(`/api/mpesa/transactions?search=${encodeURIComponent(q)}`, { cache: "no-store" })
        const data = await res.json()
        if (data.success && data.transactions?.length > 0) {
          const tx = data.transactions.find((t: any) =>
            t.accountReference === pendingCheckoutSessionId ||
            (checkoutRequestId && t.checkoutRequestId === checkoutRequestId)
          ) || data.transactions[0]
          const status = normalizeMpesaStatus(tx.status)
          if (status === "COMPLETED") {
            stop()
            toast.dismiss("mpesa-push")
            toast.loading("Confirming your order…", { id: "mpesa-status" })
            const orderId = await resolveOrderIdAfterPayment()
            toast.dismiss("mpesa-status")
            if (orderId) {
              clearCart()
              toast.success("Payment confirmed! Your order is being processed.", { id: "mpesa-done" })
              router.push(`/account?order=${encodeURIComponent(orderId)}`)
            } else {
              setPaymentError({
                message: "Payment received but order confirmation is delayed. Check Order history in a moment or contact support with your M-Pesa confirmation.",
                status: "ORDER_PENDING",
              })
            }
            setPendingCheckoutSessionId(null)
            setProcessing(false)
            return
          }
          if (status === "FAILED" || status === "CANCELLED") {
            stop()
            toast.dismiss("mpesa-push")
            setPaymentError({ message: status === "CANCELLED" ? "Payment was cancelled. Try again." : "Payment failed. Check your M-Pesa and retry.", status })
            fetch(`/api/ecommerce/checkout-sessions/${encodeURIComponent(pendingCheckoutSessionId)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "abandon" }),
            }).catch(() => {})
            setPendingCheckoutSessionId(null); setProcessing(false)
            return
          }
        }
      } catch {}
      if (!stopped) {
        const elapsed = Date.now() - start
        if (elapsed >= CAP) {
          stop()
          toast.dismiss("mpesa-push")
          setPaymentError({ message: "Confirmation timeout (3 min). Please check your phone.", status: "TIMEOUT" })
          setPendingCheckoutSessionId(null); setProcessing(false)
          return
        }
        tid = setTimeout(poll, elapsed < FAST_END ? FAST : SLOW)
      }
    }
    poll()
    return stop
  }, [pendingCheckoutSessionId, checkoutRequestId, router, clearCart])

  /* ── Form validation & submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error("Please enter your full name"); return }
    if (!isPhoneValid) { toast.error("Please enter a valid 9-digit number after +254"); phoneRef.current?.focus(); return }
    if (!selectedDelivery) { toast.error("Please select a delivery option"); return }
    if (showLocationInput && !locationNote.trim()) { toast.error("Please enter your location or area"); return }
    if (!mpesaEnabled) { toast.error("M-Pesa payment is not available. Please contact support."); return }
    if (checkoutBlocked) {
      toast.error(closedCheckoutNotice || "Checkout is temporarily unavailable during closed hours.")
      return
    }
    setMpesaDigits(phoneDigits) // pre-fill mpesa from checkout phone
    setPaymentError(null)
    setShowMpesaDialog(true)
  }

  /* ── M-Pesa payment ── */
  const handleMpesaPayment = async () => {
    if (!isMpesaValid) { toast.error("Enter a valid 9-digit M-Pesa number after +254"); return }
    if (checkoutBlocked) {
      toast.error(closedCheckoutNotice || "Checkout is temporarily unavailable during closed hours.")
      return
    }
    setPaymentError(null); setProcessing(true)
    try {
      const deliveryAddress =
        selectedDelivery === "collect_at_catha_lodge"
          ? `Collect at Catha Lounge – ${pickupAddress}`
          : selectedDelivery === "deliver_to_my_location"
          ? `Deliver to: ${locationNote || "My location"}`
          : deliveryItem?.label ?? ""

      /** Server builds priced snapshot — no order row until M-Pesa succeeds. */
      const checkoutPayload = {
        customerName: fullName.trim(),
        customerEmail: "",
        deliveryAddress,
        city: "",
        postalCode: "",
        deliveryNotes: "",
        deliveryOption: selectedDelivery || "",
        items: cart.map((i) => ({
          productId: i.id,
          quantity: i.quantity,
          ...(i.size && String(i.size).trim() ? { size: String(i.size).trim() } : {}),
        })),
      }

      const sessionRes = await fetch("/api/ecommerce/checkout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
        credentials: "include",
      })
      if (!sessionRes.ok) {
        let detail = "Failed to start checkout"
        let code = ""
        try {
          const errBody = await sessionRes.json()
          if (typeof errBody?.error === "string" && errBody.error) detail = errBody.error
          else if (typeof errBody?.message === "string" && errBody.message) detail = errBody.message
          if (typeof errBody?.code === "string") code = errBody.code
        } catch {
          /* ignore */
        }
        if (sessionRes.status === 403 && code === "ECOMMERCE_CLOSED") {
          setPaymentError({ message: detail, status: "ECOMMERCE_CLOSED" })
          setProcessing(false)
          return
        }
        throw new Error(detail)
      }

      const sessionPayload = await sessionRes.json().catch(() => ({} as { checkoutSession?: { id?: string; total?: number } }))
      const checkoutSessionId = sessionPayload?.checkoutSession?.id
      const stkAmount =
        typeof sessionPayload?.checkoutSession?.total === "number" && Number.isFinite(sessionPayload.checkoutSession.total)
          ? sessionPayload.checkoutSession.total
          : total
      if (!checkoutSessionId || typeof checkoutSessionId !== "string") {
        throw new Error("Invalid checkout session response")
      }

      fetch("/api/ecommerce/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), phone: fullPhone }),
      }).catch(() => {})

      toast.loading("Initiating M-Pesa payment…", { id: "mpesa-push" })
      const stkRes = await fetch("/api/mpesa/stk-push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: mpesaFullPhone,
          amount: stkAmount,
          accountReference: checkoutSessionId,
          transactionDesc: `Catha Lounge checkout ${checkoutSessionId}`,
        }),
      })
      const stkData = await stkRes.json()

      if (stkData.success) {
        toast.loading("Payment request sent! Enter your M-Pesa PIN when prompted.", { id: "mpesa-push" })
        setPendingCheckoutSessionId(checkoutSessionId)
        setCheckoutRequestId(stkData.data?.checkoutRequestID || null)
      } else {
        setPaymentError({ message: stkData.error || "Failed to initiate payment. Check M-Pesa settings.", status: "INITIATION_FAILED" })
        fetch(`/api/ecommerce/checkout-sessions/${encodeURIComponent(checkoutSessionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "abandon" }),
        }).catch(() => {})
        setProcessing(false)
      }
    } catch (err: any) {
      setPaymentError({ message: err.message || "Payment failed. Please try again.", status: "ERROR" })
      setProcessing(false)
    }
  }

  const handleCancelPayment = () => {
    if (pendingCheckoutSessionId) {
      fetch(`/api/ecommerce/checkout-sessions/${encodeURIComponent(pendingCheckoutSessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "abandon" }),
      }).catch(() => {})
    }
    setPaymentError(null); setPendingCheckoutSessionId(null); setCheckoutRequestId(null)
    setShowMpesaDialog(false); setProcessing(false)
  }

  /* ── Guards ── */
  if (!session.signedIn && !cartLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8]">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center rounded-3xl border border-[#dcc9ad] bg-[#fffaf3] shadow-[0_18px_40px_rgba(44,28,16,0.14)] p-10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#efe1ca] to-[#e4d1ad] border border-[#d2b98f] flex items-center justify-center mx-auto mb-5">
              <LogIn className="h-8 w-8 text-[#7a5a27]" />
            </div>
            <h1 className="text-2xl font-black text-[#2a201b] mb-3">Sign in to checkout</h1>
            <p className="text-[#6f5d4f] mb-7">You need to be signed in to complete your order.</p>
            <Button
              onClick={() => openLoginModal()}
              className="w-full h-13 rounded-xl bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 font-bold shadow-lg mb-3"
            >
              <Phone className="mr-2 h-4 w-4" /> Continue with Google
            </Button>
            <Link href="/shop">
              <Button variant="outline" className="w-full rounded-xl">Continue Shopping</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (cart.length === 0 && !cartLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8]">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-black text-[#2a201b] mb-4">Your cart is empty</h1>
          <Link href="/shop">
            <Button className="rounded-xl h-12 px-8 bg-gradient-to-r from-[#2e241e] via-[#3a2d24] to-[#261d18] text-[#f8ecd6] border border-[#7d5f37]/55 shadow-lg font-bold">Browse Shop</Button>
          </Link>
        </main>
      </div>
    )
  }

  /* ════════ MAIN CHECKOUT ════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8] pb-28 lg:pb-12">
      <EcommerceHeader cartCount={cart.reduce((s, i) => s + i.quantity, 0)} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Back link */}
        <Link href="/cart">
          <button className="inline-flex items-center gap-2 text-[#6f5d4f] hover:text-[#6b4d1f] font-semibold mb-7 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Cart
          </button>
        </Link>

        <div className="flex items-center gap-3 mb-7">
          <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#8f6a2f] to-[#6e4f25]" />
          <h1 className="text-2xl lg:text-3xl font-black text-[#2a201b] tracking-tight">Checkout</h1>
        </div>

        <form id="checkout-form" onSubmit={handleSubmit}>
          <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8 xl:gap-12">
            {closedCheckoutNotice && (
              <div className="lg:col-span-2 rounded-2xl border border-amber-200/90 bg-amber-50/95 p-4 sm:p-5 shadow-[0_8px_22px_rgba(120,80,20,0.08)]">
                <div className="flex gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-100 border border-amber-200/80 flex items-center justify-center">
                    <Info className="h-5 w-5 text-amber-800" aria-hidden />
                  </div>
                  <p className="text-sm sm:text-[15px] leading-relaxed text-amber-950 font-medium pt-0.5">
                    {closedCheckoutNotice}
                  </p>
                </div>
              </div>
            )}

            {/* LEFT: details + delivery */}
            <div className="space-y-5 lg:space-y-6">

              {/* Card 1: Customer details */}
              <div className="rounded-2xl border border-[#dcc9ad] bg-[#fffaf3] p-6 shadow-[0_10px_24px_rgba(40,24,14,0.10)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f1e4cf] to-[#e5d4b7] border border-[#dcc9ab] flex items-center justify-center">
                    <User className="h-4 w-4 text-[#7a5a27]" />
                  </div>
                  <h2 className="text-lg font-black text-[#2a201b]">Your Details</h2>
                </div>
                <div className="space-y-4">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-[#2e2621] font-bold text-sm">Full Name *</Label>
                    <Input
                      id="fullName"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="h-13 rounded-xl border-2 border-[#d8c8b2] bg-[#fffcf6] focus-visible:border-[#9b7740]/55 focus-visible:ring-2 focus-visible:ring-[#9b7740]/18 text-[#2a201b] placeholder:text-[#8d877f]"
                      placeholder="John Doe"
                    />
                  </div>

                  {/* Phone with auto +254 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[#2e2621] font-bold text-sm">Phone Number *</Label>
                    <div className={cn(
                      "flex items-center rounded-xl border-2 bg-[#fffcf6] transition-all overflow-hidden",
                      isPhoneValid ? "border-[#6b7d61] bg-[#fffdf8] shadow-sm shadow-[#6b7d61]/10" :
                      "border-[#d8c8b2] focus-within:border-[#9b7740]/55 focus-within:ring-2 focus-within:ring-[#9b7740]/18"
                    )}>
                      <div className="flex items-center pl-4 pr-3 border-r border-[#dccdb9] py-[13px] bg-gradient-to-b from-[#f4ecdf] to-[#ece2d4] shrink-0">
                        <span className="text-base font-bold text-[#5f4b3a] tracking-wide select-none">+254</span>
                      </div>
                      <input
                        ref={phoneRef}
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        placeholder="712 345 678"
                        value={displayDigits(phoneDigits)}
                        onChange={e => setPhoneDigits(localDigits(e.target.value))}
                        onPaste={e => { e.preventDefault(); setPhoneDigits(localDigits(e.clipboardData.getData("text"))) }}
                        className="flex-1 bg-transparent py-[13px] pl-3 pr-3 text-base font-medium text-[#2a201b] placeholder:text-[#8d877f] outline-none"
                      />
                      {isPhoneValid && (
                        <div className="pr-3 shrink-0">
                          <div className="h-5 w-5 rounded-full bg-[#6b7d61] flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[#7f786f]">Kenya only · 07XX / 01XX / paste +254 format</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Delivery option */}
              <div className="rounded-2xl border border-[#dcc9ad] bg-[#fffaf3] p-6 shadow-[0_10px_24px_rgba(40,24,14,0.10)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f1e4cf] to-[#e5d4b7] border border-[#dcc9ab] flex items-center justify-center">
                    <Truck className="h-4 w-4 text-[#7a5a27]" />
                  </div>
                  <h2 className="text-lg font-black text-[#2a201b]">Delivery Option</h2>
                </div>
                <div className="space-y-3">
                  {deliveryOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedDelivery(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
                        selectedDelivery === opt.value
                          ? "border-[#a47a43] bg-[#fff6e8] shadow-[0_10px_20px_rgba(48,31,18,0.10)]"
                          : "border-[#deceb8] bg-[#fffdf8] hover:border-[#c9ad81] hover:bg-[#fbf2e4]"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors border",
                        selectedDelivery === opt.value ? "bg-gradient-to-br from-[#8f6a2f] to-[#6e4f25] text-[#fff5e8] border-[#8f6a2f]" : "bg-[#f4ecdf] text-[#6f5d4f] border-[#dfd0bc]"
                      )}>
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#2a201b] text-sm">{opt.label}</p>
                        <p className="text-xs text-[#7f786f] mt-0.5">{opt.subtext}</p>
                        {opt.value === "collect_at_catha_lodge" && selectedDelivery === opt.value && (
                          <a
                            href={pickupDirectionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#6b4d1f] hover:underline"
                          >
                            <MapPin className="h-3 w-3" /> Get directions
                          </a>
                        )}
                      </div>
                      <div className={cn(
                        "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedDelivery === opt.value ? "border-[#8f6a2f] bg-[#8f6a2f]" : "border-[#c7b8a4] bg-[#fffaf2]"
                      )}>
                        {selectedDelivery === opt.value && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                </div>

                {showLocationInput && (
                  <div className="mt-4 pt-4 border-t border-[#e2d2bd] space-y-1.5">
                    <Label htmlFor="locationOrArea" className="text-[#2e2621] font-bold text-sm">Location / Area *</Label>
                    <Input
                      id="locationOrArea"
                      value={locationNote}
                      onChange={e => setLocationNote(e.target.value)}
                      className="h-13 rounded-xl border-2 border-[#d8c8b2] bg-[#fffcf6] focus-visible:border-[#9b7740]/55 focus-visible:ring-2 focus-visible:ring-[#9b7740]/18 text-[#2a201b] placeholder:text-[#8d877f]"
                      placeholder="e.g. Karen, Lavington, Westlands"
                    />
                  </div>
                )}

                {showCollectInfo && (
                  <div className="mt-4 pt-4 border-t border-[#e2d2bd] rounded-xl bg-[#f8f3ea] border border-[#dcccba] p-4">
                    <p className="text-sm font-bold text-[#2a201b] mb-1">Pickup Address</p>
                    <p className="text-sm text-[#6f5d4f]">{pickupAddress}</p>
                    <a
                      href={pickupDirectionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b4d1f] hover:underline"
                    >
                      <MapPin className="h-4 w-4" /> Get directions
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Order summary (desktop) */}
            <div className="hidden lg:block mt-0">
              <CheckoutSummary
                cart={cart} subtotal={subtotal} deliveryFee={deliveryFee} total={total}
                processing={processing}
                checkoutBlocked={checkoutBlocked}
              />
            </div>
          </div>
        </form>

        {/* Mobile: full order summary details */}
        <div className="lg:hidden mt-6">
          <CheckoutSummary
            cart={cart}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            processing={processing}
            sticky={false}
            checkoutBlocked={checkoutBlocked}
          />
        </div>

        {/* Mobile sticky payment bar */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fffaf3]/96 backdrop-blur-xl border-t border-[#dac7ab] shadow-[0_-8px_24px_rgba(32,20,12,0.14)] px-4 py-3"
          style={{ paddingBottom: "max(12px,env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="text-xs font-medium text-[#7a6754]">Total</p>
              <p className="text-xl font-black text-[#2a201b]">KES {total.toLocaleString()}</p>
            </div>
            <Button
              type="submit"
              form="checkout-form"
              disabled={processing || checkoutBlocked}
              className="h-14 min-w-[180px] rounded-2xl bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 font-bold shadow-lg active:scale-[0.97] disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Smartphone className="h-5 w-5 mr-2" />Pay with M-Pesa</>}
            </Button>
          </div>
        </div>
      </main>

      {/* ── M-Pesa dialog ── */}
      {showMpesaDialog && (
        <Dialog
          open={showMpesaDialog}
          onOpenChange={open => { if (!open && (pendingCheckoutSessionId || paymentError)) return; if (!open) handleCancelPayment() }}
        >
          <DialogContent className="max-w-md rounded-3xl border border-[#d8c7ab] bg-[#fffaf3] shadow-[0_26px_56px_rgba(32,20,12,0.24)] p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#8f6a2f] via-[#b68845] to-[#6e4f25]" />
            <div className="p-7">
              <DialogHeader className="mb-5">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#efe1ca] to-[#e4d1ad] border border-[#d2b98f] flex items-center justify-center mb-4">
                  <Smartphone className="h-7 w-7 text-[#7a5a27]" />
                </div>
                <DialogTitle className="text-xl font-black text-[#2a201b]">M-Pesa Payment</DialogTitle>
                <DialogDescription className="text-sm text-[#6f5d4f] mt-1">
                  {paymentError ? "Payment error occurred. Review and retry." : "Enter your M-Pesa number to receive the STK push."}
                </DialogDescription>
              </DialogHeader>

              {closedCheckoutNotice && !paymentError && (
                <div className="rounded-xl border border-amber-200/90 bg-amber-50 p-3 mb-4 flex gap-2 text-sm text-amber-950">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-800" />
                  <span>{closedCheckoutNotice}</span>
                </div>
              )}

              {/* Error box */}
              {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-bold text-red-800 mb-1">
                    {paymentError.status === "CANCELLED" ? "Payment Cancelled" :
                     paymentError.status === "FAILED" ? "Payment Failed" :
                     paymentError.status === "TIMEOUT" ? "Timeout" :
                     paymentError.status === "ECOMMERCE_CLOSED" ? "Checkout unavailable" : "Error"}
                  </p>
                  <p className="text-sm text-red-700">{paymentError.message}</p>
                </div>
              )}

              {/* M-Pesa phone input */}
              <div className="space-y-2 mb-4">
                <Label className="text-sm font-bold text-[#2e2621]">M-Pesa Phone Number</Label>
                <div className={cn(
                  "flex items-center rounded-xl border-2 bg-[#fffcf6] transition-all overflow-hidden",
                  isMpesaValid ? "border-[#6b7d61] bg-[#fffdf8]" : "border-[#d8c8b2] focus-within:border-[#9b7740]/55"
                )}>
                  <div className="flex items-center pl-4 pr-3 border-r border-[#dccdb9] py-3.5 bg-gradient-to-b from-[#f4ecdf] to-[#ece2d4] shrink-0">
                    <span className="text-base font-bold text-[#5f4b3a] select-none">+254</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="712 345 678"
                    value={displayDigits(mpesaDigits)}
                    onChange={e => setMpesaDigits(localDigits(e.target.value))}
                    onPaste={e => { e.preventDefault(); setMpesaDigits(localDigits(e.clipboardData.getData("text"))) }}
                    onKeyDown={e => { if (e.key === "Enter" && isMpesaValid && !processing && !pendingCheckoutSessionId) handleMpesaPayment() }}
                    disabled={processing || !!pendingCheckoutSessionId}
                    autoFocus={!paymentError}
                    className="flex-1 bg-transparent py-3.5 pl-3 pr-3 text-base font-medium text-[#2a201b] placeholder:text-[#8d877f] outline-none disabled:opacity-60"
                  />
                  {isMpesaValid && (
                    <div className="pr-3">
                      <div className="h-5 w-5 rounded-full bg-[#6b7d61] flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order breakdown */}
              <div className="rounded-xl bg-[#f8f3ea] border border-[#dfd0bc] p-4 space-y-2 mb-4">
                {[
                  { label: "Subtotal", value: subtotal },
                  { label: "Delivery", value: deliveryFee },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#7a6754]">{label}</span>
                    <span className="font-semibold text-[#2a201b]">KES {value.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-black pt-2 border-t border-[#e2d2bd]">
                  <span>Total</span>
                  <span className="text-[#6b4d1f]">KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Pending state */}
              {pendingCheckoutSessionId && !paymentError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">Waiting for confirmation… Enter your M-Pesa PIN on your phone.</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {paymentError ? (
                  <>
                    <Button onClick={handleMpesaPayment} className="flex-1 h-13 rounded-xl font-bold bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55">
                      <Smartphone className="h-5 w-5 mr-2" /> Retry
                    </Button>
                    <Button onClick={handleCancelPayment} variant="outline" className="h-13 rounded-xl">Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleMpesaPayment}
                      disabled={!isMpesaValid || processing || !!pendingCheckoutSessionId || checkoutBlocked}
                      className="flex-1 h-13 rounded-xl font-bold bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 shadow-lg disabled:opacity-40"
                    >
                      {processing
                        ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{pendingCheckoutSessionId ? "Waiting…" : "Processing…"}</span>
                        : <><Smartphone className="h-5 w-5 mr-2" />Send Payment Request</>
                      }
                    </Button>
                    <Button onClick={handleCancelPayment} variant="outline" disabled={processing && !pendingCheckoutSessionId} className="h-13 rounded-xl">
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ─────────────── checkout summary card ─────────────── */
function CheckoutSummary({ cart, subtotal, deliveryFee, total, processing, sticky = true, checkoutBlocked }: {
  cart: any[]; subtotal: number; deliveryFee: number; total: number; processing: boolean; sticky?: boolean
  checkoutBlocked?: boolean
}) {
  return (
    <div className={cn(
      "rounded-2xl bg-[#fffaf3] border border-[#d9c7ad] shadow-[0_16px_34px_rgba(40,24,14,0.12)] overflow-hidden",
      sticky && "sticky top-24"
    )}>
      <div className="h-1 bg-gradient-to-r from-[#8f6a2f] to-[#6e4f25]" />
      <div className="p-6">
        <h2 className="text-lg font-black text-[#2a201b] mb-5">Order Summary</h2>

        <div className="space-y-3 mb-5">
          {cart.map((item: any) => (
            <div key={item.size ? `${item.id}-${item.size}` : item.id} className="flex gap-3 items-start rounded-xl border border-[#e2d2bd] bg-[#fffdf8] p-2.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f2e9db] border border-[#e2d3be]">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#2a201b] truncate">{item.name}</p>
                {item.size && <p className="text-xs text-[#7a6754]">{item.size}</p>}
                <p className="text-xs text-[#7a6754]">Qty: {item.quantity}</p>
              </div>
              <p className="font-black text-sm text-[#6b4d1f] shrink-0">KES {(item.price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#e2d2bd] pt-4 space-y-2 mb-2">
          {[
            { label: "Subtotal", value: subtotal },
            { label: "Delivery", value: deliveryFee },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#7a6754]">{label}</span>
              <span className="font-semibold text-[#2a201b]">{value === 0 ? "Free" : `KES ${value.toLocaleString()}`}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-baseline border-t-2 border-[#e2d2bd] mt-3 pt-4 mb-6">
          <span className="font-black text-[#2a201b]">Total</span>
          <span className="text-2xl font-black text-[#6b4d1f]">KES {total.toLocaleString()}</span>
        </div>

        <Button
          type="submit"
          form="checkout-form"
          disabled={processing || checkoutBlocked}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 font-black text-base shadow-lg hover:from-[#3a2c23] hover:via-[#47372d] hover:to-[#332720] active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {processing
            ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Processing…</span>
            : checkoutBlocked
              ? <span>Unavailable · closed hours</span>
              : <><Smartphone className="h-5 w-5 mr-2" />Proceed to Payment</>
          }
        </Button>

        <div className="mt-5 pt-4 border-t border-[#e2d2bd] flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#7a6754]">
          {[
            { icon: Shield, label: "Secure M-Pesa" },
            { icon: Truck, label: "Fast Delivery" },
            { icon: Wine, label: "18+ Only" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#8f6a2f]" />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
