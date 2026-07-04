"use client"

import { cn } from "@/lib/utils"
import { formatKsh } from "@/lib/receipt-utils"
import { getOrderPayUrl } from "@/lib/pay-url"
import { Smartphone, QrCode } from "lucide-react"

interface ScanToPayBlockProps {
  orderId: string
  amountDue?: number | null
  tillNumber?: string | null
  isPaid?: boolean
  className?: string
  /** Use absolute URLs for print iframe */
  baseUrl?: string
}

export function ScanToPayBlock({
  orderId,
  amountDue,
  tillNumber,
  isPaid = false,
  className,
  baseUrl,
}: ScanToPayBlockProps) {
  const payUrl = getOrderPayUrl(orderId, baseUrl)
  const qrSrc = `/api/qr?url=${encodeURIComponent(payUrl)}`
  const showPay = !isPaid && amountDue != null && amountDue > 0

  if (!showPay && isPaid) {
    return (
      <div className={cn("rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center", className)}>
        <p className="text-sm font-semibold text-emerald-800">Payment received</p>
        <p className="text-xs text-emerald-700 mt-1 font-mono">Order #{orderId}</p>
      </div>
    )
  }

  if (!showPay) return null

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-lg",
        className
      )}
    >
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 px-4 py-3 text-center text-white">
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
          <QrCode className="h-4 w-4" />
          Scan to Pay
          <Smartphone className="h-4 w-4" />
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-wide text-emerald-100/90">Order ID</p>
        <p className="font-mono text-xl sm:text-2xl font-black tracking-tight break-all leading-tight">
          #{orderId}
        </p>
        <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums">{formatKsh(amountDue!)}</p>
      </div>

      <div className="bg-white px-4 py-4 flex flex-col items-center gap-3">
        <div className="rounded-xl border-4 border-emerald-600/20 p-2 bg-white shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`Scan to pay order ${orderId}`}
            width={160}
            height={160}
            className="h-36 w-36 sm:h-40 sm:w-40 object-contain"
          />
        </div>
        <p className="text-[11px] text-center text-slate-600 leading-snug max-w-[240px]">
          Scan with your phone camera — M-Pesa opens instantly
        </p>
        <p className="text-[10px] font-mono text-emerald-800 break-all text-center px-1">
          {payUrl.replace(/^https?:\/\//, "")}
        </p>
        {tillNumber && (
          <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
            <p className="text-[10px] uppercase font-semibold text-amber-800 tracking-wide">M-Pesa Till</p>
            <p className="font-mono text-lg font-bold text-amber-950">{tillNumber}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** HTML string for thermal print (no React). */
export function scanToPayPrintHtml(opts: {
  orderId: string
  amountDue: number
  tillNumber?: string
  isPaid?: boolean
  baseUrl?: string
}): string {
  const { orderId, amountDue, tillNumber, isPaid, baseUrl } = opts
  if (isPaid || amountDue <= 0) return ""

  const payUrl = getOrderPayUrl(orderId, baseUrl)
  const qrSrc = `${(baseUrl || "https://www.infusionjaba.co.ke").replace(/\/$/, "")}/api/qr?url=${encodeURIComponent(payUrl)}`

  return `
    <div style="margin-top:12px;border:2px solid #059669;border-radius:8px;overflow:hidden;text-align:center;">
      <div style="background:linear-gradient(135deg,#047857,#0d9488);color:#fff;padding:10px 8px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SCAN TO PAY</div>
        <div style="font-size:9px;margin-top:6px;opacity:0.9;text-transform:uppercase;">Order ID</div>
        <div style="font-family:monospace;font-size:16px;font-weight:900;margin-top:2px;">#${orderId}</div>
        <div style="font-size:18px;font-weight:900;margin-top:6px;">KSh ${amountDue.toFixed(2)}</div>
      </div>
      <div style="padding:10px;background:#fff;">
        <img src="${qrSrc}" alt="QR" width="140" height="140" style="display:block;margin:0 auto;" />
        <div style="font-size:9px;color:#475569;margin-top:8px;">Scan with phone camera</div>
        <div style="font-family:monospace;font-size:8px;color:#047857;margin-top:4px;word-break:break-all;">${payUrl.replace(/^https?:\/\//, "")}</div>
        ${
          tillNumber
            ? `<div style="margin-top:8px;padding:6px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;">
                <div style="font-size:8px;font-weight:700;color:#92400e;text-transform:uppercase;">M-Pesa Till</div>
                <div style="font-family:monospace;font-size:14px;font-weight:900;color:#78350f;">${tillNumber}</div>
              </div>`
            : ""
        }
      </div>
    </div>
  `
}
