"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Package, Truck, Calendar, Hash, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type PublicItem = {
  productName: string
  flavor: string
  productType: string
  size: string
  batchNumber: string
  packageNumber: string
  quantity: number
  pricePerUnit: number
  totalCost: number
}

type PublicNote = {
  noteId: string
  distributorName: string
  date: string | null
  status: string
  paymentStatus: string
  vehicle?: string
  driver?: string
  driverPhone?: string
  notes?: string
  totalCost: number
  items: PublicItem[]
}

function formatWhen(iso: string | null) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

function itemLabel(row: PublicItem) {
  const name =
    row.productName?.trim() ||
    (row.productType && row.flavor ? `${row.productType} of ${row.flavor}` : row.flavor || "Product")
  return name
}

export function DeliveryNotePublicClient() {
  const params = useParams()
  const token =
    typeof params?.token === "string"
      ? params.token
      : typeof params?.slug === "string"
        ? params.slug
        : ""
  const [data, setData] = useState<PublicNote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError("Invalid link")
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/jaba/public/delivery-note/${encodeURIComponent(token)}`)
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || "Could not load this delivery note.")
        }
        if (!cancelled) setData(json.deliveryNote as PublicNote)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-50 via-white to-slate-50 text-slate-600 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
        <p className="text-sm font-medium">Loading your delivery note…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-red-50/80 via-white to-slate-50 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" aria-hidden />
        <h1 className="text-lg font-semibold text-slate-900">Delivery note unavailable</h1>
        <p className="text-sm text-slate-600 max-w-md">{error || "This link may be invalid or expired."}</p>
      </div>
    )
  }

  const statusLower = data.status.toLowerCase()
  const statusClass =
    statusLower === "delivered"
      ? "bg-white/25 text-white ring-white/40"
      : statusLower === "in transit"
        ? "bg-sky-400/30 text-white ring-white/35"
        : "bg-amber-400/35 text-white ring-white/35"

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-emerald-50/90 via-white to-slate-100/80">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <header className="text-center mb-8 sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/90 mb-2">Infusion Jaba</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Delivery note</h1>
          <p className="mt-2 text-sm text-slate-500">For your records — view on any device</p>
        </header>

        <article
          className={cn(
            "rounded-2xl border border-emerald-200/60 bg-white shadow-xl shadow-emerald-900/5",
            "ring-1 ring-slate-900/5 overflow-hidden"
          )}
        >
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-6 sm:px-8 sm:py-8 text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium">
                  <Hash className="h-4 w-4 opacity-90" aria-hidden />
                  Note ID
                </div>
                <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{data.noteId}</p>
              </div>
              <span
                className={cn(
                  "inline-flex self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1",
                  statusClass
                )}
              >
                {data.status}
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2 text-emerald-50/95">
                <Calendar className="h-4 w-4 mt-0.5 shrink-0 opacity-90" aria-hidden />
                <div>
                  <span className="block text-emerald-200/90 text-xs uppercase font-semibold">Date</span>
                  {formatWhen(data.date)}
                </div>
              </div>
              <div className="flex items-start gap-2 text-emerald-50/95">
                <Package className="h-4 w-4 mt-0.5 shrink-0 opacity-90" aria-hidden />
                <div>
                  <span className="block text-emerald-200/90 text-xs uppercase font-semibold">Payment</span>
                  {data.paymentStatus}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8 space-y-8">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recipient</h2>
              <p className="text-lg font-semibold text-slate-900">{data.distributorName}</p>
            </section>

            {(data.vehicle || data.driver) && (
              <section className="flex flex-wrap gap-4 text-sm">
                {data.vehicle && (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
                    <Truck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                    <div>
                      <span className="block text-xs text-slate-500 font-medium">Vehicle</span>
                      {data.vehicle}
                    </div>
                  </div>
                )}
                {data.driver && (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 border border-slate-100 min-w-[200px]">
                    <div>
                      <span className="block text-xs text-slate-500 font-medium">Driver</span>
                      <span className="text-slate-900">{data.driver}</span>
                      {data.driverPhone && (
                        <span className="block text-slate-600 text-sm mt-0.5">{data.driverPhone}</span>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Line items</h2>
              <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold text-center w-24">Size</th>
                      <th className="px-4 py-3 font-semibold text-right w-28">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((row, i) => (
                      <tr key={i} className="bg-white hover:bg-emerald-50/40 transition-colors">
                        <td className="px-4 py-3.5 text-slate-900">
                          <span className="font-medium">{itemLabel(row)}</span>
                          {row.batchNumber ? (
                            <span className="block text-xs text-slate-500 mt-1">Batch {row.batchNumber}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-700 tabular-nums">{row.size}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                          {row.quantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {data.notes && (
              <section className="rounded-xl bg-amber-50/80 border border-amber-100 px-4 py-3 text-sm text-amber-950">
                <span className="font-semibold text-amber-900/90">Notes — </span>
                {data.notes}
              </section>
            )}

            <footer className="pt-2 border-t border-slate-100 text-center text-xs text-slate-400">
              Infusion Jaba · This page shows the dispatch details shared with you. Save or screenshot for your records.
            </footer>
          </div>
        </article>
      </div>
    </div>
  )
}
