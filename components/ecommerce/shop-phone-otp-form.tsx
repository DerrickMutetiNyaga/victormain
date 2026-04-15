"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Loader2, ShieldCheck, Sparkles, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { cn } from "@/lib/utils"

export type ShopPhoneOtpFormVariant = "account" | "cart" | "modal" | "menu"

function localDigits(raw: string): string {
  let v = raw.trim().replace(/^\+/, "")
  if (v.startsWith("254")) v = v.slice(3)
  if (v.startsWith("0")) v = v.slice(1)
  return v.replace(/\D/g, "").slice(0, 9)
}

function displayDigits(d: string) {
  return d.replace(/(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) =>
    c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a
  )
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "")
  const tail = d.slice(-4)
  return tail ? `+254 ••• ••• ${tail}` : phone
}

export interface ShopPhoneOtpFormProps {
  variant: ShopPhoneOtpFormVariant
  /** When true, sets the shop session cookie (e-commerce). When false, only verifies ownership of the number (e.g. menu). */
  establishSession: boolean
  onSuccess: (phone: string, meta?: { isNew?: boolean }) => void
  className?: string
  /** When this value changes, the flow resets to the phone step (e.g. pass dialog `open` so each open starts fresh). */
  resetKey?: string | number | boolean
}

export function ShopPhoneOtpForm({
  variant,
  establishSession,
  onSuccess,
  className,
  resetKey,
}: ShopPhoneOtpFormProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [digits, setDigits] = useState("")
  const [otpValue, setOtpValue] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resendSec, setResendSec] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const isLounge = variant === "account" || variant === "modal"
  const isCart = variant === "cart"
  const isMenu = variant === "menu"

  const fullPhone = `+254${digits}`
  const phoneValid = digits.length === 9
  const otpComplete = otpValue.length === 6

  useEffect(() => {
    setStep("phone")
    setDigits("")
    setOtpValue("")
    setError("")
    setResendSec(0)
  }, [resetKey])

  useEffect(() => {
    if (step === "phone") {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [step, resetKey])

  useEffect(() => {
    if (resendSec <= 0) return
    const t = setInterval(() => setResendSec((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendSec])

  const startResendCooldown = useCallback(() => {
    setResendSec(60)
  }, [])

  const resetToPhone = () => {
    setStep("phone")
    setOtpValue("")
    setError("")
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneValid) {
      setError(isMenu ? "Enter a valid Kenyan number" : "Enter all 9 digits after +254")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/ecommerce/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Could not send code. Try again.")
        return
      }
      setStep("otp")
      setOtpValue("")
      startResendCooldown()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpComplete) {
      setError("Enter the 6-digit code from SMS")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/ecommerce/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          otp: otpValue,
          establishSession,
        }),
        credentials: establishSession ? "include" : "same-origin",
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Verification failed")
        return
      }
      setDigits("")
      setOtpValue("")
      setStep("phone")
      onSuccess(data.phone || fullPhone, establishSession ? { isNew: data.isNew } : undefined)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendSec > 0 || loading || !phoneValid) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/ecommerce/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Could not resend code")
        return
      }
      startResendCooldown()
      setOtpValue("")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const loungeInputWrap = (err: boolean, valid: boolean) =>
    cn(
      "flex items-center rounded-xl border-2 transition-all overflow-hidden",
      err && "border-red-400",
      !err &&
        isLounge &&
        (valid
          ? "border-[#9f7a43] bg-[#fffaf3] shadow-sm shadow-[#8f6a2f]/10"
          : "border-[#ddccb4] focus-within:border-[#9f7a43] focus-within:bg-[#fffaf3] bg-[#fffdf8]"),
      !err &&
        isCart &&
        (valid
          ? "border-[#5b6a5a] shadow-sm shadow-[#5b6a5a]/10 bg-[#fffdf8]"
          : "border-[#d6cfc2] focus-within:border-[#5b6a5a] bg-[#fffdf8]"),
      !err &&
        isMenu &&
        (valid
          ? "border-amber-500/50 bg-white/[0.09]"
          : "border-white/[0.10] focus-within:border-amber-500/40 bg-white/[0.07]")
    )

  const prefixClass = cn(
    "flex items-center justify-center border-r py-3.5 shrink-0 px-3",
    isLounge && "w-[72px] sm:w-[78px] border-[#dfcfb9] bg-gradient-to-b from-[#f7eddd] to-[#f2e4cf]",
    isCart && "w-[72px] sm:w-[78px] border-[#d7d0c2] bg-gradient-to-b from-[#f3efe7] to-[#ece6dc]",
    isMenu && "w-14 border-white/[0.10] bg-white/[0.05]"
  )

  const prefixText = cn(
    "text-[14px] sm:text-base font-bold tracking-wide select-none",
    isLounge && "text-[#8a6330]",
    isCart && "text-[#4f5f50]",
    isMenu && "text-amber-400/90"
  )

  const inputClass = cn(
    "flex-1 min-w-0 bg-transparent py-3.5 sm:py-4 pl-2.5 sm:pl-3 pr-2 text-[15px] sm:text-base font-medium outline-none disabled:opacity-60",
    isLounge && "text-[#2a201b] placeholder:text-[#9a8a78]",
    isCart && "text-[#251f1a] placeholder:text-[#8d877f]",
    isMenu && "text-white placeholder:text-white/25"
  )

  const labelClass = cn(
    "text-sm font-bold",
    isLounge && "text-[#3a2d25]",
    isCart && "text-[#2e2621]",
    isMenu && "text-white/90"
  )

  const hintClass = cn("text-xs pl-1", isLounge && "text-[#8f7f6e]", isCart && "text-[#6f6a62]", isMenu && "text-white/35")

  const cardWrap = cn(
    "space-y-2 rounded-2xl border p-3.5 sm:p-4 shadow-[0_10px_22px_rgba(48,30,18,0.08)]",
    isLounge && "border-[#deceb9] bg-[#fffaf2]/90",
    isCart && "border-[#d6d0c4] bg-[#fffdf8]/90 shadow-[0_10px_22px_rgba(35,28,20,0.07)]",
    isMenu && "border-white/[0.08] bg-white/[0.04]"
  )

  const primaryButtonClass = cn(
    "w-full h-12 sm:h-13 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-45",
    isLounge &&
      "bg-gradient-to-r from-[#2f241e] via-[#3b2c24] to-[#281f1a] text-[#f8ecd6] hover:from-[#3a2b22] hover:via-[#48362b] hover:to-[#30251f] shadow-lg shadow-[#2b2019]/28 border border-[#7d5f37]/55",
    isCart &&
      "bg-gradient-to-r from-[#3d4a3e] via-[#4a5a4c] to-[#354038] text-[#f4f7f3] hover:from-[#485647] hover:via-[#556656] hover:to-[#3e4a40] shadow-lg shadow-[#2b3428]/25 border border-[#5d6e5f]/50",
    isMenu && "bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold border-0 shadow-lg shadow-amber-900/20"
  )

  if (step === "phone") {
    return (
      <form onSubmit={handleSendCode} className={cn("space-y-3.5", className)}>
        <div className={cardWrap}>
          <Label className={labelClass}>Phone number</Label>
          <div className={loungeInputWrap(!!error, phoneValid)}>
            <div className={prefixClass}>
              <span className={prefixText}>+254</span>
            </div>
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              placeholder={isMenu ? "7XX XXX XXX" : "712 345 678"}
              value={displayDigits(digits)}
              onChange={(e) => {
                setDigits(localDigits(e.target.value))
                setError("")
              }}
              onPaste={(e) => {
                e.preventDefault()
                setDigits(localDigits(e.clipboardData.getData("text")))
                setError("")
              }}
              disabled={loading}
              autoComplete="tel"
              className={inputClass}
            />
            {digits.length > 0 && !phoneValid && (
              <span className={cn("pr-3 text-xs shrink-0", isMenu ? "text-white/35" : "text-[#9a8a78]")}>
                {digits.length}/9
              </span>
            )}
          </div>
          {error ? (
            <p className="text-red-500 text-xs font-medium pl-1">{error}</p>
          ) : (
            <p className={hintClass}>
              {isMenu
                ? "We will send a verification code by SMS"
                : "Kenya only · we will SMS a 6-digit code"}
            </p>
          )}
        </div>

        <Button type="submit" disabled={!phoneValid || loading} className={primaryButtonClass}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </span>
          ) : (
            "Send verification code"
          )}
        </Button>

        {(variant === "account" || variant === "cart") && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
            <span className={cn("flex items-center gap-1.5 text-[10.5px]", isLounge && "text-[#8f7f6e]", isCart && "text-[#7a756d]")}>
              <ShieldCheck className={cn("h-3.5 w-3.5", isLounge && "text-[#8f6a2f]", isCart && "text-[#4f5f50]")} />
              SMS verification
            </span>
            <span className={cn("hidden h-3 w-px sm:block", isLounge && "bg-[#ded0be]", isCart && "bg-[#cfc7bc]")} />
            <span className={cn("flex items-center gap-1.5 text-[10.5px]", isLounge && "text-[#8f7f6e]", isCart && "text-[#7a756d]")}>
              <Phone className={cn("h-3.5 w-3.5", isLounge && "text-[#8f6a2f]", isCart && "text-[#4f5f50]")} />
              Kenya only
            </span>
          </div>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className={cn("space-y-3.5", className)}>
      <div className={cardWrap}>
        <Label className={labelClass}>Enter code</Label>
        <p className={cn("text-xs mb-2", isMenu ? "text-white/45" : "text-[#6f5d4f]")}>
          Sent to {maskPhone(fullPhone)}
        </p>
        <div className="flex justify-center py-1">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={(v) => {
              setOtpValue(v)
              setError("")
            }}
            disabled={loading}
            containerClassName="gap-1.5 sm:gap-2"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className={cn(
                    "h-11 w-9 sm:h-12 sm:w-10 text-base font-semibold rounded-lg",
                    isLounge && "border-[#ddccb4] bg-[#fffdf8] text-[#2a201b] data-[active=true]:ring-[#9f7a43]/35",
                    isCart && "border-[#d6cfc2] bg-[#fffdf8] text-[#251f1a] data-[active=true]:ring-[#5b6a5a]/35",
                    isMenu && "border-white/15 bg-white/[0.07] text-white data-[active=true]:ring-amber-500/30"
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}
      </div>

      <Button type="submit" disabled={!otpComplete || loading} className={primaryButtonClass}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying…
          </span>
        ) : (
          "Verify and continue"
        )}
      </Button>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
        <button
          type="button"
          className={cn(
            "font-medium underline-offset-2 hover:underline disabled:opacity-40",
            isMenu ? "text-amber-400/90" : "text-[#8a6330]"
          )}
          onClick={resetToPhone}
          disabled={loading}
        >
          Change number
        </button>
        <button
          type="button"
          className={cn(
            "font-medium disabled:opacity-40",
            resendSec > 0 ? (isMenu ? "text-white/35" : "text-[#9a8a78]") : isMenu ? "text-amber-400/90 underline" : "text-[#8a6330] underline"
          )}
          onClick={() => void handleResend()}
          disabled={loading || resendSec > 0}
        >
          {resendSec > 0 ? `Resend code (${resendSec}s)` : "Resend code"}
        </button>
      </div>

      {(variant === "account" || variant === "cart") && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1">
          <span className={cn("flex items-center gap-1.5 text-[10.5px]", isLounge && "text-[#8f7f6e]", isCart && "text-[#7a756d]")}>
            <Sparkles className={cn("h-3.5 w-3.5", isLounge && "text-[#8f6a2f]", isCart && "text-[#4f5f50]")} />
            Code expires in 10 min
          </span>
        </div>
      )}
    </form>
  )
}
