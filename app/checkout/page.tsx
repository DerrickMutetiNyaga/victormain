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
  Shield, Truck, Wine, LogIn, Phone, ShieldCheck, Sparkles,
  User, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { calculateCartTotals } from "@/lib/ecommerce/pricing"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { normalizeMpesaStatus } from "@/lib/mpesa-status"
import { cn } from "@/lib/utils"

/* ─────────────── phone helpers ─────────────── */
function localDigits(raw: string): string {
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
  { value: "deliver_to_my_location", label: "Deliver to My Location", fee: 350, icon: MapPin, subtext: "Nairobi & environs · KES 350" },
  { value: "collect_at_catha_lodge", label: "Collect at Catha Lounge", fee: 0, icon: Store, subtext: "Free · Pick up in-store" },
  { value: "nairobi_cbd", label: "Nairobi CBD", fee: 200, icon: MapPin, subtext: "KES 200 delivery" },
  { value: "westlands", label: "Westlands", fee: 200, icon: MapPin, subtext: "KES 200 delivery" },
  { value: "kilimani", label: "Kilimani", fee: 200, icon: MapPin, subtext: "KES 200 delivery" },
] as const

type DeliveryOption = { value: string; label: string; fee: number; subtext: string; icon: typeof MapPin }

const DEFAULT_PICKUP = "Catha Lounge – Nairobi (exact address confirmed at order)"

