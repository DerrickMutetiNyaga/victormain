import { notFound } from "next/navigation"
import { CheckCircle2, ShieldCheck, Wine } from "lucide-react"
import { PrintReceiptButton } from "./print-receipt-button"

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

function formatDateTime(value: string | Date): string {
  const dt = new Date(value)
  return dt.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  title: "Receipt | Catha Lounge",
  robots: { index: false, follow: false },
}

export default async function PublicReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const receipt = await fetchReceipt(orderId)
  if (!receipt) notFound()

  const paidAt = formatDateTime(receipt.timestamp)
  const paymentText = receipt.paymentMethod ? String(receipt.paymentMethod).toUpperCase() : "—"

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c0a09] text-stone-100 print:bg-white">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px] print:hidden" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-700/10 blur-[100px] print:hidden" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-8 sm:pt-12 print:max-w-full print:px-0 print:pt-0">
        {/* Brand */}
        <header className="mb-6 text-center print:hidden">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10">
            <Wine className="h-5 w-5 text-amber-300" />
          </div>
          <p className="font-serif text-2xl uppercase tracking-[0.3em] text-amber-100">Catha Lounge</p>
          <div className="mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-stone-400">Infusion Jaba</p>
        </header>

        <div className="flex-1">
          <div className="overflow-hidden rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] print:rounded-none print:shadow-none">
            {/* Success banner */}
            <div className="relative bg-gradient-to-b from-emerald-900 via-emerald-950 to-stone-950 px-6 pb-8 pt-9 text-center print:bg-white print:text-black">
              <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[70px] print:hidden" />
              <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center print:hidden">
                <span className="absolute inset-[-8px] rounded-full border border-amber-400/30" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-400/15 shadow-[0_0_40px_rgba(52,211,153,0.35)]">
                  <CheckCircle2 className="h-10 w-10 text-emerald-200" />
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-300/90 print:text-black">
                Official receipt
              </p>
              <h1 className="mt-1 font-serif text-[2rem] leading-tight text-amber-50 print:text-black">
                Payment received
              </h1>
              <p className="mt-3 font-serif text-4xl tabular-nums text-emerald-200 print:text-black">
                {formatMoney(receipt.total)}
              </p>
              <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent print:hidden" />
            </div>

            {/* Ivory receipt panel */}
            <div className="bg-[#faf7f0] px-6 py-5 text-stone-900 print:bg-white">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-stone-500">Order</span>
                  <span className="break-all text-right font-mono font-black">#{receipt.orderId}</span>
                </div>
                {receipt.receiptNumber && (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-stone-500">M-Pesa receipt</span>
                    <span className="font-mono font-bold">{receipt.receiptNumber}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-stone-500">Date</span>
                  <span className="font-semibold">{paidAt}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-stone-500">Payment</span>
                  <span className="font-semibold">{paymentText}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-stone-500">Status</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Paid
                  </span>
                </div>
              </div>

              {receipt.items.length > 0 && (
                <>
                  <div className="my-4 border-t border-dashed border-stone-300" />
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
                    Order items
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {receipt.items.map((item, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-stone-700">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="flex-1 border-b border-dotted border-stone-300" />
                        <span className="font-semibold tabular-nums">
                          {formatMoney(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="my-4 border-t-2 border-stone-900" />
              <div className="flex items-baseline justify-between">
                <span className="text-base font-black uppercase tracking-wide">Total paid</span>
                <span className="font-serif text-2xl tabular-nums">{formatMoney(receipt.total)}</span>
              </div>

              <p className="mt-5 text-center text-sm text-stone-600">
                Thank you for choosing <span className="font-serif font-semibold">Catha Lounge</span>.
                We look forward to serving you again.
              </p>

              <div className="mt-5">
                <PrintReceiptButton />
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-stone-500 print:hidden">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500/70" />
          Secured by M-Pesa · infusionjaba.co.ke
        </footer>
      </div>
    </main>
  )
}
