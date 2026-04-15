"use client"

import { useState, useEffect, Suspense } from "react"
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
  Mail, Edit2, Plus, History, Truck,
  X as XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { formatPhoneDisplay } from "@/lib/phone-utils"
import { cn } from "@/lib/utils"
import { ShopPhoneOtpForm } from "@/components/ecommerce/shop-phone-otp-form"

/* ─────────────── types ─────────────── */
interface OrderItem { productId?: string; name: string; quantity: number; price: number; image?: string; size?: string }
interface Order {
  id: string; date: string; status: "pending"|"processing"|"shipped"|"delivered"|"cancelled"
  items: OrderItem[]; total: number; customerName?: string; customerPhone?: string
  customerEmail?: string; deliveryAddress?: string; city?: string; postalCode?: string; paymentStatus?: string
}
interface Address { id: string; name: string; address: string; city: string; postalCode: string; isDefault: boolean }
interface Profile { fullName: string; email: string; phone: string }

/* ─────────────── status color ─────────────── */
function statusColor(status: string) {
  const map: Record<string, string> = {
    delivered: "bg-[#2f8a63]",
    shipped: "bg-[#6f86a8]",
    processing: "bg-[#a67a38]",
    pending: "bg-[#8d8276]",
    cancelled: "bg-[#9f3e33]",
  }
  return map[status] ?? "bg-gray-400"
}

