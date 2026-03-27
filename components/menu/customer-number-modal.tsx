"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Phone, LogIn } from "lucide-react"

interface CustomerNumberModalProps {
  open: boolean
  onContinue: (customerNumber: string) => void
}

function formatKenyanPhone(raw: string): string {
  let cleaned = raw.trim()
  // Strip everything except digits and a leading +
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\D/g, "")
  } else {
    cleaned = cleaned.replace(/\D/g, "")
  }

  // Already has +254
  if (cleaned.startsWith("+254")) return cleaned
  // Has 254 prefix without +
  if (cleaned.startsWith("254")) return "+" + cleaned
  // Kenyan local format: 07xxxxxxxx or 01xxxxxxxx
  if (cleaned.startsWith("0") && cleaned.length >= 10) return "+254" + cleaned.slice(1)
  // Bare digits like 796030992
  if (cleaned.length >= 9) return "+254" + cleaned

  return cleaned
}

export function CustomerNumberModal({
  open,
  onContinue,
}: CustomerNumberModalProps) {
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Allow digits, +, spaces, dashes
    const cleaned = raw.replace(/[^\d+\s\-]/g, "")
    setValue(cleaned)
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError("Please enter your phone number")
      return
    }

    const formatted = formatKenyanPhone(trimmed)

    // Validate: +254 followed by 9 digits
    if (!/^\+254\d{9}$/.test(formatted)) {
      setError("Enter a valid Kenyan number e.g. 0796030992")
      return
    }

    setValue("")
    setError("")
    onContinue(formatted)

  }

  return (
    // Prevent closing without a phone number — pass noop to onOpenChange
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm rounded-3xl border border-white/[0.08] bg-[#13131E] shadow-2xl shadow-black/60 p-0 overflow-hidden">
        {/* Top accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400" />

        <div className="p-6">
          <DialogHeader className="mb-5">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
              <Phone className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white text-left">
              Welcome!
            </DialogTitle>
            <DialogDescription className="text-white/45 text-sm text-left mt-1">
              Enter your phone number to track your orders.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm font-medium pointer-events-none select-none">
                  +254
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0796 030 992"
                  value={value}
                  onChange={handleChange}
                  autoFocus
                  className="w-full h-12 pl-14 pr-4 rounded-xl bg-white/[0.07] border border-white/[0.10] text-white placeholder:text-white/25 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
                />
              </div>
              {error && (
                <p className="text-red-400 text-xs pl-1">{error}</p>
              )}
              <p className="text-white/25 text-xs pl-1">
                Enter with or without +254 — we'll format it for you
              </p>
            </div>

            <button
              type="submit"
              disabled={!value.trim()}
              className="w-full h-12 rounded-xl font-bold text-[15px] bg-gradient-to-r from-amber-500 to-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" strokeWidth={2.5} />
              Continue
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
