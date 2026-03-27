"use client"

import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface OrderInputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  helperText?: string
  error?: string
}

export const OrderInputField = forwardRef<HTMLInputElement, OrderInputFieldProps>(
  ({ label, helperText, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </label>
        <input
          ref={ref}
          className={cn(
            "w-full min-h-[44px] h-10 px-3 rounded-lg border text-sm font-medium transition-colors",
            "bg-card text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring",
            error
              ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
              : "border-border",
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    )
  }
)

OrderInputField.displayName = "OrderInputField"

