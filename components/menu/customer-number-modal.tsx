"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Phone } from "lucide-react"
import { ShopPhoneOtpForm } from "@/components/ecommerce/shop-phone-otp-form"

interface CustomerNumberModalProps {
  open: boolean
  onContinue: (customerNumber: string) => void
}

export function CustomerNumberModal({
  open,
  onContinue,
}: CustomerNumberModalProps) {
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
              Enter your phone number to receive a verification code by SMS. Then enter the code to track your orders.
            </DialogDescription>
          </DialogHeader>

          <ShopPhoneOtpForm
            variant="menu"
            establishSession={false}
            resetKey={open}
            onSuccess={(phone) => {
              onContinue(phone)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
