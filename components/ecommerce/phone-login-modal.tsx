"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, LogIn, Phone, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PhoneLoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (phone: string) => void
}

/** Strip any +254 / 254 / 0 prefix and return only the local 9 digits */
function localDigits(raw: string): string {
  let v = raw.trim()
  // remove +
  v = v.replace(/^\+/, "")
  // remove country code 254
  if (v.startsWith("254")) v = v.slice(3)
  // remove leading 0
  if (v.startsWith("0")) v = v.slice(1)
  // keep only digits, max 9
  return v.replace(/\D/g, "").slice(0, 9)
}

export function PhoneLoginModal({ open, onOpenChange, onSuccess }: PhoneLoginModalProps) {
  const [digits, setDigits] = useState("")   // 9 local digits after +254
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fullPhone = `+254${digits}`
  const isValid = digits.length === 9

  // auto-focus when opened
  useEffect(() => {
    if (open) {
      setDigits("")
      setError("")
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = localDigits(e.target.value)
    setDigits(cleaned)
    setError("")
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    const cleaned = localDigits(pasted)
    setDigits(cleaned)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      setError("Enter all 9 digits after +254 (e.g. 712 345 678)")
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/ecommerce/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      setDigits("")
      onSuccess(fullPhone)
      onOpenChange(false)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  // Format display: show groups like "712 345 678"
  const displayValue = digits
    .replace(/(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) => c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-3xl border-0 bg-white shadow-2xl p-0 overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0E9F6E]" />

        <div className="p-7">
          {/* Icon + Header */}
          <DialogHeader className="mb-6 text-left">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#0E9F6E]/10 border border-[#10B981]/20">
              <Phone className="h-7 w-7 text-[#10B981]" />
            </div>
            <DialogTitle className="text-2xl font-black text-[#1F2937] tracking-tight">
              Sign in to continue
            </DialogTitle>
            <DialogDescription className="text-[#6B7280] text-sm mt-1.5 leading-relaxed">
              Use your Kenya phone number — we&apos;ll create an account or log you in instantly.
            </DialogDescription>
          </DialogHeader>

          {/* Phone form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#374151]">Phone Number</label>

              {/* Input row with fixed +254 prefix */}
              <div
                className={cn(
                  "flex items-center rounded-xl border-2 bg-[#F9FAFB] transition-all duration-200 overflow-hidden",
                  error
                    ? "border-red-400 bg-red-50/30"
                    : digits.length > 0
                    ? "border-[#10B981] bg-white shadow-sm shadow-[#10B981]/10"
                    : "border-[#E5E7EB] focus-within:border-[#10B981] focus-within:bg-white focus-within:shadow-sm focus-within:shadow-[#10B981]/10"
                )}
              >
                {/* Prefix badge */}
                <div className="flex items-center gap-1.5 pl-4 pr-3 border-r border-[#E5E7EB] py-3.5 bg-[#F0FDF4]/60 shrink-0">
                  <span className="text-base font-bold text-[#10B981] tracking-wide select-none">+254</span>
                </div>

                {/* Input field - only accepts the 9 local digits */}
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  placeholder="712 345 678"
                  value={displayValue}
                  onChange={handleChange}
                  onPaste={handlePaste}
                  disabled={loading}
                  className="flex-1 bg-transparent py-3.5 pl-3 pr-4 text-base font-medium text-[#1F2937] placeholder:text-[#9CA3AF] outline-none disabled:opacity-60"
                  autoComplete="tel"
                />

                {/* Progress indicator */}
                {digits.length > 0 && digits.length < 9 && (
                  <span className="pr-3 text-xs text-[#9CA3AF] shrink-0">{digits.length}/9</span>
                )}
                {isValid && (
                  <div className="pr-3 shrink-0">
                    <div className="h-5 w-5 rounded-full bg-[#10B981] flex items-center justify-center">
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-500 text-xs font-medium pl-1 flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[10px] shrink-0">!</span>
                  {error}
                </p>
              )}

              {/* Hint */}
              {!error && (
                <p className="text-[#9CA3AF] text-xs pl-1">
                  Kenya only · 07XX, 01XX or +254 format accepted
                </p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={!isValid || loading}
              className="w-full h-13 rounded-xl font-bold text-base bg-gradient-to-r from-[#10B981] to-[#0E9F6E] text-white hover:from-[#0E9F6E] hover:to-[#059669] shadow-lg shadow-[#10B981]/25 disabled:opacity-40 disabled:shadow-none transition-all duration-200 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Continue
                </span>
              )}
            </Button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-5 pt-1">
              <span className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                Secure
              </span>
              <span className="h-3 w-px bg-[#E5E7EB]" />
              <span className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
                No password needed
              </span>
              <span className="h-3 w-px bg-[#E5E7EB]" />
              <span className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <Phone className="h-3.5 w-3.5 text-[#10B981]" />
                Kenya only
              </span>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
