"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Package, MapPin, User, LogOut, Loader2, Phone,
  Mail, Edit2, Plus, History, Truck, ShieldCheck,
  Sparkles, Check, X as XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { formatPhoneDisplay } from "@/lib/phone-utils"
import { cn } from "@/lib/utils"

/* ─────────────── types ─────────────── */
interface OrderItem { productId?: string; name: string; quantity: number; price: number; image?: string; size?: string }
interface Order {
  id: string; date: string; status: "pending"|"processing"|"shipped"|"delivered"|"cancelled"
  items: OrderItem[]; total: number; customerName?: string; customerPhone?: string
  customerEmail?: string; deliveryAddress?: string; city?: string; postalCode?: string; paymentStatus?: string
}
interface Address { id: string; name: string; address: string; city: string; postalCode: string; isDefault: boolean }
interface Profile { fullName: string; email: string; phone: string }

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

/* ─────────────── status color ─────────────── */
function statusColor(status: string) {
  const map: Record<string, string> = {
    delivered: "bg-[#10B981]", shipped: "bg-blue-500",
    processing: "bg-amber-500", pending: "bg-gray-400", cancelled: "bg-red-500",
  }
  return map[status] ?? "bg-gray-400"
}

/* ══════════════════════════════════════════════════════════
   SIGN-IN CARD (unauthenticated view)
══════════════════════════════════════════════════════════ */
function SignInCard({ onSignedIn }: { onSignedIn: () => void }) {
  const [digits, setDigits] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isValid = digits.length === 9
  const fullPhone = `+254${digits}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDigits(localDigits(e.target.value))
    setError("")
  }
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    setDigits(localDigits(e.clipboardData.getData("text")))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) { setError("Enter all 9 digits after +254"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/ecommerce/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }), credentials: "include",
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error || "Sign in failed"); return }
      toast.success(data.isNew ? "Account created! Welcome to Catha Lounge 🎉" : "Welcome back! 👋")
      onSignedIn()
    } catch { setError("Network error. Please try again.") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Hero text */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-[#10B981]/20 to-[#0E9F6E]/10 border border-[#10B981]/20 mb-5 mx-auto">
            <Phone className="h-10 w-10 text-[#10B981]" />
          </div>
          <h1 className="text-3xl font-black text-[#1F2937] tracking-tight mb-2">Welcome Back</h1>
          <p className="text-[#6B7280] text-base leading-relaxed">
            Sign in with your Kenya phone number.<br/>
            <span className="text-[#10B981] font-semibold">New? We'll create your account instantly.</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-[#E5E7EB] overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0E9F6E]" />
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-[#374151]">Phone Number</Label>
              <div className={cn(
                "flex items-center rounded-xl border-2 bg-[#F9FAFB] transition-all overflow-hidden",
                error ? "border-red-400" :
                isValid ? "border-[#10B981] shadow-sm shadow-[#10B981]/10 bg-white" :
                "border-[#E5E7EB] focus-within:border-[#10B981] focus-within:bg-white"
              )}>
                <div className="flex items-center gap-1 pl-4 pr-3 border-r border-[#E5E7EB] py-4 bg-[#F0FDF4]/60 shrink-0">
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
                  className="flex-1 bg-transparent py-4 pl-3 pr-3 text-base font-medium text-[#1F2937] placeholder:text-[#9CA3AF] outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as any)}
                />
                {isValid && (
                  <div className="pr-3">
                    <div className="h-6 w-6 rounded-full bg-[#10B981] flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                )}
                {digits.length > 0 && !isValid && (
                  <span className="pr-3 text-xs text-[#9CA3AF]">{digits.length}/9</span>
                )}
              </div>
              {error
                ? <p className="text-red-500 text-xs font-medium pl-1">{error}</p>
                : <p className="text-[#9CA3AF] text-xs pl-1">Kenya only · 07XX, 01XX or paste +254 format</p>
              }
            </div>

            <Button
              type="submit"
              disabled={!isValid || loading}
              className="w-full h-14 rounded-xl font-bold text-base bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white hover:from-[#0E9F6E] hover:to-[#059669] shadow-lg shadow-[#10B981]/20 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
            </Button>

            {/* Trust row */}
            <div className="flex items-center justify-center gap-4 pt-1">
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

        {/* Shop CTA */}
        <p className="text-center text-sm text-[#9CA3AF] mt-5">
          Just browsing?{" "}
          <Link href="/shop" className="text-[#10B981] font-semibold hover:underline">Continue to Shop →</Link>
        </p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ACCOUNT CONTENT (authenticated view)
══════════════════════════════════════════════════════════ */
function AccountContent() {
  const searchParams = useSearchParams()
  const { cart } = useShopCart()
  const { session, loading: sessionLoading, refreshSession, signOut } = useShopSession()
  const customerPhone = session.signedIn && session.customer?.phone ? session.customer.phone : null

  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [profile, setProfile] = useState<Profile>({ fullName: "", email: "", phone: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [newAddress, setNewAddress] = useState(false)
  const [tempProfile, setTempProfile] = useState<Profile>({ fullName: "", email: "", phone: "" })
  const [tempAddress, setTempAddress] = useState<Address>({ id: "", name: "", address: "", city: "", postalCode: "", isDefault: false })

  useEffect(() => { document.title = "My Account | Catha Lounge" }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!customerPhone) { setLoading(false); return }
      try {
        setLoading(true)
        const [ordersRes, inventoryRes] = await Promise.all([
          fetch(`/api/ecommerce/orders?phone=${encodeURIComponent(customerPhone)}`, { credentials: "include" }),
          fetch("/api/catha/inventory"),
        ])
        const ordersData = ordersRes.ok ? await ordersRes.json() : { success: false, orders: [] }
        const inventoryData = inventoryRes.ok ? await inventoryRes.json() : { success: false, products: [] }
        const products = inventoryData.success ? inventoryData.products : []

        if (ordersData.success && Array.isArray(ordersData.orders)) {
          const formatted: Order[] = ordersData.orders.map((o: any) => {
            const items: OrderItem[] = (o.items || []).map((item: any) => {
              const p = products.find((pr: any) => pr.id === item.productId || pr._id === item.productId || pr.name?.toLowerCase() === item.name?.toLowerCase())
              return { productId: item.productId, name: item.name || "Unknown", quantity: item.quantity || 1, price: item.price || 0, image: p?.image || item.image || "/placeholder.jpg", size: item.size }
            })
            let status: Order["status"] = "pending"
            if (o.status === "completed" || o.status === "delivered") status = "delivered"
            else if (o.status === "shipped") status = "shipped"
            else if (o.status === "processing") status = "processing"
            else if (o.status === "cancelled") status = "cancelled"
            return {
              id: o.id, date: o.timestamp ? new Date(o.timestamp).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "",
              status, items, total: o.total || 0, customerName: o.customerName, customerPhone: o.customerPhone,
              customerEmail: o.customerEmail, deliveryAddress: o.deliveryAddress, city: o.city, postalCode: o.postalCode, paymentStatus: o.paymentStatus,
            }
          })
          const seen = new Set<string>()
          const unique = formatted.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
          setOrders(unique)

          // Extract unique addresses from orders
          const addrMap = new Map<string, Address>()
          unique.forEach((o, i) => {
            if (o.deliveryAddress && o.city) {
              const key = `${o.deliveryAddress}|${o.city}|${o.postalCode || ""}`
              if (!addrMap.has(key)) {
                addrMap.set(key, {
                  id: `addr-${i}`,
                  name: o.deliveryAddress.toLowerCase().includes("home") ? "Home" : o.deliveryAddress.toLowerCase().includes("office") ? "Office" : `Address ${addrMap.size + 1}`,
                  address: o.deliveryAddress, city: o.city, postalCode: o.postalCode || "", isDefault: addrMap.size === 0,
                })
              }
            }
          })
          setAddresses(Array.from(addrMap.values()))

          // Profile
          if (unique.length > 0) {
            const fp = { fullName: unique[0].customerName || "", email: unique[0].customerEmail || "", phone: unique[0].customerPhone || customerPhone }
            setProfile(fp); setTempProfile(fp)
          } else {
            const pr = await fetch("/api/ecommerce/profile")
            if (pr.ok) { const d = await pr.json(); const p = d.profile || {}; const fp = { fullName: p.fullName || "", email: p.email || "", phone: customerPhone }; setProfile(fp); setTempProfile(fp) }
            else { setProfile({ fullName: "", email: "", phone: customerPhone }); setTempProfile({ fullName: "", email: "", phone: customerPhone }) }
          }
        } else {
          setOrders([])
          const pr = await fetch("/api/ecommerce/profile")
          if (pr.ok) { const d = await pr.json(); const p = d.profile || {}; setProfile({ fullName: p.fullName || "", email: p.email || "", phone: customerPhone }); setTempProfile({ fullName: p.fullName || "", email: p.email || "", phone: customerPhone }) }
          else { setProfile({ fullName: "", email: "", phone: customerPhone }); setTempProfile({ fullName: "", email: "", phone: customerPhone }) }
        }
      } catch (e: any) {
        toast.error("Failed to load account data")
        setOrders([])
      } finally { setLoading(false) }
    }
    if (customerPhone) fetchData(); else setLoading(false)
  }, [customerPhone, searchParams])

  const saveProfile = async () => {
    try {
      setSaving(true)
      const res = await fetch("/api/ecommerce/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: tempProfile.fullName, email: tempProfile.email }) })
      if (!res.ok) throw new Error()
      setProfile(tempProfile); setEditingProfile(false)
      toast.success("Profile updated!")
    } catch { toast.error("Failed to save profile") } finally { setSaving(false) }
  }

  const saveAddress = () => {
    if (newAddress) {
      setAddresses([...addresses, { ...tempAddress, id: `addr-${Date.now()}` }])
      setNewAddress(false)
    } else if (editingAddress) {
      setAddresses(addresses.map(a => a.id === editingAddress ? tempAddress : a))
      setEditingAddress(null)
    }
    setTempAddress({ id: "", name: "", address: "", city: "", postalCode: "", isDefault: false })
    toast.success("Address saved")
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ── UNAUTHENTICATED ──
  if (!sessionLoading && !customerPhone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white">
        <EcommerceHeader cartCount={cartCount} />
        <main className="container mx-auto px-4">
          <SignInCard onSignedIn={() => refreshSession()} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-white">
      <EcommerceHeader cartCount={cartCount} />

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 pt-4 pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#10B981]" />
            <p className="text-[#6B7280] text-sm">Loading your account…</p>
          </div>
        ) : (
          <Tabs defaultValue="orders" className="w-full">
            {/* Sticky header */}
            <div className="sticky top-16 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 pt-4 pb-3 mb-4 bg-white/95 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none border-b border-slate-100 sm:border-0">
              {/* Title row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#10B981] to-[#0E9F6E]" />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">My Account</h1>
                    {customerPhone && (
                      <p className="text-xs text-[#10B981] font-semibold mt-0.5">{formatPhoneDisplay(customerPhone)}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => { await signOut(); window.location.reload() }}
                  className="text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg gap-1.5 h-8"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </div>

              {/* Tabs */}
              <TabsList className="grid w-full grid-cols-3 h-11 p-1 rounded-xl bg-slate-100/80 border-0 gap-0">
                {[
                  { value: "orders", icon: Package, label: "Orders" },
                  { value: "addresses", icon: MapPin, label: "Addresses" },
                  { value: "profile", icon: User, label: "Profile" },
                ].map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-lg text-sm font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#10B981] data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 transition-all"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── ORDERS TAB ── */}
            <TabsContent value="orders" className="mt-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-4 w-4 text-[#10B981]" /> Order History
                </h2>
                {orders.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{orders.length} total</span>}
              </div>

              {orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <Package className="h-14 w-14 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-bold mb-2 text-slate-700">No orders yet</h3>
                  <p className="text-sm text-slate-500 mb-5">Start shopping to see your orders here.</p>
                  <Link href="/shop">
                    <Button className="bg-[#10B981] hover:bg-[#0E9F6E] rounded-xl h-11">Start Shopping →</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:border-[#10B981]/30 hover:shadow-md transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm text-slate-800">Order #{order.id}</h3>
                            <Badge className={cn("text-white text-xs capitalize px-2 py-0.5", statusColor(order.status))}>
                              {order.status}
                            </Badge>
                            {order.paymentStatus && (
                              <Badge variant="outline" className="text-xs capitalize">{order.paymentStatus.toLowerCase()}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mb-1">Placed on {order.date}</p>
                          {order.deliveryAddress && (
                            <p className="text-xs text-slate-500 flex items-start gap-1">
                              <Truck className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="truncate">{order.deliveryAddress}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1.5">
                          <p className="text-lg font-black text-[#10B981]">KES {order.total.toLocaleString()}</p>
                          <Link href={`/track?orderId=${order.id}`}>
                            <Button size="sm" className="h-8 rounded-lg bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981] hover:text-white border border-[#10B981]/30 text-xs font-semibold transition-all">
                              Track Order
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {/* Item thumbnails */}
                      {order.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                          {order.items.slice(0, 6).map((item, idx) => (
                            <div key={idx} className="flex-shrink-0 flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                              <div className="relative h-8 w-8 overflow-hidden rounded-md bg-slate-100">
                                <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" sizes="32px" />
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-slate-700 max-w-[80px] truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400">×{item.quantity}</p>
                              </div>
                            </div>
                          ))}
                          {order.items.length > 6 && (
                            <span className="text-xs text-slate-400 shrink-0">+{order.items.length - 6}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── ADDRESSES TAB ── */}
            <TabsContent value="addresses" className="mt-0">
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    {editingAddress === addr.id ? (
                      <AddressForm
                        value={tempAddress}
                        onChange={setTempAddress}
                        onSave={saveAddress}
                        onCancel={() => { setEditingAddress(null); setTempAddress({ id: "", name: "", address: "", city: "", postalCode: "", isDefault: false }) }}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm text-slate-800">{addr.name}</h3>
                            {addr.isDefault && <Badge className="bg-[#10B981] text-white text-xs px-2 py-0.5">Default</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">{addr.address}</p>
                          <p className="text-xs text-slate-500">{addr.city}{addr.postalCode ? `, ${addr.postalCode}` : ""}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => { setEditingAddress(addr.id); setTempAddress(addr) }} className="h-9 w-9 rounded-lg border-slate-200 p-0">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {!addr.isDefault && (
                            <Button variant="outline" size="sm" onClick={() => setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === addr.id })))} className="h-9 text-xs rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 px-2.5">
                              Set Default
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {newAddress ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <AddressForm
                      value={tempAddress}
                      onChange={setTempAddress}
                      onSave={saveAddress}
                      onCancel={() => { setNewAddress(false); setTempAddress({ id: "", name: "", address: "", city: "", postalCode: "", isDefault: false }) }}
                    />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setNewAddress(true)}
                    className="w-full rounded-xl h-11 border-dashed border-slate-300 text-slate-500 hover:border-[#10B981]/50 hover:text-[#10B981] hover:bg-[#10B981]/5 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Address
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* ── PROFILE TAB ── */}
            <TabsContent value="profile" className="mt-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-lg">
                {editingProfile ? (
                  <div className="space-y-4">
                    {[
                      { label: "Full Name", key: "fullName", type: "text", placeholder: "John Doe" },
                      { label: "Email", key: "email", type: "email", placeholder: "john@example.com" },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <Label className="text-sm font-semibold mb-1.5 block text-slate-700">{label}</Label>
                        <Input
                          type={type}
                          value={(tempProfile as any)[key]}
                          onChange={(e) => setTempProfile({ ...tempProfile, [key]: e.target.value })}
                          placeholder={placeholder}
                          className="rounded-xl border-[#10B981]/30 focus-visible:ring-[#10B981]/20"
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block text-slate-700 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone (read-only)
                      </Label>
                      <Input value={formatPhoneDisplay(profile.phone)} disabled className="rounded-xl bg-slate-50 text-slate-500" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={saveProfile} disabled={saving} className="flex-1 rounded-xl bg-[#10B981] hover:bg-[#0E9F6E] h-11">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingProfile(false); setTempProfile(profile) }} className="rounded-xl h-11">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: "Full Name", icon: User, value: profile.fullName || "Not set" },
                      { label: "Email", icon: Mail, value: profile.email || "Not set" },
                      { label: "Phone", icon: Phone, value: profile.phone ? formatPhoneDisplay(profile.phone) : "Not set" },
                    ].map(({ label, icon: Icon, value }) => (
                      <div key={label}>
                        <Label className="text-sm font-semibold mb-1.5 block text-slate-700 flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </Label>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">{value}</p>
                      </div>
                    ))}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Button
                        onClick={() => { setEditingProfile(true); setTempProfile(profile) }}
                        className="flex-1 rounded-xl bg-[#10B981] hover:bg-[#0E9F6E] h-11 gap-2"
                      >
                        <Edit2 className="h-4 w-4" /> Edit Profile
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => { await signOut(); window.location.reload() }}
                        className="rounded-xl h-11 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 gap-2"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

/* ─────────────── address form sub-component ─────────────── */
function AddressForm({ value, onChange, onSave, onCancel }: {
  value: Address
  onChange: (a: Address) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1 block">Label</Label>
          <Input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="Home, Office…" className="text-sm rounded-lg" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1 block">City</Label>
          <Input value={value.city} onChange={e => onChange({ ...value, city: e.target.value })} placeholder="Nairobi" className="text-sm rounded-lg" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1 block">Street Address</Label>
        <Input value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} placeholder="Street address or area" className="text-sm rounded-lg" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1 block">Postal Code</Label>
        <Input value={value.postalCode} onChange={e => onChange({ ...value, postalCode: e.target.value })} placeholder="00100" className="text-sm rounded-lg w-36" />
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} size="sm" className="flex-1 bg-[#10B981] hover:bg-[#0E9F6E] h-9 rounded-lg text-xs">Save</Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="h-9 rounded-lg text-xs">Cancel</Button>
      </div>
    </div>
  )
}

/* ─────────────── page export ─────────────── */
export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  )
}
