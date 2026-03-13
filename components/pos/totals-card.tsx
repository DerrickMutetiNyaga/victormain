"use client"

import { cn } from "@/lib/utils"

interface TotalsCardProps {
  subtotal: number
  vat: number
  total: number
  className?: string
}

export function TotalsCard({ subtotal, vat, total, className }: TotalsCardProps) {
  const formatKsh = (amount: number) =>
    `KSh ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <div
      className={cn(
        "bg-[#f1f5f9] rounded-2xl border border-[#e5e7eb] p-[14px_16px] space-y-2",
        className
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#64748b]">Subtotal</span>
        <span className="font-medium text-[#0f172a] tabular-nums">{formatKsh(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#64748b]">VAT (16%)</span>
        <span className="font-medium text-[#0f172a] tabular-nums">{formatKsh(vat)}</span>
      </div>
      <div className="h-px bg-[#e5e7eb] my-2" />
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-[#0f172a]">TOTAL</span>
        <span className="text-2xl font-bold text-[#0f172a] tabular-nums">{formatKsh(total)}</span>
      </div>
    </div>
  )
}

