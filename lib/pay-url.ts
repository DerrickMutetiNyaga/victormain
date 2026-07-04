const DEFAULT_SITE = "https://www.infusionjaba.co.ke"

/** Public scan-to-pay URL for an order (QR target). */
export function getOrderPayUrl(orderId: string, baseUrl?: string): string {
  const base = (baseUrl || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || DEFAULT_SITE)
    .trim()
    .replace(/\/$/, "")
  const id = String(orderId || "").trim()
  return `${base}/pay/${encodeURIComponent(id)}`
}

export function getOrderReceiptUrl(orderId: string, baseUrl?: string): string {
  const base = (baseUrl || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || DEFAULT_SITE)
    .trim()
    .replace(/\/$/, "")
  const id = String(orderId || "").trim()
  return `${base}/r/${encodeURIComponent(id)}`
}
