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
      <DialogContent className="sm:max-w-sm rounded-3xl border border-white/[0.08] bg-[#13131E] shadow-2xl shadow-black/60 p-0 overflow-hidden">
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
              className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#0F1020] px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/45"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleContinue}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-sm font-bold text-black transition-transform active:scale-[0.98]"
            >
              Continue
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
