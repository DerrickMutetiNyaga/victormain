"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Phone, ShieldCheck, Sparkles } from "lucide-react"
import { ShopPhoneOtpForm } from "@/components/ecommerce/shop-phone-otp-form"

export interface PhoneLoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (phone: string) => void
}

export function PhoneLoginModal({ open, onOpenChange, onSuccess }: PhoneLoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-md max-h-[calc(100dvh-1.25rem)] rounded-3xl border border-[#d9c7ad] bg-gradient-to-b from-[#fffbf5] via-[#fbf4e9] to-[#f4eadd] shadow-[0_28px_72px_rgba(34,20,12,0.3)] p-0 overflow-y-auto">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#6f4f25] via-[#b38749] to-[#5a3f20]" />

        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#c59a57]/12 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-[#7d5a30]/10 blur-2xl" />

          <DialogHeader className="mb-5 text-left">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#c9ad7d] bg-gradient-to-br from-[#2f241f] to-[#1e1714] shadow-md">
                <span className="text-sm font-bold tracking-tight text-[#f3dfb7]">CL</span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#86673a] font-semibold">Catha Lounge</p>
                <p className="text-xs text-[#8b7a68]">Private account access</p>
              </div>
            </div>
            <DialogTitle className="text-[24px] sm:text-[30px] leading-[1.05] font-black text-[#241b16] tracking-tight">
              Lounge Access
            </DialogTitle>
            <DialogDescription className="text-[#6f5d4f] text-sm mt-1.5 leading-relaxed max-w-[34ch]">
              Enter your Kenya number and verify the code we send by SMS.
            </DialogDescription>
          </DialogHeader>

          <ShopPhoneOtpForm
            variant="modal"
            establishSession
            resetKey={open}
            onSuccess={(phone) => {
              onSuccess(phone)
            }}
          />

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3 border-t border-[#e8dcc8]/80 mt-4">
            <span className="flex items-center gap-1.5 text-[10.5px] text-[#8f7f6e]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#8f6a2f]" />
              SMS verification
            </span>
            <span className="hidden h-3 w-px bg-[#ded0be] sm:block" />
            <span className="flex items-center gap-1.5 text-[10.5px] text-[#8f7f6e]">
              <Sparkles className="h-3.5 w-3.5 text-[#8f6a2f]" />
              Kenya only
            </span>
            <span className="hidden h-3 w-px bg-[#ded0be] sm:block" />
            <span className="flex items-center gap-1.5 text-[10.5px] text-[#8f7f6e]">
              <Phone className="h-3.5 w-3.5 text-[#8f6a2f]" />
              No password
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
