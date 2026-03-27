/**
 * Format money amount in Kenyan Shillings
 */
export function formatMoneyKsh(amount: number | null | undefined): string {
  if (amount == null) return "—"
  return `KSh ${amount.toFixed(2)}`
}

/**
 * Format time from date
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
}

/**
 * Get payment status label: paid | partially paid | not paid
 */
export function getStatusLabel(status: string | null | undefined): "PAID" | "PARTIALLY_PAID" | "NOT_PAID" {
  if (!status) return "NOT_PAID"
  const s = status.toUpperCase()
  if (s === "PAID" || s === "COMPLETED") return "PAID"
  if (s === "PARTIALLY_PAID" || s === "PARTIAL") return "PARTIALLY_PAID"
  if (s === "NOT_PAID" || s === "FAILED") return "NOT_PAID"
  // PENDING = not paid
  return "NOT_PAID"
}

/**
 * Get user initials from name or email
 */
export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return "U"
}

