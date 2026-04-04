"use client"

import { cn } from "@/lib/utils"
import { Phone } from "lucide-react"
import { getPhoneValidationError } from "@/lib/phone-utils"

interface CustomerFieldsProps {
  customerName: string
  customerPhone: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  phoneError?: string | null
  className?: string
  readOnly?: boolean
}

export function CustomerFields({
  customerName,
  customerPhone,
  onNameChange,
  onPhoneChange,
  phoneError,
  className,
  readOnly = false,
}: CustomerFieldsProps) {
  // Auto-validate phone as user types
  const displayError = phoneError || (customerPhone ? getPhoneValidationError(customerPhone) : null)

  if (readOnly) {
    // Display-only mode for receipts/order views
    return (
      <div className={cn("space-y-1.5", className)}>
        {customerName && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium text-foreground">{customerName}</span>
          </div>
        )}
        {customerPhone && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium text-foreground font-mono text-xs">{customerPhone}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("bg-muted/50 rounded-xl border border-border p-2.5 space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Customer Phone
        </h3>
      </div>

      <div className="relative">
        <input
          type="tel"
          inputMode="numeric"
          value={customerPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="07XXXXXXXX"
          className={cn(
            "w-full min-h-[44px] h-10 px-3 pr-9 rounded-lg border text-sm font-medium",
            "text-foreground placeholder:text-muted-foreground bg-card",
            "focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring",
            "transition-colors font-mono",
            displayError
              ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
              : "border-border"
          )}
        />
        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {displayError && (
        <p className="text-[9px] text-destructive font-medium">{displayError}</p>
      )}
    </div>
  )
}

/**
 * Compact display component for order cards
 */
interface CustomerDisplayProps {
  name?: string | null
  phone?: string | null
  className?: string
}

export function CustomerDisplay({ name, phone, className }: CustomerDisplayProps) {
  if (!name && !phone) return null

  return (
    <div className={cn("space-y-1", className)}>
      {name && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Customer</span>
          <span className="font-medium text-foreground truncate max-w-[150px]">{name}</span>
        </div>
      )}
      {phone && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Phone</span>
          <span className="font-mono text-xs text-muted-foreground">{phone}</span>
        </div>
      )}
    </div>
  )
}