/* ══════════════════════════════════════════════════════════
   CHECKOUT PAGE
══════════════════════════════════════════════════════════ */
export default function CheckoutPage() {
  const router = useRouter()
  const { cart, clearCart, loading: cartLoading, refresh } = useShopCart()
  const { session } = useShopSession()
  const openLoginModal = useShopLoginModal()

  useEffect(() => { document.title = "Checkout | Catha Lounge" }, [])

  /* ── Customer details ── */
  const [fullName, setFullName] = useState("")
  const [phoneDigits, setPhoneDigits] = useState("") // 9 digits after +254
  const phoneRef = useRef<HTMLInputElement>(null)

  /* ── Delivery ── */
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(() =>
    DEFAULT_DELIVERY_OPTIONS.map(o => ({ ...o, icon: o.value === "collect_at_catha_lodge" ? Store : MapPin }))
  )
  const [selectedDelivery, setSelectedDelivery] = useState("")
  const [locationNote, setLocationNote] = useState("")
  const [pickupAddress, setPickupAddress] = useState(DEFAULT_PICKUP)
  const [pickupDirectionsUrl, setPickupDirectionsUrl] = useState("")

  /* ── Payment state ── */
  const [mpesaEnabled, setMpesaEnabled] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [showMpesaDialog, setShowMpesaDialog] = useState(false)

  // M-Pesa payment number (separate from order phone, pre-filled from session)
  const [mpesaDigits, setMpesaDigits] = useState("")
  const [paymentError, setPaymentError] = useState<{ message: string; status: string } | null>(null)

  /* ── Computed ── */
  const deliveryItem = deliveryOptions.find(o => o.value === selectedDelivery)
  const deliveryFee = deliveryItem?.fee ?? 0
  const { subtotal, vat, total: cartTotal } = calculateCartTotals(cart)
  const total = cartTotal + deliveryFee
  const showLocationInput = selectedDelivery === "deliver_to_my_location"
  const showCollectInfo = selectedDelivery === "collect_at_catha_lodge"
  const fullPhone = `+254${phoneDigits}`
  const isPhoneValid = phoneDigits.length === 9
  const mpesaFullPhone = `+254${mpesaDigits}`
  const isMpesaValid = mpesaDigits.length === 9

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
          if (m?.enabled && m?.consumerKey && m?.consumerSecret && m?.passkey && m?.shortcode) setMpesaEnabled(true)
          const d = data.settings?.delivery
          if (d) {
            if (d.pickupAddress) setPickupAddress(d.pickupAddress)
            if (d.pickupDirectionsUrl) setPickupDirectionsUrl(d.pickupDirectionsUrl.trim())
            if (d.options?.length) {
              setDeliveryOptions(
                d.options.filter((o: any) => o.enabled !== false).map((o: any) => ({
                  ...o, icon: o.value === "collect_at_catha_lodge" ? Store : MapPin,
                }))
              )
            }
          }
        }
      } catch {}
    }
    load()
  }, [])

  /* ── Payment status polling ── */
  useEffect(() => {
    if (!pendingOrderId) return
    let stopped = false
    let tid: ReturnType<typeof setTimeout> | null = null
    const start = Date.now()
    const CAP = 180_000, FAST_END = 30_000, FAST = 2000, SLOW = 5000

    const stop = () => { stopped = true; if (tid) clearTimeout(tid) }
    const poll = async () => {
      if (stopped) return
      try {
        const q = checkoutRequestId || pendingOrderId
        const res = await fetch(`/api/mpesa/transactions?search=${q}`, { cache: "no-store" })
        const data = await res.json()
        if (data.success && data.transactions?.length > 0) {
          const tx = data.transactions.find((t: any) =>
            t.accountReference === pendingOrderId ||
            (checkoutRequestId && t.checkoutRequestId === checkoutRequestId)
          ) || data.transactions[0]
          const status = normalizeMpesaStatus(tx.status)
          if (status !== "PENDING") stop()
          if (status === "COMPLETED") {
            toast.dismiss("mpesa-push")
            clearCart()
            toast.success("Payment confirmed! Your order is being processed. 🎉", { id: "mpesa-status" })
            router.push(`/account?order=${pendingOrderId}`)
          } else if (status === "FAILED" || status === "CANCELLED") {
            toast.dismiss("mpesa-push")
            setPaymentError({ message: status === "CANCELLED" ? "Payment was cancelled. Try again." : "Payment failed. Check your M-Pesa and retry.", status })
            setPendingOrderId(null); setProcessing(false)
          }
        }
      } catch {}
      if (!stopped) {
        const elapsed = Date.now() - start
        if (elapsed >= CAP) {
          stop()
          toast.dismiss("mpesa-push")
          setPaymentError({ message: "Confirmation timeout (3 min). Please check your phone.", status: "TIMEOUT" })
          setPendingOrderId(null); setProcessing(false)
          return
        }
        tid = setTimeout(poll, elapsed < FAST_END ? FAST : SLOW)
      }
    }
    poll()
    return stop
  }, [pendingOrderId, checkoutRequestId, router, clearCart])

  /* ── Form validation & submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error("Please enter your full name"); return }
    if (!isPhoneValid) { toast.error("Please enter a valid 9-digit number after +254"); phoneRef.current?.focus(); return }
    if (!selectedDelivery) { toast.error("Please select a delivery option"); return }
    if (showLocationInput && !locationNote.trim()) { toast.error("Please enter your location or area"); return }
    if (!mpesaEnabled) { toast.error("M-Pesa payment is not available. Please contact support."); return }
    setMpesaDigits(phoneDigits) // pre-fill mpesa from checkout phone
    setPaymentError(null)
    setShowMpesaDialog(true)
  }

  /* ── M-Pesa payment ── */
  const handleMpesaPayment = async () => {
    if (!isMpesaValid) { toast.error("Enter a valid 9-digit M-Pesa number after +254"); return }
    setPaymentError(null); setProcessing(true)
    try {
      const orderId = `ECO${Date.now().toString().slice(-8)}`
      const deliveryAddress =
        selectedDelivery === "collect_at_catha_lodge"
          ? `Collect at Catha Lounge – ${pickupAddress}`
          : selectedDelivery === "deliver_to_my_location"
          ? `Deliver to: ${locationNote || "My location"}`
          : deliveryItem?.label ?? ""

      const orderData = {
        id: orderId,
        customerName: fullName.trim(),
        customerPhone: fullPhone,
        customerEmail: "",
        deliveryAddress,
        city: "", postalCode: "", deliveryNotes: "",
        items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.quantity, price: i.price, size: i.size })),
        subtotal, vat, deliveryFee, total,
        paymentMethod: "mpesa", paymentStatus: "PENDING", status: "pending",
        timestamp: new Date(),
      }

      const orderRes = await fetch("/api/ecommerce/orders", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderData),
      })
      if (!orderRes.ok) throw new Error("Failed to create order")

      // update profile silently
      fetch("/api/ecommerce/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), phone: fullPhone }),
      }).catch(() => {})

      toast.loading("Initiating M-Pesa payment…", { id: "mpesa-push" })
      const stkRes = await fetch("/api/mpesa/stk-push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: mpesaFullPhone, amount: total, accountReference: orderId, transactionDesc: `Catha Lounge order ${orderId}` }),
      })
      const stkData = await stkRes.json()

      if (stkData.success) {
        toast.loading("Payment request sent! Enter your M-Pesa PIN when prompted.", { id: "mpesa-push" })
        setPendingOrderId(orderId)
        setCheckoutRequestId(stkData.data?.checkoutRequestID || null)
      } else {
        setPaymentError({ message: stkData.error || "Failed to initiate payment. Check M-Pesa settings.", status: "INITIATION_FAILED" })
        // cancel the order
        fetch("/api/ecommerce/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orderId, status: "cancelled" }) }).catch(() => {})
        setProcessing(false)
      }
    } catch (err: any) {
      setPaymentError({ message: err.message || "Payment failed. Please try again.", status: "ERROR" })
      setProcessing(false)
    }
  }

  const handleCancelPayment = () => {
    if (pendingOrderId) {
      fetch("/api/ecommerce/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pendingOrderId, status: "cancelled" }) }).catch(() => {})
    }
    setPaymentError(null); setPendingOrderId(null); setCheckoutRequestId(null)
    setShowMpesaDialog(false); setProcessing(false)
  }

  /* ── Guards ── */
  if (!session.signedIn && !cartLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center bg-white rounded-3xl border border-[#10B981]/20 shadow-xl p-10">
            <div className="h-16 w-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mx-auto mb-5">
              <LogIn className="h-8 w-8 text-[#10B981]" />
            </div>
            <h1 className="text-2xl font-black text-[#1a1a1a] mb-3">Sign in to checkout</h1>
            <p className="text-[#64748b] mb-7">You need to be signed in to complete your order.</p>
            <Button
              onClick={() => openLoginModal(async () => { await refresh(); router.push("/checkout") })}
              className="w-full h-13 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white font-bold shadow-lg mb-3"
            >
              <Phone className="mr-2 h-4 w-4" /> Sign In with Phone
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
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-black text-[#1a1a1a] mb-4">Your cart is empty</h1>
          <Link href="/shop">
            <Button className="rounded-xl bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white h-12 px-8 font-bold">Browse Shop</Button>
          </Link>
        </main>
      </div>
    )
  }

  /* ════════ MAIN CHECKOUT ════════ */
  return (
    <div className="min-h-screen bg-[#f8fafc] pb-28 lg:pb-12">
      <EcommerceHeader cartCount={cart.reduce((s, i) => s + i.quantity, 0)} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Back link */}
        <Link href="/cart">
          <button className="inline-flex items-center gap-2 text-[#475569] hover:text-[#10B981] font-semibold mb-7 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Cart
          </button>
        </Link>

        <div className="flex items-center gap-3 mb-7">
          <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#10B981] to-[#0E9F6E]" />
          <h1 className="text-2xl lg:text-3xl font-black text-[#1a1a1a] tracking-tight">Checkout</h1>
        </div>

        <form id="checkout-form" onSubmit={handleSubmit}>
          <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8 xl:gap-12">

            {/* LEFT: details + delivery */}
            <div className="space-y-5 lg:space-y-6">

              {/* Card 1: Customer details */}
              <div className="rounded-2xl bg-white border border-[#e2e8f0] p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-[#10B981]" />
                  </div>
                  <h2 className="text-lg font-black text-[#1a1a1a]">Your Details</h2>
                </div>
                <div className="space-y-4">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-[#1a1a1a] font-bold text-sm">Full Name *</Label>
                    <Input
                      id="fullName"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="h-13 rounded-xl border-2 border-[#e2e8f0] focus-visible:border-[#10B981] focus-visible:ring-2 focus-visible:ring-[#10B981]/20 text-[#1a1a1a]"
                      placeholder="John Doe"
                    />
                  </div>

                  {/* Phone with auto +254 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[#1a1a1a] font-bold text-sm">Phone Number *</Label>
                    <div className={cn(
                      "flex items-center rounded-xl border-2 bg-[#F9FAFB] transition-all overflow-hidden",
                      isPhoneValid ? "border-[#10B981] bg-white shadow-sm shadow-[#10B981]/10" :
                      "border-[#e2e8f0] focus-within:border-[#10B981] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#10B981]/20"
                    )}>
                      <div className="flex items-center pl-4 pr-3 border-r border-[#e2e8f0] py-[13px] bg-[#F0FDF4]/60 shrink-0">
                        <span className="text-base font-bold text-[#10B981] tracking-wide select-none">+254</span>
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
                        className="flex-1 bg-transparent py-[13px] pl-3 pr-3 text-base font-medium text-[#1a1a1a] placeholder:text-[#94a3b8] outline-none"
                      />
                      {isPhoneValid && (
                        <div className="pr-3 shrink-0">
                          <div className="h-5 w-5 rounded-full bg-[#10B981] flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[#64748b]">Kenya only · 07XX / 01XX / paste +254 format</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Delivery option */}
              <div className="rounded-2xl bg-white border border-[#e2e8f0] p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-[#10B981]" />
                  </div>
                  <h2 className="text-lg font-black text-[#1a1a1a]">Delivery Option</h2>
                </div>
                <div className="space-y-2.5">
                  {deliveryOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedDelivery(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200",
                        selectedDelivery === opt.value
                          ? "border-[#10B981] bg-[#10B981]/5 shadow-sm shadow-[#10B981]/10"
                          : "border-[#e2e8f0] hover:border-[#10B981]/40 hover:bg-[#f8fafc]"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors",
                        selectedDelivery === opt.value ? "bg-[#10B981] text-white" : "bg-[#f1f5f9] text-[#64748b]"
                      )}>
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1a1a1a] text-sm">{opt.label}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{opt.subtext}</p>
                        {opt.value === "collect_at_catha_lodge" && selectedDelivery === opt.value && (
                          <a
                            href={pickupDirectionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#10B981] hover:underline"
                          >
                            <MapPin className="h-3 w-3" /> Get directions
                          </a>
                        )}
                      </div>
                      <div className={cn(
                        "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedDelivery === opt.value ? "border-[#10B981] bg-[#10B981]" : "border-[#cbd5e1]"
                      )}>
                        {selectedDelivery === opt.value && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                </div>

                {showLocationInput && (
                  <div className="mt-4 pt-4 border-t border-[#e2e8f0] space-y-1.5">
                    <Label htmlFor="locationOrArea" className="text-[#1a1a1a] font-bold text-sm">Location / Area *</Label>
                    <Input
                      id="locationOrArea"
                      value={locationNote}
                      onChange={e => setLocationNote(e.target.value)}
                      className="h-13 rounded-xl border-2 border-[#e2e8f0] focus-visible:border-[#10B981] focus-visible:ring-2 focus-visible:ring-[#10B981]/20"
                      placeholder="e.g. Karen, Lavington, Westlands"
                    />
                  </div>
                )}

                {showCollectInfo && (
                  <div className="mt-4 pt-4 border-t border-[#e2e8f0] rounded-xl bg-[#F0FDF4]/60 border border-[#10B981]/20 p-4">
                    <p className="text-sm font-bold text-[#1a1a1a] mb-1">Pickup Address</p>
                    <p className="text-sm text-[#475569]">{pickupAddress}</p>
                    <a
                      href={pickupDirectionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#10B981] hover:underline"
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
                cart={cart} subtotal={subtotal} vat={vat} deliveryFee={deliveryFee} total={total}
                processing={processing}
              />
            </div>
          </div>
        </form>

        {/* Mobile sticky payment bar */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#e2e8f0] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 py-3"
          style={{ paddingBottom: "max(12px,env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="text-xs font-medium text-[#64748b]">Total</p>
              <p className="text-xl font-black text-[#1a1a1a]">KES {total.toLocaleString()}</p>
            </div>
            <Button
              type="submit"
              form="checkout-form"
              disabled={processing}
              className="h-14 min-w-[180px] rounded-2xl bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white font-bold shadow-lg active:scale-[0.97] disabled:opacity-50"
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
          onOpenChange={open => { if (!open && (pendingOrderId || paymentError)) return; if (!open) handleCancelPayment() }}
        >
          <DialogContent className="max-w-md rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0E9F6E]" />
            <div className="p-7">
              <DialogHeader className="mb-5">
                <div className="h-14 w-14 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
                  <Smartphone className="h-7 w-7 text-[#10B981]" />
                </div>
                <DialogTitle className="text-xl font-black text-[#1a1a1a]">M-Pesa Payment</DialogTitle>
                <DialogDescription className="text-sm text-[#64748b] mt-1">
                  {paymentError ? "Payment error occurred. Review and retry." : "Enter your M-Pesa number to receive the STK push."}
                </DialogDescription>
              </DialogHeader>

              {/* Error box */}
              {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-bold text-red-800 mb-1">
                    {paymentError.status === "CANCELLED" ? "Payment Cancelled" :
                     paymentError.status === "FAILED" ? "Payment Failed" :
                     paymentError.status === "TIMEOUT" ? "Timeout" : "Error"}
                  </p>
                  <p className="text-sm text-red-700">{paymentError.message}</p>
                </div>
              )}

              {/* M-Pesa phone input */}
              <div className="space-y-2 mb-4">
                <Label className="text-sm font-bold text-[#1a1a1a]">M-Pesa Phone Number</Label>
                <div className={cn(
                  "flex items-center rounded-xl border-2 bg-[#F9FAFB] transition-all overflow-hidden",
                  isMpesaValid ? "border-[#10B981] bg-white" : "border-[#e2e8f0] focus-within:border-[#10B981] focus-within:bg-white"
                )}>
                  <div className="flex items-center pl-4 pr-3 border-r border-[#e2e8f0] py-3.5 bg-[#F0FDF4]/60 shrink-0">
                    <span className="text-base font-bold text-[#10B981] select-none">+254</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="712 345 678"
                    value={displayDigits(mpesaDigits)}
                    onChange={e => setMpesaDigits(localDigits(e.target.value))}
                    onPaste={e => { e.preventDefault(); setMpesaDigits(localDigits(e.clipboardData.getData("text"))) }}
                    onKeyDown={e => { if (e.key === "Enter" && isMpesaValid && !processing && !pendingOrderId) handleMpesaPayment() }}
                    disabled={processing || !!pendingOrderId}
                    autoFocus={!paymentError}
                    className="flex-1 bg-transparent py-3.5 pl-3 pr-3 text-base font-medium text-[#1a1a1a] placeholder:text-[#94a3b8] outline-none disabled:opacity-60"
                  />
                  {isMpesaValid && (
                    <div className="pr-3">
                      <div className="h-5 w-5 rounded-full bg-[#10B981] flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order breakdown */}
              <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 space-y-2 mb-4">
                {[
                  { label: "Subtotal", value: subtotal },
                  { label: "VAT (16%)", value: vat },
                  { label: "Delivery", value: deliveryFee },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#64748b]">{label}</span>
                    <span className="font-semibold text-[#1a1a1a]">KES {value.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-black pt-2 border-t border-[#e2e8f0]">
                  <span>Total</span>
                  <span className="text-[#10B981]">KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Pending state */}
              {pendingOrderId && !paymentError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">Waiting for confirmation… Enter your M-Pesa PIN on your phone.</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {paymentError ? (
                  <>
                    <Button onClick={handleMpesaPayment} className="flex-1 h-13 rounded-xl font-bold bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white">
                      <Smartphone className="h-5 w-5 mr-2" /> Retry
                    </Button>
                    <Button onClick={handleCancelPayment} variant="outline" className="h-13 rounded-xl">Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleMpesaPayment}
                      disabled={!isMpesaValid || processing || !!pendingOrderId}
                      className="flex-1 h-13 rounded-xl font-bold bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white shadow-lg disabled:opacity-40"
                    >
                      {processing
                        ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{pendingOrderId ? "Waiting…" : "Processing…"}</span>
                        : <><Smartphone className="h-5 w-5 mr-2" />Send Payment Request</>
                      }
                    </Button>
                    <Button onClick={handleCancelPayment} variant="outline" disabled={processing && !pendingOrderId} className="h-13 rounded-xl">
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
function CheckoutSummary({ cart, subtotal, vat, deliveryFee, total, processing }: {
  cart: any[]; subtotal: number; vat: number; deliveryFee: number; total: number; processing: boolean
}) {
  return (
    <div className="sticky top-24 rounded-2xl bg-white border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#10B981] to-[#0E9F6E]" />
      <div className="p-6">
        <h2 className="text-lg font-black text-[#1a1a1a] mb-5">Order Summary</h2>

        <div className="space-y-3 mb-5">
          {cart.map((item: any) => (
            <div key={item.size ? `${item.id}-${item.size}` : item.id} className="flex gap-3 items-center">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f1f5f9] border border-[#e2e8f0]">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#1a1a1a] truncate">{item.name}</p>
                {item.size && <p className="text-xs text-[#64748b]">{item.size}</p>}
                <p className="text-xs text-[#64748b]">Qty: {item.quantity}</p>
              </div>
              <p className="font-black text-sm text-[#1a1a1a] shrink-0">KES {(item.price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#e2e8f0] pt-4 space-y-2 mb-2">
          {[
            { label: "Subtotal", value: subtotal },
            { label: "VAT (16%)", value: vat },
            { label: "Delivery", value: deliveryFee },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#64748b]">{label}</span>
              <span className="font-semibold text-[#1a1a1a]">{value === 0 ? "Free" : `KES ${value.toLocaleString()}`}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-baseline border-t-2 border-[#e2e8f0] mt-3 pt-4 mb-6">
          <span className="font-black text-[#1a1a1a]">Total</span>
          <span className="text-2xl font-black text-[#10B981]">KES {total.toLocaleString()}</span>
        </div>

        <Button
          type="submit"
          form="checkout-form"
          disabled={processing}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white font-black text-base shadow-lg hover:from-[#0E9F6E] hover:to-[#059669] active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {processing
            ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Processing…</span>
            : <><Smartphone className="h-5 w-5 mr-2" />Proceed to Payment</>
          }
        </Button>

        <div className="mt-5 pt-4 border-t border-[#e2e8f0] flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64748b]">
          {[
            { icon: Shield, label: "Secure M-Pesa" },
            { icon: Truck, label: "Fast Delivery" },
            { icon: Wine, label: "18+ Only" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#10B981]" />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
