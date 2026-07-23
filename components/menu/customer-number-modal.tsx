"use client"

import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Phone } from "lucide-react"
import { normalizeKenyaPhone } from "@/lib/phone-utils"

interface CustomerNumberModalProps {
  open: boolean
  onContinue: (customerNumber: string) => void
}

export function CustomerNumberModal({
  open,
  onContinue,
}: CustomerNumberModalProps) {
  const [input, setInput] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setInput("")
      setError("")
    }
  }, [open])

  const handleContinue = () => {
    const normalized = normalizeKenyaPhone(input)
    if (!normalized) {
      setError("Use a valid Kenyan number, e.g. 0796030992 or +254796030992.")
      return
    }
    onContinue(normalized)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm rounded-[1.15rem] border border-[rgba(185,138,68,0.22)] bg-[#14100c] shadow-2xl shadow-black/60 p-0 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#b98a44] to-transparent" />

        <div className="p-6">
          <DialogHeader className="mb-5">
            <div className="h-12 w-12 rounded-2xl bg-[rgba(200,114,42,0.14)] border border-[rgba(185,138,68,0.28)] flex items-center justify-center mb-4">
              <Phone className="h-6 w-6 text-[#e08a3c]" />
            </div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#b98a44] mb-2 text-left">
              Welcome
            </p>
            <DialogTitle className="text-xl font-semibold text-[#f2e8d8] text-left font-[family-name:var(--menu-font-display)]">
              Your table awaits
            </DialogTitle>
            <DialogDescription className="text-[rgba(242,232,216,0.45)] text-sm text-left mt-1.5">
              Enter your phone number to track your table orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (error) setError("")
              }}
              placeholder="+254 7XX XXX XXX"
              className="h-11 w-full rounded-xl border border-[rgba(185,138,68,0.22)] bg-[#0e0c0a] px-3 text-sm text-[#f2e8d8] placeholder:text-[rgba(242,232,216,0.28)] outline-none focus:border-[rgba(200,114,42,0.55)] focus:ring-2 focus:ring-[rgba(200,114,42,0.12)] transition-all duration-500"
            />
            {error && <p className="text-xs text-[#c07070]">{error}</p>}
            <button
              type="button"
              onClick={handleContinue}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-[#c8722a] to-[#b98a44] text-sm font-bold text-[#0e0c0a] shadow-[0_8px_24px_rgba(200,114,42,0.3)] transition-transform duration-500 active:scale-[0.98]"
            >
              Continue
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
