"use client"

import { cn } from "@/lib/utils"

interface InfoChipProps {
  label: string
  value: string
  variant?: "default" | "primary" | "muted"
  className?: string
}

const variants = {
  default: "bg-[#f1f5f9] text-[#0f172a] border-[#e5e7eb]",
  primary: "bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/20",
  muted: "bg-[#f8fafc] text-[#64748b] border-[#e5e7eb]",
}

export function InfoChip({ label, value, variant = "default", className }: InfoChipProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className="text-[#64748b]">{label}:</span>
      <span
        className={cn(
          "px-2 py-0.5 rounded font-semibold border",
          variants[variant]
        )}
      >
        {value}
      </span>
    </div>
  )
}

