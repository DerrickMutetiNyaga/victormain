import { notFound } from "next/navigation"

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

  const when = new Date(receipt.timestamp)
  const lineTotal = (qty: number, price: number) => Number(qty || 0) * Number(price || 0)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-8 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Payment received</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{receipt.businessName} Receipt</h1>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p><span className="font-medium text-slate-800">Order:</span> {receipt.orderId}</p>
            <p><span className="font-medium text-slate-800">Time:</span> {when.toLocaleString("en-KE")}</p>
            <p>
              <span className="font-medium text-slate-800">Payment:</span>{" "}
              {receipt.paymentMethod ? String(receipt.paymentMethod).toUpperCase() : "—"}
            </p>
            <p>
              <span className="font-medium text-slate-800">Status:</span>{" "}
              {receipt.paymentStatus === "OVERPAID" ? "Paid" : "Paid"}
            </p>
          </div>
          {receipt.receiptNumber ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">Receipt ref: {receipt.receiptNumber}</p>
          ) : null}
        </div>

        <div className="px-5 py-5 sm:px-8 sm:py-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Items</h2>
          <div className="mt-3 space-y-2">
            {receipt.items.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.quantity} x {formatMoney(item.price)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{formatMoney(lineTotal(item.quantity, item.price))}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>Subtotal</span>
              <span>{formatMoney(receipt.subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm text-slate-700">
              <span>VAT</span>
              <span>{formatMoney(receipt.vat)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-base font-semibold text-slate-900">Total</span>
              <span className="text-xl font-bold text-slate-900">{formatMoney(receipt.total)}</span>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">Thank you for visiting us.</p>
        </div>
      </div>
    </main>
  )
}
