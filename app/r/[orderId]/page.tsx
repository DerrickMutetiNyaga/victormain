import { notFound } from "next/navigation"
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Check,
  CircleCheckBig,
  CreditCard,
  Heart,
  Leaf,
  Package,
  ReceiptText,
  ShoppingBag,
} from "lucide-react"

type PublicReceipt = {
  businessName: string
  orderId: string
  timestamp: string | Date
  paymentMethod: string | null
  paymentStatus: "PAID" | "OVERPAID" | "PARTIALLY_PAID" | "NOT_PAID"
  receiptNumber: string | null
  subtotal: number
  vat: number
  total: number
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
}

function formatMoney(v: number): string {
  return `KSh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(value: string | Date): { date: string; time: string } {
  const dt = new Date(value)
  return {
    date: dt.toLocaleDateString("en-GB"),
    time: dt.toLocaleTimeString("en-GB", { hour12: false }),
  }
}

function DetailRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-0.5 break-words text-[15px] font-semibold text-slate-900 ${valueClassName || ""}`}>{value}</p>
      </div>
    </div>
  )
}

async function fetchReceipt(orderId: string): Promise<PublicReceipt | null> {
  const baseUrl = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/public/receipts/${encodeURIComponent(orderId)}`, {
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as PublicReceipt
}

export const metadata = {
  title: "Receipt | Catha Lodge",
  robots: { index: false, follow: false },
}

export default async function PublicReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const receipt = await fetchReceipt(orderId)
  if (!receipt) notFound()

  const dt = formatDateTime(receipt.timestamp)
  const lineTotal = (qty: number, price: number) => Number(qty || 0) * Number(price || 0)
  const statusText = receipt.paymentStatus === "OVERPAID" ? "Paid" : "Paid"
  const paymentText = receipt.paymentMethod ? String(receipt.paymentMethod).toUpperCase() : "—"

  return (
    <main className="min-h-screen bg-[#f5f7f9] px-3 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <div className="h-6 bg-[#166534]" />
          <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
            {/* Header */}
            <div className="text-center">
              <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <CircleCheckBig className="h-11 w-11 text-emerald-600" />
                <span className="absolute -left-1 top-2 h-2 w-2 rounded-full bg-emerald-500" />
                <span className="absolute -right-0.5 top-5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="absolute -left-0.5 bottom-4 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="absolute -right-1 bottom-3 h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                Payment Received
              </div>
              <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">{receipt.businessName}</h1>
              <p className="mt-1 text-base text-slate-600">Thank you for your order!</p>
            </div>

            {/* Details */}
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-[#f9fffb] p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow
                  icon={<ReceiptText className="h-4 w-4" />}
                  label="Order ID"
                  value={receipt.orderId}
                  valueClassName="font-mono"
                />
                <DetailRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Date & Time"
                  value={
                    <span>
                      {dt.date}, <span className="font-semibold">{dt.time}</span>
                    </span>
                  }
                />
                <DetailRow icon={<CreditCard className="h-4 w-4" />} label="Payment Method" value={paymentText} />
                <DetailRow
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="Status"
                  value={
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                      {statusText}
                    </span>
                  }
                />
                <div className="sm:col-span-2">
                  <DetailRow
                    icon={<Bookmark className="h-4 w-4" />}
                    label="Receipt Reference"
                    value={receipt.receiptNumber || "—"}
                    valueClassName="text-emerald-700"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800">
                <ShoppingBag className="h-4 w-4 text-emerald-700" />
                Order Items
              </h2>
              <div className="mt-3 space-y-2.5">
                {receipt.items.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Package className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {item.quantity} x {formatMoney(item.price)}
                      </p>
                    </div>
                    <p className="text-xl font-extrabold text-slate-900">{formatMoney(lineTotal(item.quantity, item.price))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-base text-slate-700">
                <span>Subtotal</span>
                <span>{formatMoney(receipt.subtotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-base text-slate-700">
                <span>VAT</span>
                <span>{formatMoney(receipt.vat)}</span>
              </div>
              <div className="my-3 border-t border-dashed border-slate-300" />
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-emerald-700">Total Paid</span>
                <span className="text-4xl font-extrabold tracking-tight text-emerald-700">{formatMoney(receipt.total)}</span>
              </div>
            </div>

            {/* Thank you */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-[#fbfdfc] p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                <Heart className="h-5 w-5 fill-current" />
              </div>
              <p className="text-[28px] font-bold text-slate-900">Thank you for visiting us!</p>
              <p className="mx-auto mt-1 max-w-sm text-base text-slate-600">
                We appreciate your support and look forward to serving you again.
              </p>
            </div>

            {/* Branding */}
            <div className="mt-6 text-center">
              <p className="inline-flex items-center gap-2 text-[28px] font-semibold text-slate-900">
                <Leaf className="h-7 w-7 text-emerald-700" />
                Catha Lodge
              </p>
              <p className="mt-1 text-base text-slate-500">Good Food • Great Moments • Always</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
