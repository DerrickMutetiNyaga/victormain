"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { Button } from "@/components/ui/button"
import {
  Minus, Plus, Trash2, ShoppingBag, ArrowRight,
  Loader2, ShieldCheck, Sparkles,
  Tag, Lock, KeyRound,
} from "lucide-react"
import { calculateCartTotals } from "@/lib/ecommerce/pricing"
import { toast } from "sonner"

/* ══════════════════════════════════════════════════════════
   INLINE SIGN-IN PROMPT
══════════════════════════════════════════════════════════ */
function InlineSignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="relative rounded-3xl border border-[#d7d1c5] bg-gradient-to-b from-[#fffdf9] via-[#faf6ee] to-[#f3eee5] shadow-[0_26px_58px_rgba(28,22,16,0.22)] overflow-hidden w-full max-w-md mx-auto">
      <div className="h-1.5 bg-gradient-to-r from-[#435044] via-[#5a6a5a] to-[#3f4a40]" />
      <div className="pointer-events-none absolute -right-12 top-10 h-28 w-28 rounded-full bg-[#5d6a59]/10 blur-2xl" />
      <div className="p-5 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#e9efe7] to-[#dde6db] border border-[#b8c3b4] shadow-sm mb-4">
            <Lock className="h-7 w-7 text-[#4a584b]" />
          </div>
          <h2 className="text-[30px] leading-[1.08] sm:text-3xl font-black text-[#251f1a] tracking-tight mb-2">Access Your Cart</h2>
          <p className="text-[#5f5a53] text-sm sm:text-[15px] leading-relaxed max-w-[30ch]">
            Continue securely with your Google account.
          </p>
        </div>
        <Button
          onClick={onSignIn}
          className="w-full h-12 rounded-xl bg-white text-[#2f241f] border border-[#d7d1c5] shadow-[0_10px_24px_rgba(40,24,14,0.16)] hover:bg-[#fbf7f0] font-semibold"
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CART PAGE
══════════════════════════════════════════════════════════ */
export default function CartPage() {
  const router = useRouter()
  const { cart, session, updateQuantity, removeItem, loading } = useShopCart()
  const openLoginModal = useShopLoginModal()

  useEffect(() => { document.title = "Cart | Infusion Jaba" }, [])

  const getUniqueId = (item: { id: string; size?: string }) =>
    item.size ? `${item.id}-${item.size}` : item.id

  const { subtotal, vat, total } = calculateCartTotals(cart)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8]">
        <EcommerceHeader cartCount={0} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#8f6a2f]" />
          <p className="text-[#6f5d4f] text-sm">Loading your cart...</p>
        </div>
      </div>
    )
  }

  /* ── Not signed in ── */
  if (!session.signedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8f4ec] via-[#f3ede3] to-[#ece6dc]">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 pb-[96px] md:pb-14">
          <InlineSignIn onSignIn={() => openLoginModal()} />
          <div className="text-center mt-4 sm:mt-6">
            <Link href="/shop" className="text-sm text-[#7f786f] hover:text-[#3f4a40] transition-colors">
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
      <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8]">
        <EcommerceHeader cartCount={0} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 pb-[112px] md:pb-16">
          <div className="flex flex-col items-center justify-center text-center bg-[#fff9f1] rounded-3xl border border-[#dbc8aa] shadow-[0_16px_38px_rgba(40,25,14,0.12)] p-10 sm:p-16 max-w-2xl mx-auto">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-[#efe1ca] to-[#e4d1ad] border border-[#d2b98f] flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-[#7a5a27]" />
            </div>
            <h1 className="text-2xl font-black mb-2 text-[#2a201b]">Your cart is empty</h1>
            <p className="text-[#6f5d4f] mb-8 text-base">Add a few curated bottles to get started.</p>
            <Link href="/shop">
              <Button className="rounded-xl h-12 px-8 bg-gradient-to-r from-[#2e241e] via-[#3a2d24] to-[#261d18] text-[#f8ecd6] border border-[#7d5f37]/55 shadow-lg hover:shadow-xl font-bold">
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
    <div className="min-h-screen bg-gradient-to-br from-[#f8f3ea] via-[#f3ede2] to-[#ece4d8] pb-[188px] sm:pb-[186px] lg:pb-10">
      <EcommerceHeader cartCount={cartCount} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-5 sm:mb-7">
          <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#8f6a2f] to-[#6e4f25]" />
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#2a201b] tracking-tight">Your Cart</h1>
            <p className="text-xs sm:text-sm text-[#6f5d4f] mt-0.5">{cartCount} {cartCount === 1 ? "item" : "items"} ready for checkout</p>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Cart items */}
          <div className="space-y-3.5 sm:space-y-4">
            {cart.map((item) => {
              const uid = getUniqueId(item)
              return (
                <div
                  key={uid}
                  className="rounded-2xl border border-[#dccab0] bg-[#fffaf3] p-3.5 sm:p-4 lg:p-5 shadow-[0_8px_22px_rgba(46,30,18,0.08)] hover:border-[#caa97d] hover:shadow-[0_12px_28px_rgba(46,30,18,0.12)] transition-all"
                >
                  <div className="grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[108px_minmax(0,1fr)] gap-3 sm:gap-4">
                    {/* Image */}
                    <Link href={`/product/${item.id}`} className="shrink-0">
                      <div className="relative h-[88px] w-[88px] sm:h-[108px] sm:w-[108px] overflow-hidden rounded-xl bg-[#efe5d6] border border-[#d9c8b1] transition-colors">
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="108px" />
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#2a201b] text-[13px] sm:text-base leading-snug line-clamp-2">
                        <Link href={`/product/${item.id}`} className="hover:text-[#6b4d1f] transition-colors">{item.name}</Link>
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.size && (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-[#6f5d4f] bg-[#f3e8d8] rounded-md px-2 py-0.5 border border-[#dfcdb3]">
                            <Tag className="h-3 w-3" /> {item.size}
                          </span>
                        )}
                        <span className="text-[10px] sm:text-xs text-[#7b6958]">Unit price: KES {item.price.toLocaleString()}</span>
                      </div>

                      <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 rounded-xl border border-[#d8c3a4] bg-[#f7eddf] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                          <button
                            onClick={() => updateQuantity(uid, -1)}
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-[#6f5d4f] hover:text-[#2a201b] hover:bg-[#fff9ef] transition-all active:scale-90"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 sm:w-9 text-center text-sm font-bold text-[#2a201b]">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(uid, 1)}
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-[#6f5d4f] hover:text-[#2a201b] hover:bg-[#fff9ef] transition-all active:scale-90"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Line total + remove */}
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <p className="text-[13px] sm:text-lg font-black text-[#6b4d1f] whitespace-nowrap">
                            KES {(item.price * item.quantity).toLocaleString()}
                          </p>
                          <button
                            onClick={() => removeItem(uid)}
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-[#deceba] bg-[#fff7ed] flex items-center justify-center text-[#9c8c7a] hover:text-[#7f3b33] hover:border-[#d7b8aa] hover:bg-[#f6e8df] transition-all"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
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
        className="lg:hidden fixed left-0 right-0 bottom-[74px] z-40 px-3"
        style={{ paddingBottom: "max(8px,env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto rounded-2xl border border-[#d7c3a6] bg-[#fffaf3]/96 backdrop-blur-xl shadow-[0_14px_34px_rgba(32,20,12,0.18)] px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#7a6754] font-semibold">Order Total</p>
              <p className="text-[22px] leading-tight font-black text-[#2a201b]">KES {total.toLocaleString()}</p>
            </div>
            <Button
              onClick={() => router.push("/checkout")}
              className="h-13 rounded-xl bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 font-bold shadow-lg shadow-[#2d2018]/22 min-w-[188px] hover:from-[#3a2c23] hover:via-[#47372d] hover:to-[#332720] active:scale-[0.97] transition-all"
            >
              Checkout <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
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
    <div className="sticky top-24 rounded-2xl border border-[#d9c7ad] bg-[#fffaf3] shadow-[0_16px_34px_rgba(40,24,14,0.12)] overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#8f6a2f] to-[#6e4f25]" />
      <div className="p-5 xl:p-6">
        <h2 className="text-lg font-black text-[#2a201b] mb-5">Order Summary</h2>
        <div className="space-y-3 mb-5">
          {[
            { label: "Subtotal", value: subtotal },
            { label: "VAT (16%)", value: Math.round((total - subtotal) * 100) / 100 },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#7a6754]">{label}</span>
              <span className="font-semibold text-[#2a201b]">KES {value.toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-[#e2d2bd] pt-3 flex justify-between">
            <span className="font-bold text-[#2a201b]">Total</span>
            <span className="text-2xl font-black text-[#6b4d1f]">KES {total.toLocaleString()}</span>
          </div>
        </div>

        <Button
          onClick={onCheckout}
          className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r from-[#2f241e] via-[#3a2d24] to-[#281e18] text-[#f8ecd6] border border-[#7d5f37]/55 hover:from-[#3a2c23] hover:via-[#47372d] hover:to-[#332720] shadow-lg shadow-[#2d2018]/20 active:scale-[0.98] transition-all mb-3.5"
        >
          Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Link href="/shop">
          <Button variant="outline" className="w-full rounded-xl border-[#d6c3a5] text-[#6b4d1f] bg-[#fff6e9] hover:bg-[#f5e6cf]">
            Continue Shopping
          </Button>
        </Link>

        <div className="mt-5 pt-4 border-t border-[#e2d2bd] flex flex-col gap-2">
          <span className="flex items-center gap-2 text-xs text-[#7a6754]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#8f6a2f]" /> Secure M-Pesa Payment
          </span>
          <span className="flex items-center gap-2 text-xs text-[#7a6754]">
            <Sparkles className="h-3.5 w-3.5 text-[#8f6a2f]" /> Fast delivery available
          </span>
        </div>
      </div>
    </div>
  )
}
