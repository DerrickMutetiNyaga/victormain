"use client"

import { cn } from "@/lib/utils"
import { Banknote, Smartphone } from "lucide-react"

interface PaymentTileProps {
  method: "CASH" | "MPESA"
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  className?: string
}

const config = {
  CASH: {
    label: "Cash",
    icon: Banknote,
    activeClass: "border-[#16a34a] bg-[#16a34a]/5",
    iconClass: "text-[#16a34a]",
  },
  MPESA: {
    label: "M-Pesa",
    icon: Smartphone,
    activeClass: "border-[#2563eb] bg-[#2563eb]/5",
    iconClass: "text-[#2563eb]",
  },
}

export function PaymentTile({
  method,
  selected,
  onSelect,
  disabled = false,
  className,
}: PaymentTileProps) {
  const { label, icon: Icon, activeClass, iconClass } = config[method]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 touch-manipulation",
        selected
          ? activeClass
          : "border-[#e5e7eb] bg-white hover:border-[#d1d5db] hover:bg-[#f8fafc]",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
          selected ? "bg-white shadow-sm" : "bg-[#f1f5f9]"
        )}
      >
        <Icon className={cn("h-4 w-4", selected ? iconClass : "text-[#64748b]")} />
      </div>
      <span
        className={cn(
          "text-sm font-bold",
          selected ? "text-[#0f172a]" : "text-[#64748b]"
        )}
      >
        {label}
      </span>
    </button>
  )
}

