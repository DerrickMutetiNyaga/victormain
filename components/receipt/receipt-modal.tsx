"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { X, Printer, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ReceiptHeader } from "./receipt-header"
import { ReceiptMeta } from "./receipt-meta"
import { ReceiptItems } from "./receipt-items"
import { ReceiptTotals } from "./receipt-totals"
import { ReceiptFooter } from "./receipt-footer"
import { formatKsh, formatDate, formatReceiptTime } from "@/lib/receipt-utils"

// Receipt order type
export interface ReceiptOrder {
  id: string
  timestamp: Date | string
  status: string
  table?: string | number
  customerName?: string
  customerPhone?: string | null
  waiter?: string
  cashier?: string
  paymentMethod?: string | null
  mpesaReceiptNumber?: string | null
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  subtotal?: number | null
  vat?: number | null
  total?: number | null
  cashAmount?: number | null
  cashBalance?: number | null
}

interface ReceiptModalProps {
  order: ReceiptOrder | null
  open: boolean
  onClose: () => void
  businessName?: string
  businessSubtitle?: string
  showQRCode?: boolean
}

export function ReceiptModal({
  order,
  open,
  onClose,
  businessName = "CATHA LODGE",
  businessSubtitle = "Restaurant & Bar",
  showQRCode = true,
}: ReceiptModalProps) {
  const printMode = "thermal" // 80mm only
  const [colorMode, setColorMode] = useState<"colored" | "bw">("colored")
  const [isPrinting, setIsPrinting] = useState(false)

  if (!order) return null

  const isPaid = order.status === "completed" || order.status === "PAID"

  const handlePrint = () => {
    setIsPrinting(true)

    // Use hidden iframe to avoid opening a new tab
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      return
    }

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${order.id}</title>
          <meta charset="UTF-8">
          <style>
            /* Print-friendly: heavier weights and readable font sizes for thermal/ink */
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, Verdana, sans-serif;
              font-size: 11px;
              font-weight: 600;
              background: #ffffff;
              color: #0f172a;
              line-height: 1.4;
              padding: 8px;
              max-width: 80mm;
              margin: 0 auto;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              ${colorMode === "bw" ? "filter: grayscale(100%); -webkit-filter: grayscale(100%);" : ""}
            }
            .receipt {
              background: #ffffff;
            }

            /* Header – bold titles */
            .receipt-header {
              text-align: center;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .business-name {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "13px" : "16px"};
              font-weight: 700;
              color: #0f172a;
            }
            .business-subtitle {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
            }
            .order-row {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin-top: 10px;
            }
            .order-id {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 700;
              background: #f1f5f9;
              padding: 4px 10px;
              border-radius: 4px;
            }
            .status-badge {
              font-family: Arial, Helvetica, sans-serif;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 4px 8px;
              border-radius: 9999px;
            }
            .status-paid { background: #dcfce7; color: #166534; }
            .status-pending { background: #e0e7ff; color: #3730a3; }
            .status-notpaid { background: #fee2e2; color: #991b1b; }
            .status-dot {
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: currentColor;
            }
            .datetime {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 600;
              color: #475569;
              margin-top: 8px;
              font-variant-numeric: tabular-nums;
            }

            /* Meta – semibold labels and values */
            .receipt-meta {
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px 16px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .meta-label {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 600;
              color: #475569;
            }
            .meta-value {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "11px" : "13px"};
              font-weight: 600;
              color: #0f172a;
              text-align: right;
            }
            .payment-badge {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .payment-cash { background: #ecfdf5; color: #065f46; }
            .payment-mpesa { background: #ede9fe; color: #5b21b6; }
            .payment-card { background: #dbeafe; color: #1e40af; }
            .mpesa-code {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 600;
              color: #475569;
            }

            /* Items – readable weights */
            .receipt-items {
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .items-title {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 8px 0;
              border-bottom: 1px dashed #e5e7eb;
            }
            .item-row:last-child {
              border-bottom: none;
            }
            .item-name {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 600;
              color: #0f172a;
            }
            .item-meta {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
              font-variant-numeric: tabular-nums;
            }
            .item-total {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 700;
              color: #0f172a;
              font-variant-numeric: tabular-nums;
              white-space: nowrap;
            }

            /* Totals – bold labels and values */
            .receipt-totals {
              padding: 12px 0;
            }
            .totals-block {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
            }
            .total-row {
              font-family: "Courier New", Courier, monospace;
              display: flex;
              justify-content: space-between;
              width: ${printMode === "thermal" ? "100%" : "180px"};
              font-size: ${printMode === "thermal" ? "11px" : "12px"};
              font-weight: 600;
              margin-bottom: 4px;
            }
            .total-label {
              font-family: Arial, Helvetica, sans-serif;
              font-weight: 600;
              color: #475569;
            }
            .total-value {
              font-family: "Courier New", Courier, monospace;
              font-weight: 600;
              color: #0f172a;
              font-variant-numeric: tabular-nums;
            }
            .total-divider {
              width: ${printMode === "thermal" ? "100%" : "180px"};
              border-top: 1px solid #0f172a;
              margin: 8px 0;
            }
            .total-final {
              display: flex;
              justify-content: space-between;
              width: ${printMode === "thermal" ? "100%" : "180px"};
            }
            .total-final-label {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "12px" : "13px"};
              font-weight: 700;
              color: #0f172a;
            }
            .total-final-value {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "13px" : "16px"};
              font-weight: 700;
              color: #0f172a;
              font-variant-numeric: tabular-nums;
            }
            .received-divider {
              width: ${printMode === "thermal" ? "100%" : "180px"};
              border-top: 1px dashed #e5e7eb;
              margin: 8px 0;
            }
            .change-value {
              font-family: "Courier New", Courier, monospace;
              color: #2563eb;
              font-weight: 700;
            }
            .due-label, .due-value {
              font-family: Arial, Helvetica, sans-serif;
              color: #991b1b;
              font-weight: 700;
            }

            /* Footer */
            .receipt-footer {
              padding-top: 12px;
              border-top: 1px dashed #e5e7eb;
              text-align: center;
            }
            .thank-you {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "12px" : "13px"};
              font-weight: 700;
              color: #0f172a;
            }
            .appreciate {
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${printMode === "thermal" ? "10px" : "11px"};
              font-weight: 600;
              color: #475569;
              margin-top: 4px;
            }
            .printed-at {
              font-family: "Courier New", Courier, monospace;
              font-size: ${printMode === "thermal" ? "10px" : "10px"};
              font-weight: 600;
              color: #475569;
              margin-top: 10px;
            }

            /* QR Code */
            .qr-container {
              display: flex;
              justify-content: center;
              margin-bottom: 12px;
            }
            .qr-code {
              width: ${printMode === "thermal" ? "48px" : "64px"};
              height: ${printMode === "thermal" ? "48px" : "64px"};
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 4px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <!-- Header -->
            <div class="receipt-header">
              <div class="business-name">${businessName}</div>
              ${businessSubtitle ? `<div class="business-subtitle">${businessSubtitle}</div>` : ""}
              <div class="order-row">
                <span class="order-id">#${order.id}</span>
                <span class="status-badge ${
                  isPaid ? "status-paid" : order.status === "pending" ? "status-pending" : "status-notpaid"
                }">
                  <span class="status-dot"></span>
                  ${isPaid ? "PAID" : order.status === "pending" ? "PENDING" : "NOT PAID"}
                </span>
              </div>
              <div class="datetime">${formatDate(order.timestamp)} • ${formatReceiptTime(order.timestamp)}</div>
            </div>

            <!-- Meta -->
            <div class="receipt-meta">
              <div class="meta-grid">
                <div class="meta-row">
                  <span class="meta-label">Table</span>
                  <span class="meta-value">${order.table ?? "—"}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Customer</span>
                  <span class="meta-value">${order.customerName || "Walk-in"}</span>
                </div>
                ${
                  order.customerPhone
                    ? `<div class="meta-row">
                        <span class="meta-label">Phone</span>
                        <span class="meta-value" style="font-family: ui-monospace, monospace; font-size: ${printMode === "thermal" ? "10px" : "11px"}; font-weight: 600;">${order.customerPhone}</span>
                      </div>`
                    : ""
                }
                <div class="meta-row">
                  <span class="meta-label">Server</span>
                  <span class="meta-value">${order.waiter || "—"}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Cashier</span>
                  <span class="meta-value">${order.cashier || "—"}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Payment</span>
                  <span class="payment-badge ${
                    order.paymentMethod?.toLowerCase() === "cash"
                      ? "payment-cash"
                      : order.paymentMethod?.toLowerCase() === "mpesa"
                      ? "payment-mpesa"
                      : "payment-card"
                  }">${order.paymentMethod || "—"}</span>
                </div>
                ${
                  order.paymentMethod?.toLowerCase() === "mpesa" && order.mpesaReceiptNumber
                    ? `<div class="meta-row">
                        <span class="meta-label">Receipt</span>
                        <span class="mpesa-code">${order.mpesaReceiptNumber}</span>
                      </div>`
                    : ""
                }
              </div>
            </div>

            <!-- Items -->
            <div class="receipt-items">
              <div class="items-title">Items</div>
              ${order.items
                .map(
                  (item) => `
                <div class="item-row">
                  <div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-meta">${item.quantity} × ${formatKsh(item.price)}</div>
                  </div>
                  <div class="item-total">${formatKsh((item.price ?? 0) * (item.quantity ?? 0))}</div>
                </div>
              `
                )
                .join("")}
            </div>

            <!-- Totals -->
            <div class="receipt-totals">
              <div class="totals-block">
                <div class="total-row">
                  <span class="total-label">Subtotal</span>
                  <span class="total-value">${formatKsh(order.subtotal)}</span>
                </div>
                <div class="total-row">
                  <span class="total-label">VAT (16%)</span>
                  <span class="total-value">${formatKsh(order.vat)}</span>
                </div>
                <div class="total-divider"></div>
                <div class="total-final">
                  <span class="total-final-label">TOTAL</span>
                  <span class="total-final-value">${formatKsh(order.total)}</span>
                </div>
                ${
                  isPaid && order.cashAmount != null && order.cashAmount > 0
                    ? `
                  <div class="received-divider"></div>
                  <div class="total-row">
                    <span class="total-label">Received</span>
                    <span class="total-value">${formatKsh(order.cashAmount)}</span>
                  </div>
                  ${
                    order.cashBalance != null && order.cashBalance > 0
                      ? `
                    <div class="total-row">
                      <span class="total-label">Change</span>
                      <span class="total-value change-value">${formatKsh(order.cashBalance)}</span>
                    </div>
                  `
                      : ""
                  }
                `
                    : ""
                }
                ${
                  !isPaid && order.total != null
                    ? `
                  <div class="total-row" style="margin-top: 8px;">
                    <span class="due-label">Amount Due</span>
                    <span class="due-value">${formatKsh(order.total)}</span>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Footer -->
            <div class="receipt-footer">
              ${
                showQRCode
                  ? `
                <div class="qr-container">
                  <svg class="qr-code" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" fill="white"/>
                    <rect x="10" y="10" width="25" height="25" fill="#0f172a"/>
                    <rect x="13" y="13" width="19" height="19" fill="white"/>
                    <rect x="16" y="16" width="13" height="13" fill="#0f172a"/>
                    <rect x="65" y="10" width="25" height="25" fill="#0f172a"/>
                    <rect x="68" y="13" width="19" height="19" fill="white"/>
                    <rect x="71" y="16" width="13" height="13" fill="#0f172a"/>
                    <rect x="10" y="65" width="25" height="25" fill="#0f172a"/>
                    <rect x="13" y="68" width="19" height="19" fill="white"/>
                    <rect x="16" y="71" width="13" height="13" fill="#0f172a"/>
                    <rect x="40" y="40" width="20" height="20" fill="#0f172a"/>
                    <rect x="44" y="44" width="12" height="12" fill="white"/>
                    <rect x="47" y="47" width="6" height="6" fill="#0f172a"/>
                  </svg>
                </div>
              `
                  : ""
              }
              <div class="thank-you">Thank you for your order!</div>
              <div class="appreciate">We appreciate your business</div>
              <div class="printed-at">Printed: ${new Date().toLocaleString("en-KE")}</div>
            </div>
          </div>
        </body>
      </html>
    `)

    doc.close()

    // Small delay to ensure content is rendered, then print
    setTimeout(() => {
      iframe.contentWindow?.print()
      // Remove iframe after print dialog closes (user confirms or cancels)
      setTimeout(() => {
        document.body.removeChild(iframe)
        setIsPrinting(false)
      }, 1000)
    }, 250)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[520px] w-full max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
        {/* Visually hidden title for screen readers */}
        <DialogTitle className="sr-only">Receipt for Order #{order.id}</DialogTitle>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-base font-semibold text-[#0f172a]">Receipt</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f1f5f9] transition-colors"
          >
            <X className="h-5 w-5 text-[#64748b]" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
          <div id="receipt-printable" className="space-y-0">
            <ReceiptHeader
              businessName={businessName}
              businessSubtitle={businessSubtitle}
              orderId={order.id}
              status={order.status}
              timestamp={order.timestamp}
            />

            <ReceiptMeta
              items={[
                { label: "Table", value: String(order.table ?? "—") },
                { label: "Customer", value: order.customerName || "Walk-in" },
                ...(order.customerPhone ? [{ label: "Phone", value: order.customerPhone }] : []),
                { label: "Server", value: order.waiter || "—" },
                { label: "Cashier", value: order.cashier || "—" },
              ]}
              paymentMethod={order.paymentMethod}
              mpesaReceiptCode={order.mpesaReceiptNumber}
            />

            <ReceiptItems items={order.items} />

            <ReceiptTotals
              subtotal={order.subtotal}
              vat={order.vat}
              total={order.total}
              amountReceived={order.cashAmount}
              change={order.cashBalance}
              isPaid={isPaid}
            />

            <ReceiptFooter orderId={order.id} showQRCode={showQRCode} />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col gap-3 px-5 py-4 border-t border-[#e5e7eb] bg-[#f8fafc]">
          <div className="flex items-center justify-between gap-4">
            {/* Format: 80mm only (no toggle) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b]">Format:</span>
              <span className="text-xs font-medium text-[#0f172a]">80mm</span>
            </div>
            {/* Color Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b]">Output:</span>
              <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden">
                <button
                  onClick={() => setColorMode("colored")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    colorMode === "colored"
                      ? "bg-[#0f172a] text-white"
                      : "bg-white text-[#64748b] hover:bg-[#f1f5f9]"
                  )}
                >
                  Color
                </button>
                <button
                  onClick={() => setColorMode("bw")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors border-l border-[#e5e7eb]",
                    colorMode === "bw"
                      ? "bg-[#0f172a] text-white"
                      : "bg-white text-[#64748b] hover:bg-[#f1f5f9]"
                  )}
                >
                  B&W
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium"
            >
              Close
            </Button>
            <Button
              onClick={handlePrint}
              disabled={isPrinting}
              className="h-9 px-4 text-sm font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

