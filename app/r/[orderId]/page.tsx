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
    <div className="flex items-start gap-2 sm:gap-2.5">
      <div className="mt-0.5 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
        <p className={`mt-0.5 break-words text-sm font-semibold text-slate-900 sm:text-[15px] ${valueClassName || ""}`}>{value}</p>
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
    <main className="min-h-screen bg-[#f5f7f9] px-2 py-4 sm:px-4 sm:py-8 lg:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-xl sm:max-w-2xl">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <div className="h-4 bg-[#166534] sm:h-5" />
          <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-7 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-6">
            {/* Header */}
            <div className="text-center">
              <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 sm:h-20 sm:w-20">
                <CircleCheckBig className="h-9 w-9 text-emerald-600 sm:h-11 sm:w-11" />
                <span className="absolute -left-1 top-2 h-2 w-2 rounded-full bg-emerald-500" />
                <span className="absolute -right-0.5 top-5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="absolute -left-0.5 bottom-4 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="absolute -right-1 bottom-3 h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 sm:px-4 sm:text-xs">
                Payment Received
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">{receipt.businessName}</h1>
              <p className="mt-1 text-sm text-slate-600 sm:text-base">Thank you for your order!</p>
            </div>

            {/* Details */}
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-[#f9fffb] p-3.5 sm:mt-5 sm:p-5">
              <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
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
            <div className="mt-5 sm:mt-6">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">
                <ShoppingBag className="h-4 w-4 text-emerald-700" />
                Order Items
              </h2>
              <div className="mt-2.5 space-y-2.5 sm:mt-3">
                {receipt.items.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="grid grid-cols-[48px_1fr_auto] items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:grid-cols-[56px_1fr_auto] sm:gap-3 sm:px-3 sm:py-3"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-14 sm:w-14">
                      <Package className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                        {item.quantity} x {formatMoney(item.price)}
                      </p>
                    </div>
                    <p className="text-base font-extrabold text-slate-900 sm:text-xl">{formatMoney(lineTotal(item.quantity, item.price))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.06)] sm:p-4">
              <div className="flex items-center justify-between text-sm text-slate-700 sm:text-base">
                <span>Subtotal</span>
                <span>{formatMoney(receipt.subtotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm text-slate-700 sm:text-base">
                <span>VAT</span>
                <span>{formatMoney(receipt.vat)}</span>
              </div>
              <div className="my-3 border-t border-dashed border-slate-300" />
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-700 sm:text-2xl">Total Paid</span>
                <span className="text-2xl font-extrabold tracking-tight text-emerald-700 sm:text-4xl">{formatMoney(receipt.total)}</span>
              </div>
            </div>

            {/* Thank you */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-[#fbfdfc] p-4 text-center sm:p-5">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm sm:h-11 sm:w-11">
                <Heart className="h-5 w-5 fill-current" />
              </div>
              <p className="text-xl font-bold text-slate-900 sm:text-[28px]">Thank you for visiting us!</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 sm:text-base">
                We appreciate your support and look forward to serving you again.
              </p>
            </div>

            {/* Branding */}
            <div className="mt-6 text-center">
              <p className="inline-flex items-center gap-2 text-xl font-semibold text-slate-900 sm:text-[28px]">
                <Leaf className="h-6 w-6 text-emerald-700 sm:h-7 sm:w-7" />
                Catha Lodge
              </p>
              <p className="mt-1 text-xs text-slate-500 sm:text-base">Good Food • Great Moments • Always</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
