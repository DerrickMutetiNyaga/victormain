/**
 * Receipt formatting utilities
 */

/**
 * Format money amount in Kenyan Shillings (always 2 decimals)
 * @example formatKsh(1160) -> "KSh 1,160.00"
 */
export function formatKsh(amount: number | null | undefined): string {
  if (amount == null) return "KSh 0.00"
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format date and time for receipts
 * @example formatDateTime(new Date()) -> "20 Feb 2026 • 19:03"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const dateStr = d.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeStr = d.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${dateStr} • ${timeStr}`
}

/**
 * Format just the date for receipts
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Format just the time for receipts
 */
export function formatReceiptTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Get readable status label and styling
 */
export function getReceiptStatus(status: string | null | undefined): {
  label: string
  bgClass: string
  textClass: string
} {
  if (!status) return { label: "PENDING", bgClass: "bg-[#e0e7ff]", textClass: "text-[#3730a3]" }
  
  const s = status.toUpperCase()
  
  if (s === "PAID" || s === "COMPLETED") {
    return { label: "PAID", bgClass: "bg-[#dcfce7]", textClass: "text-[#166534]" }
  }
  if (s === "NOT_PAID" || s === "FAILED" || s === "CANCELLED") {
    return { label: s === "CANCELLED" ? "CANCELLED" : "NOT PAID", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" }
  }
  
  return { label: "PENDING", bgClass: "bg-[#e0e7ff]", textClass: "text-[#3730a3]" }
}

/**
 * Get payment method styling
 */
export function getPaymentStyle(method: string | null | undefined): {
  label: string
  bgClass: string
  textClass: string
} {
  if (!method) return { label: "—", bgClass: "bg-gray-100", textClass: "text-gray-600" }
  
  const m = method.toUpperCase()
  
  if (m === "CASH") {
    return { label: "Cash", bgClass: "bg-[#ecfdf5]", textClass: "text-[#065f46]" }
  }
  if (m === "MPESA" || m === "M-PESA") {
    return { label: "M-Pesa", bgClass: "bg-[#ede9fe]", textClass: "text-[#5b21b6]" }
  }
  if (m === "CARD") {
    return { label: "Card", bgClass: "bg-[#dbeafe]", textClass: "text-[#1e40af]" }
  }
  
  return { label: method, bgClass: "bg-gray-100", textClass: "text-gray-600" }
}

