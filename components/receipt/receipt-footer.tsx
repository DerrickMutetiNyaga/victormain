"use client"

import { cn } from "@/lib/utils"

interface ReceiptFooterProps {
  orderId: string
  showQRCode?: boolean
  className?: string
}

export function ReceiptFooter({
  orderId,
  showQRCode = false,
  className,
}: ReceiptFooterProps) {
  const printedAt = new Date().toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className={cn("pt-4 border-t border-dashed border-[#e5e7eb] text-center", className)}>
      {/* QR Code (optional) */}
      {showQRCode && (
        <div className="flex justify-center mb-4">
          <div className="p-2 bg-white border border-[#e5e7eb] rounded-lg">
            {/* Simple QR code placeholder - in production use a QR library */}
            <svg
              className="h-16 w-16"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* QR Code pattern - simplified representation */}
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="25" height="25" fill="#0f172a" />
              <rect x="13" y="13" width="19" height="19" fill="white" />
              <rect x="16" y="16" width="13" height="13" fill="#0f172a" />
              <rect x="65" y="10" width="25" height="25" fill="#0f172a" />
              <rect x="68" y="13" width="19" height="19" fill="white" />
              <rect x="71" y="16" width="13" height="13" fill="#0f172a" />
              <rect x="10" y="65" width="25" height="25" fill="#0f172a" />
              <rect x="13" y="68" width="19" height="19" fill="white" />
              <rect x="16" y="71" width="13" height="13" fill="#0f172a" />
              {/* Data pattern */}
              <rect x="40" y="10" width="5" height="5" fill="#0f172a" />
              <rect x="50" y="10" width="5" height="5" fill="#0f172a" />
              <rect x="40" y="20" width="5" height="5" fill="#0f172a" />
              <rect x="45" y="25" width="5" height="5" fill="#0f172a" />
              <rect x="50" y="20" width="5" height="5" fill="#0f172a" />
              <rect x="40" y="40" width="5" height="5" fill="#0f172a" />
              <rect x="45" y="45" width="5" height="5" fill="#0f172a" />
              <rect x="50" y="40" width="5" height="5" fill="#0f172a" />
              <rect x="55" y="45" width="5" height="5" fill="#0f172a" />
              <rect x="65" y="40" width="5" height="5" fill="#0f172a" />
              <rect x="70" y="45" width="5" height="5" fill="#0f172a" />
              <rect x="75" y="40" width="5" height="5" fill="#0f172a" />
              <rect x="80" y="45" width="5" height="5" fill="#0f172a" />
              <rect x="85" y="40" width="5" height="5" fill="#0f172a" />
              <rect x="40" y="65" width="5" height="5" fill="#0f172a" />
              <rect x="45" y="70" width="5" height="5" fill="#0f172a" />
              <rect x="50" y="65" width="5" height="5" fill="#0f172a" />
              <rect x="55" y="70" width="5" height="5" fill="#0f172a" />
              <rect x="65" y="65" width="5" height="5" fill="#0f172a" />
              <rect x="70" y="70" width="5" height="5" fill="#0f172a" />
              <rect x="75" y="75" width="5" height="5" fill="#0f172a" />
              <rect x="80" y="80" width="5" height="5" fill="#0f172a" />
              <rect x="85" y="85" width="5" height="5" fill="#0f172a" />
            </svg>
          </div>
        </div>
      )}

      {/* Thank You Message */}
      <p className="text-sm font-semibold text-[#0f172a]">
        Thank you for your order!
      </p>
      <p className="text-xs text-[#64748b] mt-1">
        We appreciate your business
      </p>

      {/* Printed Timestamp */}
      <p className="text-[10px] text-[#94a3b8] mt-3">
        Printed: {printedAt}
      </p>

      {/* Powered By (optional) */}
      <p className="text-[9px] text-[#cbd5e1] mt-2 print:hidden">
        Powered by Infusion POS
      </p>
    </div>
  )
}