/* ══════════════════════════════════════════════════════════
   SIGN-IN CARD (unauthenticated view)
══════════════════════════════════════════════════════════ */
function SignInCard({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-10">
      <div className="w-full max-w-[22rem] sm:max-w-md md:max-w-xl">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[#cfab6f]/14 blur-3xl sm:h-56 sm:w-56" />
          <div className="absolute bottom-10 left-6 h-28 w-28 rounded-full bg-[#7e5b30]/12 blur-3xl sm:h-40 sm:w-40" />
          <div className="absolute top-28 right-6 h-24 w-24 rounded-full bg-[#4d3620]/10 blur-2xl sm:right-10 sm:h-32 sm:w-32" />
        </div>

        {/* Hero text */}
        <div className="text-center mb-5 sm:mb-7 md:mb-8">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 rounded-full border border-[#d9c7ad] bg-[#fff8ee]/90 px-2.5 py-1.5 sm:px-3.5 sm:py-2 shadow-sm">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-[#c7ab7a] bg-gradient-to-br from-[#2f241f] to-[#1e1714] shadow-sm">
              <span className="text-xs font-bold text-[#f3dfb8]">CL</span>
            </div>
            <div className="text-left">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#87673b] font-semibold">Catha Lounge</p>
              <p className="text-[9px] sm:text-[10px] text-[#8a7968]">Private Lounge Access</p>
            </div>
          </div>
          <h1 className="text-[30px] sm:text-[34px] md:text-[38px] font-black text-[#271d18] tracking-tight leading-[1.08] mb-2.5 sm:mb-3">Welcome Back</h1>
          <p className="text-[#6f5d4f] text-[14px] sm:text-[15px] leading-relaxed max-w-[34ch] sm:max-w-[42ch] mx-auto">
            We will send a one-time code by SMS to sign you in.
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-gradient-to-b from-[#fffcf6] via-[#fbf3e7] to-[#f2e6d6] rounded-3xl shadow-[0_28px_64px_rgba(40,24,14,0.28)] border border-[#dbc9b1] overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#6f4f25] via-[#b38749] to-[#5a3f20]" />
          <div className="pointer-events-none absolute -right-12 top-10 h-28 w-28 rounded-full bg-[#bb9358]/12 blur-2xl" />
          <div className="p-4 sm:p-6 md:p-8 space-y-3.5 sm:space-y-5">
            <ShopPhoneOtpForm
              variant="account"
              establishSession
              onSuccess={(_phone, meta) => {
                toast.success(
                  meta?.isNew ? "Account created! Welcome to Catha Lounge 🎉" : "Welcome back! 👋"
                )
                onSignedIn()
              }}
            />
          </div>
        </div>

        {/* Shop CTA */}
        <p className="text-center text-sm text-[#8f7f6e] mt-4 sm:mt-5">
          Just browsing?{" "}
          <Link href="/shop" className="text-[#8a6330] font-semibold hover:text-[#6f4f25] hover:underline">Continue to Shop →</Link>
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

  useEffect(() => { document.title = "My Account | Infusion Jaba" }, [])

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
      <div className="min-h-screen bg-gradient-to-br from-[#f6f1e8] via-[#f2ece2] to-[#ece4d8]">
        <EcommerceHeader cartCount={cartCount} />
        <main className="container mx-auto px-4 sm:px-6 md:px-8 pb-[92px] md:pb-8">
          <SignInCard onSignedIn={() => refreshSession()} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f1e8] via-[#f2ece2] to-[#ece4d8]">
      <EcommerceHeader cartCount={cartCount} />

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-[92px] md:pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#8f6a2f]" />
            <p className="text-[#6f5d4f] text-sm">Loading your account…</p>
          </div>
        ) : (
          <Tabs defaultValue="orders" className="w-full">
            {/* Sticky header */}
            <div className="sticky top-12 md:top-16 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2.5 sm:pt-3 pb-3 mb-4 sm:mb-5 bg-[#f6f1e8]/95 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none border-b border-[#decfb9] sm:border-0">
              {/* Title row */}
              <div className="flex items-center justify-between mb-3.5 sm:mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[#8f6a2f] to-[#6e4f25]" />
                  <div>
                    <h1 className="text-lg sm:text-2xl font-black text-[#2a201b] tracking-tight">My Account</h1>
                    {customerPhone && (
                      <p className="text-[11px] sm:text-xs text-[#8a6330] font-semibold mt-0.5">{formatPhoneDisplay(customerPhone)}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => { await signOut(); window.location.reload() }}
                  className="text-xs text-[#6f5d4f] hover:text-[#7f3b33] hover:bg-[#f4e7d8] rounded-lg gap-1.5 h-8 border border-transparent hover:border-[#dcc8ae]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </div>

              {/* Tabs */}
              <TabsList className="grid w-full grid-cols-3 h-11 sm:h-12 p-1 rounded-xl bg-[#efe6d8] border border-[#ddcbb1] gap-1 shadow-[0_3px_10px_rgba(35,24,16,0.08)]">
                {[
                  { value: "orders", icon: Package, label: "Orders" },
                  { value: "addresses", icon: MapPin, label: "Addresses" },
                  { value: "profile", icon: User, label: "Profile" },
                ].map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-lg text-xs sm:text-sm font-semibold gap-1 sm:gap-1.5 px-1 sm:px-2 data-[state=active]:bg-[#fff9f0] data-[state=active]:text-[#6b4d1f] data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-[#d7c39f] data-[state=inactive]:text-[#7f6e5d] transition-all"
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
                <h2 className="text-base font-bold text-[#2a201b] flex items-center gap-2">
                  <History className="h-4 w-4 text-[#8f6a2f]" /> Order History
                </h2>
                {orders.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#efe5d6] border border-[#dbc8ac] text-[#6f5d4f]">{orders.length} total</span>}
              </div>

              {orders.length === 0 ? (
                <div className="rounded-2xl border border-[#dbc8ac] bg-[#fff9f0] p-10 text-center shadow-[0_10px_24px_rgba(45,30,18,0.10)]">
                  <Package className="h-14 w-14 mx-auto mb-4 text-[#b49a79]" />
                  <h3 className="text-lg font-bold mb-2 text-[#2a201b]">No orders yet</h3>
                  <p className="text-sm text-[#6f5d4f] mb-5">Start shopping to see your orders here.</p>
                  <Link href="/shop">
                    <Button className="bg-[#2f241e] hover:bg-[#3a2b22] text-[#f8ecd6] rounded-xl h-11 border border-[#7d5f37]/55">Start Shopping →</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-[#dbc8ac] bg-[#fff9f1] p-3.5 sm:p-5 shadow-[0_8px_20px_rgba(42,28,16,0.10)] hover:border-[#cdb089] hover:shadow-[0_10px_24px_rgba(42,28,16,0.14)] transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                            <h3 className="font-bold text-xs sm:text-sm text-[#2a201b]">Order #{order.id}</h3>
                            <Badge className={cn("text-white text-xs capitalize px-2 py-0.5 rounded-full", statusColor(order.status))}>
                              {order.status}
                            </Badge>
                            {order.paymentStatus && (
                              <Badge variant="outline" className="text-xs capitalize border-[#d8c3a1] text-[#6b4d1f] bg-[#f9efdf]">
                                {order.paymentStatus.toLowerCase()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs text-[#7b6a59] mb-1">Placed on {order.date}</p>
                          {order.deliveryAddress && (
                            <p className="text-xs text-[#7b6a59] flex items-start gap-1">
                              <Truck className="h-3 w-3 shrink-0 mt-0.5 text-[#9b7a49]" />
                              <span className="truncate">{order.deliveryAddress}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2.5 sm:gap-2">
                          <p className="text-base sm:text-lg font-black text-[#6b4d1f]">KES {order.total.toLocaleString()}</p>
                          <Link href={`/track?orderId=${order.id}`}>
                            <Button size="sm" className="h-8 rounded-lg bg-[#f7ecdc] text-[#6b4d1f] hover:bg-[#8f6a2f] hover:text-white border border-[#d3bc98] text-[11px] sm:text-xs font-semibold transition-all">
                              Track Order
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {/* Item thumbnails */}
                      {order.items.length > 0 && (
                        <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-[#eadfce] flex items-center gap-2 overflow-x-auto scrollbar-hide">
                          {order.items.slice(0, 6).map((item, idx) => (
                            <div key={idx} className="flex-shrink-0 flex items-center gap-1.5 bg-[#f7efe2] rounded-lg px-2 py-1.5 border border-[#e6d8c1] min-w-[110px]">
                              <div className="relative h-8 w-8 overflow-hidden rounded-md bg-[#efe4d4]">
                                <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" sizes="32px" />
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-[#3a2d25] max-w-[80px] truncate">{item.name}</p>
                                <p className="text-[10px] text-[#8f7f6e]">x{item.quantity}</p>
                              </div>
                            </div>
                          ))}
                          {order.items.length > 6 && (
                            <span className="text-xs text-[#8f7f6e] shrink-0">+{order.items.length - 6}</span>
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
                            {addr.isDefault && <Badge className="bg-[#8f6a2f] text-white text-xs px-2 py-0.5">Default</Badge>}
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
                    className="w-full rounded-xl h-11 border-dashed border-[#d8c6ab] text-[#7b6a59] hover:border-[#8f6a2f]/50 hover:text-[#6b4d1f] hover:bg-[#f5ead9] gap-2"
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
                          className="rounded-xl border-[#d8c6ab] bg-[#fffdf8] focus-visible:ring-[#8f6a2f]/20 focus-visible:border-[#8f6a2f]/50"
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block text-slate-700 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone (read-only)
                      </Label>
                      <Input value={formatPhoneDisplay(profile.phone)} disabled className="rounded-xl bg-[#f4ecdf] text-[#7b6a59] border-[#e2d5c2]" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={saveProfile} disabled={saving} className="flex-1 rounded-xl bg-[#2f241e] hover:bg-[#3a2b22] text-[#f8ecd6] border border-[#7d5f37]/55 h-11">
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
                        className="flex-1 rounded-xl bg-[#2f241e] hover:bg-[#3a2b22] text-[#f8ecd6] border border-[#7d5f37]/55 h-11 gap-2"
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
      <div className="min-h-screen bg-gradient-to-br from-[#f6f1e8] via-[#f2ece2] to-[#ece4d8] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8f6a2f]" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  )
}
