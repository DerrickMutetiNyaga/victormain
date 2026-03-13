import { Banknote, CreditCard, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

type PaymentMethod = "CASH" | "MPESA" | "CARD" | "OTHER"

interface PaymentBadgeProps {
  method: PaymentMethod | string | null | undefined
  className?: string
}

const paymentConfig: Record<string, { bg: string; text: string; icon: typeof Banknote; label: string }> = {
  cash: {
    bg: "bg-[#ecfdf5]",
    text: "text-[#065f46]",
    icon: Banknote,
    label: "Cash",
  },
  mpesa: {
    bg: "bg-[#ede9fe]",
    text: "text-[#5b21b6]",
    icon: Smartphone,
    label: "M-Pesa",
  },
  card: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: CreditCard,
    label: "Card",
  },
  other: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    icon: Banknote,
    label: "Other",
  },
}

export function PaymentBadge({ method, className }: PaymentBadgeProps) {
  const methodKey = (method || "other").toLowerCase()
  const config = paymentConfig[methodKey] || paymentConfig.other
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </span>
  )
}

