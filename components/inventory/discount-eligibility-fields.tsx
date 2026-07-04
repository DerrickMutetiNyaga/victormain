"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { Loader2, Search, X } from "lucide-react"
import type { PosDiscountEligibilityScope } from "@/lib/pos-discount-client"

export interface EligibleCustomerOption {
  id: string
  name: string
  phone: string
  email?: string | null
  customerCode?: string | null
}

export interface DiscountEligibilityState {
  eligibilityScope: PosDiscountEligibilityScope
  eligibleCustomers: EligibleCustomerOption[]
}

export const defaultEligibilityState = (): DiscountEligibilityState => ({
  eligibilityScope: "everyone",
  eligibleCustomers: [],
})

const SCOPE_OPTIONS: Array<{
  value: PosDiscountEligibilityScope
  label: string
  disabled?: boolean
  hint?: string
}> = [
  { value: "everyone", label: "Everyone" },
  { value: "selected_customers", label: "Selected Customers" },
  { value: "customer_group", label: "Customer Group", disabled: true, hint: "Coming soon" },
  { value: "loyalty_tier", label: "Loyalty Tier", disabled: true, hint: "Coming soon" },
  { value: "membership_plan", label: "Membership Plan", disabled: true, hint: "Coming soon" },
]

export function DiscountEligibilityFields({
  value,
  onChange,
}: {
  value: DiscountEligibilityState
  onChange: (next: DiscountEligibilityState) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [searchResults, setSearchResults] = useState<EligibleCustomerOption[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (value.eligibilityScope !== "selected_customers") {
      setSearchResults([])
      return
    }
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)
    fetch(`/api/catha/pos-discounts/customers/search?q=${encodeURIComponent(debouncedQuery.trim())}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSearchResults(data.customers || [])
      })
      .catch(() => {
        if (!cancelled) setSearchResults([])
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, value.eligibilityScope])

  const setScope = (scope: PosDiscountEligibilityScope) => {
    if (scope === "everyone") {
      onChange({ eligibilityScope: "everyone", eligibleCustomers: [] })
      setSearchQuery("")
      return
    }
    onChange({ ...value, eligibilityScope: scope })
  }

  const addCustomer = (customer: EligibleCustomerOption) => {
    if (value.eligibleCustomers.some((c) => c.id === customer.id)) return
    onChange({
      ...value,
      eligibilityScope: "selected_customers",
      eligibleCustomers: [...value.eligibleCustomers, customer],
    })
    setSearchQuery("")
    setSearchResults([])
  }

  const removeCustomer = (id: string) => {
    const next = value.eligibleCustomers.filter((c) => c.id !== id)
    onChange({
      eligibilityScope: next.length === 0 ? "everyone" : "selected_customers",
      eligibleCustomers: next,
    })
  }

  return (
    <div className="space-y-3 w-full min-w-0">
      <Label className="text-sm text-muted-foreground block">Discount Eligibility</Label>
      <div className="space-y-2">
        {SCOPE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40",
              value.eligibilityScope === opt.value && !opt.disabled
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <input
              type="radio"
              name="discount-eligibility-scope"
              className="mt-1"
              checked={value.eligibilityScope === opt.value}
              disabled={opt.disabled}
              onChange={() => !opt.disabled && setScope(opt.value)}
            />
            <span className="min-w-0">
              <span className="font-medium">{opt.label}</span>
              {opt.hint && (
                <span className="block text-xs text-muted-foreground mt-0.5">{opt.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {value.eligibilityScope === "selected_customers" && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <Label className="text-sm font-medium">Search Customers</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Name, phone, email, or customer code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="rounded-md border bg-background divide-y max-h-40 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                  {(c.email || c.customerCode) && (
                    <p className="text-xs text-muted-foreground">
                      {[c.customerCode, c.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {value.eligibleCustomers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Eligible Customers</Label>
              <div className="flex flex-wrap gap-2">
                {value.eligibleCustomers.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1 py-1">
                    <span className="truncate max-w-[180px]">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomer(c.id)}
                      className="rounded-full hover:bg-muted p-0.5"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {value.eligibleCustomers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Select at least one customer, or choose Everyone for a public discount.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function eligibilityPayloadFromState(state: DiscountEligibilityState) {
  if (state.eligibilityScope !== "selected_customers" || state.eligibleCustomers.length === 0) {
    return { eligibilityScope: "everyone" as const, eligibleCustomers: [] as string[] }
  }
  return {
    eligibilityScope: "selected_customers" as const,
    eligibleCustomers: state.eligibleCustomers.map((c) => c.id),
  }
}
