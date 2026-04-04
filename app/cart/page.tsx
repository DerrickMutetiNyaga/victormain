"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import {
  Minus, Plus, Trash2, ShoppingBag, ArrowRight,
  Phone, Loader2, ShieldCheck, Sparkles, Check,
  Tag, Lock,
} from "lucide-react"
import { calculateCartTotals } from "@/lib/ecommerce/pricing"
import { toast } from "sonner"
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

/* ══════════════════════════════════════════════════════════
   INLINE SIGN-IN PROMPT
══════════════════════════════════════════════════════════ */
function InlineSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [digits, setDigits] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isValid = digits.length === 9
  const fullPhone = `+254${digits}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDigits(localDigits(e.target.value)); setError("")
  }
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault(); setDigits(localDigits(e.clipboardData.getData("text"))); setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) { setError("Enter the 9 digits after +254"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/ecommerce/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }), credentials: "include",
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error || "Sign in failed"); return }
      toast.success(data.isNew ? "Account created! Welcome 🎉" : "Welcome back! 👋")
      onSignedIn()
    } catch { setError("Network error. Try again.") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-3xl border border-[#10B981]/20 bg-white shadow-xl overflow-hidden max-w-md mx-auto">
      <div className="h-1.5 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0E9F6E]" />
      <div className="p-8">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-[#10B981]/20 to-[#0E9F6E]/10 border border-[#10B981]/20 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-[#10B981]" />
          </div>
          <h2 className="text-2xl font-black text-[#1F2937] tracking-tight mb-2">Sign in to view cart</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed">
            Enter your Kenya phone number to access your cart and checkout.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#374151]">Phone Number</label>
            <div className={cn(
              "flex items-center rounded-xl border-2 bg-[#F9FAFB] transition-all overflow-hidden",
              error ? "border-red-400" :
              isValid ? "border-[#10B981] bg-white shadow-sm shadow-[#10B981]/10" :
              "border-[#E5E7EB] focus-within:border-[#10B981] focus-within:bg-white"
            )}>
              <div className="flex items-center pl-4 pr-3 border-r border-[#E5E7EB] py-3.5 bg-[#F0FDF4]/60 shrink-0">
                <span className="text-base font-bold text-[#10B981] tracking-wide select-none">+254</span>
              </div>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                placeholder="712 345 678"
                value={displayDigits(digits)}
                onChange={handleChange}
                onPaste={handlePaste}
                disabled={loading}
                autoFocus
                className="flex-1 bg-transparent py-3.5 pl-3 pr-3 text-base font-medium text-[#1F2937] placeholder:text-[#9CA3AF] outline-none"
              />
              {isValid && (
                <div className="pr-3">
                  <div className="h-5 w-5 rounded-full bg-[#10B981] flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                </div>
              )}
              {digits.length > 0 && !isValid && (
                <span className="pr-3 text-xs text-[#9CA3AF]">{digits.length}/9</span>
              )}
            </div>
            {error
              ? <p className="text-red-500 text-xs font-medium pl-1">{error}</p>
              : <p className="text-[#9CA3AF] text-xs pl-1">Kenya only · 07XX, 01XX or +254 format</p>
            }
          </div>

          <Button
            type="submit"
            disabled={!isValid || loading}
            className="w-full h-13 rounded-xl font-bold text-base bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white hover:from-[#0E9F6E] hover:to-[#059669] shadow-lg shadow-[#10B981]/20 disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue to Cart →"}
          </Button>

          <div className="flex items-center justify-center gap-4">
            {[
              { icon: ShieldCheck, label: "Secure" },
              { icon: Sparkles, label: "No password" },
              { icon: Phone, label: "Kenya only" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                <Icon className="h-3.5 w-3.5 text-[#10B981]" />{label}
              </span>
            ))}
          </div>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CART PAGE
══════════════════════════════════════════════════════════ */
export default function CartPage() {
  const router = useRouter()
  const { cart, session, updateQuantity, removeItem, loading, refresh } = useShopCart()
  const openLoginModal = useShopLoginModal()

  useEffect(() => { document.title = "Cart | Catha Lounge" }, [])

  const getUniqueId = (item: { id: string; size?: string }) =>
    item.size ? `${item.id}-${item.size}` : item.id

  const { subtotal, vat, total } = calculateCartTotals(cart)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white">
        <EcommerceHeader cartCount={0} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#10B981]" />
          <p className="text-[#6B7280] text-sm">Loading your cart…</p>
        </div>
      </div>
    )
  }

  /* ── Not signed in ── */
  if (!session.signedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <InlineSignIn onSignedIn={() => refresh()} />
          <div className="text-center mt-6">
            <Link href="/shop" className="text-sm text-[#6B7280] hover:text-[#10B981] transition-colors">
              ← Continue browsing the shop
            </Link>
          </div>
        </main>
      </div>
    )
  }

  /* ── Empty cart ── */
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-[#10B981]/20 shadow-sm p-16 max-w-2xl mx-auto">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-[#10B981]/15 to-[#0E9F6E]/10 flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-[#10B981]/60" />
            </div>
            <h1 className="text-2xl font-black mb-2 text-[#1F2937]">Your cart is empty</h1>
            <p className="text-[#6B7280] mb-8 text-base">Add some products to get started</p>
            <Link href="/shop">
              <Button className="rounded-xl h-12 px-8 bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white shadow-lg hover:shadow-xl font-bold">
                Browse Shop <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  /* ── Cart with items ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white pb-28 lg:pb-8">
      <EcommerceHeader cartCount={cartCount} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-7">
          <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#10B981] to-[#0E9F6E]" />
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#1F2937] tracking-tight">Shopping Cart</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{cartCount} {cartCount === 1 ? "item" : "items"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Cart items */}
          <div className="space-y-3">
            {cart.map((item) => {
              const uid = getUniqueId(item)
              return (
                <div
                  key={uid}
                  className="flex gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5 shadow-sm hover:border-[#10B981]/30 hover:shadow-md transition-all group"
                >
                  {/* Image */}
                  <Link href={`/product/${item.id}`} className="shrink-0">
                    <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-xl bg-slate-100 border border-[#E5E7EB] group-hover:border-[#10B981]/20 transition-colors">
                      <Image src={item.image} alt={item.name} fill className="object-cover" sizes="112px" />
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-[#1F2937] truncate text-sm sm:text-base hover:text-[#10B981] transition-colors">
                        <Link href={`/product/${item.id}`}>{item.name}</Link>
                      </h3>
                      {item.size && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#6B7280] bg-slate-100 rounded-md px-2 py-0.5 mt-1">
                          <Tag className="h-3 w-3" /> {item.size}
                        </span>
                      )}
                      <p className="text-lg font-black text-[#1F2937] mt-2">
                        KES {item.price.toLocaleString()}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-slate-50 p-0.5">
                        <button
                          onClick={() => updateQuantity(uid, -1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:bg-white transition-all active:scale-90"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm font-bold text-[#1F2937]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(uid, 1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:bg-white transition-all active:scale-90"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(uid)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line total */}
                  <div className="hidden sm:flex items-start shrink-0 pt-0.5">
                    <p className="text-xl font-black text-[#10B981]">
                      KES {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Order summary */}
          <div className="hidden lg:block">
            <OrderSummaryCard subtotal={subtotal} total={total} onCheckout={() => router.push("/checkout")} />
          </div>
        </div>
      </main>

      {/* Mobile sticky checkout bar */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#E5E7EB] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 py-3"
        style={{ paddingBottom: "max(12px,env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex-1">
            <p className="text-xs text-[#6B7280] font-medium">Total</p>
            <p className="text-xl font-black text-[#1F2937]">KES {total.toLocaleString()}</p>
          </div>
          <Button
            onClick={() => router.push("/checkout")}
            className="h-14 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white font-bold shadow-lg shadow-[#10B981]/25 min-w-[180px] hover:from-[#0E9F6E] hover:to-[#059669] active:scale-[0.97] transition-all"
          >
            Checkout <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── order summary card ─────────────── */
function OrderSummaryCard({ subtotal, total, onCheckout }: {
  subtotal: number; total: number; onCheckout: () => void
}) {
  return (
    <div className="sticky top-24 rounded-2xl border border-[#E5E7EB] bg-white shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#10B981] to-[#0E9F6E]" />
      <div className="p-6">
        <h2 className="text-lg font-black text-[#1F2937] mb-5">Order Summary</h2>
        <div className="space-y-3 mb-5">
          {[
            { label: "Subtotal", value: subtotal },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#6B7280]">{label}</span>
              <span className="font-semibold text-[#1F2937]">KES {value.toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t-2 border-[#E5E7EB] pt-3 flex justify-between">
            <span className="font-bold text-[#1F2937]">Total</span>
            <span className="text-xl font-black text-[#10B981]">KES {total.toLocaleString()}</span>
          </div>
        </div>

        <Button
          onClick={onCheckout}
          className="w-full h-13 rounded-xl font-bold text-base bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white hover:from-[#0E9F6E] hover:to-[#059669] shadow-lg shadow-[#10B981]/20 active:scale-[0.98] transition-all mb-4"
        >
          Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Link href="/shop">
          <Button variant="outline" className="w-full rounded-xl border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/5">
            Continue Shopping
          </Button>
        </Link>

        <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col gap-2">
          <span className="flex items-center gap-2 text-xs text-[#6B7280]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" /> Secure M-Pesa Payment
          </span>
          <span className="flex items-center gap-2 text-xs text-[#6B7280]">
            <Sparkles className="h-3.5 w-3.5 text-[#10B981]" /> Fast delivery available
          </span>
        </div>
      </div>
    </div>
  )
}
