"use client"

import { cn } from "@/lib/utils"

interface SegmentOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SegmentedToggleProps {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedToggle({
  options,
  value,
  onChange,
  className,
}: SegmentedToggleProps) {
  return (
    <div
      className={cn(
        "flex w-full p-1 bg-muted rounded-xl border border-border",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            value === option.value
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

