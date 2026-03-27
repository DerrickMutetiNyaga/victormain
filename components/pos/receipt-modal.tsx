"use client"

import { type Product, staff } from "@/lib/dummy-data"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Printer, Share2, Check, Download, Mail, Wifi, Usb, Bluetooth, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { printReceiptBrowser, printReceiptSerial, prepareReceiptData } from "@/lib/receipt-printer"
import { toast } from "sonner"

interface CartItem extends Product {
  quantity: number
}

interface ReceiptModalProps {
  open: boolean
  onClose: () => void
  items: CartItem[]
  table: number | null
  cashierId: string
  waiterId: string
  paymentMethod: string
  transactionId: string
  cashAmount?: number | null
  cashBalance?: number | null
  mpesaReceiptNumber?: string | null
  glovoOrderNumber?: string | null
}

export function ReceiptModal({
  open,
  onClose,
  items,
  table,
  cashierId,
  waiterId,
  paymentMethod,
  transactionId,
  cashAmount,
  cashBalance,
  mpesaReceiptNumber,
  glovoOrderNumber,
}: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrintOptions, setShowPrintOptions] = useState(false)
  const [hasSerialSupport, setHasSerialSupport] = useState(false)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true)

  // Check for Web Serial API support (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasSerialSupport('serial' in navigator)
      // Check if user has saved printer preference
      const savedFilter = localStorage.getItem('pos-printer-filter')
      setAutoPrintEnabled(!!savedFilter)
    }
  }, [])
  
  // Prices are VAT-inclusive in this app; do not add tax on top.
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const vat = 0
  const total = subtotal

  const cashier = staff.find((s) => s.id === cashierId)
  const waiter = staff.find((s) => s.id === waiterId)

  // Prepare receipt data
  const receiptData = prepareReceiptData(
    items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    transactionId,
    table,
    cashier?.name,
    waiter?.name,
    paymentMethod,
    subtotal,
    vat,
    total
  )

  // Print using browser print (USB/Bluetooth via system print)
  const handlePrintBrowser = () => {
    try {
      printReceiptBrowser(receiptData)
      toast.success("Print dialog opened", {
        description: "Select your printer from the print dialog",
      })
    } catch (error: any) {
      toast.error("Print failed", {
        description: error.message || "Failed to open print dialog",
      })
    }
  }

  // Print using Web Serial API (USB/Bluetooth direct)
  // Automatically detects and uses paired Bluetooth or connected USB printers
  const handlePrintSerial = async () => {
    setIsPrinting(true)
    try {
      // Auto-select printer if one was previously selected
      await printReceiptSerial(receiptData, { autoSelect: autoPrintEnabled })
      toast.success("Receipt printed", {
        description: "Receipt sent to printer successfully",
      })
      setAutoPrintEnabled(true) // Enable auto-print for next time
    } catch (error: any) {
      // If user cancelled, don't show error
      if (error.message?.includes('cancel') || error.message?.includes('Cancelled')) {
        setIsPrinting(false)
        return
      }
      
      toast.error("Print failed", {
        description: error.message || "Failed to print. Try browser print instead.",
        action: {
          label: "Try System Print",
          onClick: handlePrintBrowser,
        },
      })
    } finally {
      setIsPrinting(false)
    }
  }
  
  // Smart print - tries direct print first, falls back to system print
  const handleSmartPrint = async () => {
    if (hasSerialSupport) {
      // Try direct print first (USB/Bluetooth)
      try {
        await handlePrintSerial()
        return
      } catch (error) {
        // Fall back to system print
        console.log('Direct print failed, using system print')
      }
    }
    // Use system print as fallback
    handlePrintBrowser()
  }

  // Print using WiFi printer
  const handlePrintWiFi = async () => {
    setIsPrinting(true)
    try {
      const response = await fetch('/api/catha/print-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receiptData.items,
          transactionId: receiptData.transactionId,
          table: receiptData.table,
          cashier: receiptData.cashier,
          waiter: receiptData.waiter,
          paymentMethod: receiptData.paymentMethod,
          subtotal: receiptData.subtotal,
          vat: receiptData.vat,
          total: receiptData.total,
          // Optionally include printer IP if configured
          // printerIp: '192.168.1.100',
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        if (data.printerIp) {
          toast.success("Receipt sent to WiFi printer", {
            description: `Sent to ${data.printerIp}`,
          })
        } else {
          toast.success("Receipt data ready", {
            description: "Receipt formatted. Configure printer IP to send directly.",
          })
        }
      } else {
        throw new Error(data.error || 'Print failed')
      }
    } catch (error: any) {
      toast.error("WiFi print failed", {
        description: error.message || "Failed to send to WiFi printer",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] my-4">
        {/* Success Header */}
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-6 text-center relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent)]" />
          <div className="relative">
            <div className="mx-auto h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 animate-in zoom-in duration-300 shadow-lg">
              <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-xl">
                <Check className="h-8 w-8 text-emerald-600" strokeWidth={3} />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-white mb-1">Sale Completed</DialogTitle>
            <p className="text-sm text-white/90">Payment processed successfully</p>
          </div>
        </div>

        {/* Receipt - Scrollable */}
        <div className="bg-white p-6 overflow-y-auto flex-1 min-h-0">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">
            {/* Business Header */}
            <div className="text-center border-b border-gray-200 pb-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Catha Lounge</h3>
              <p className="text-sm text-gray-600 font-medium">Premium Bar & Lounge</p>
              <p className="text-xs text-gray-500 mt-1">123 Nightlife Ave, Downtown</p>
            </div>

            {/* Transaction Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm font-medium text-gray-600">Receipt #</span>
                <span className="font-mono font-bold text-base text-gray-900">{transactionId}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Time</span>
                  <span className="font-medium text-gray-900">
                    {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {table && (
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-600">Table</span>
                    <span className="font-semibold text-primary">Table {table}</span>
                  </div>
                )}
                {cashier && (
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-600">Cashier</span>
                    <span className="font-medium text-gray-900">{cashier.name}</span>
                  </div>
                )}
                {waiter && (
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-600">Served by</span>
                    <span className="font-medium text-gray-900">{waiter.name}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Items List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Items</h4>
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-md border border-gray-100">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{item.quantity}x</span>
                      <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium text-gray-500">Ksh</span>
                    <span className="text-base font-bold text-gray-900">
                      {(item.price * item.quantity).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="bg-gray-200" />

            {/* Totals */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-600">Subtotal</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-medium text-gray-500">Ksh</span>
                  <span className="text-base font-semibold text-gray-900">
                    {subtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {/* VAT is already included in item prices; no separate tax line */}
              <div className="flex justify-between items-center pt-3 pb-2 border-t-2 border-gray-300">
                <span className="text-lg font-bold text-gray-900 uppercase tracking-wide">Total</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-600">Ksh</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Payment Method */}
            <div className="text-center py-3 space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 capitalize">Paid via {paymentMethod}</span>
              </div>
              
              {/* Cash Payment Details */}
              {paymentMethod === 'cash' && cashAmount !== null && cashAmount !== undefined && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-md">
                    <span className="text-sm font-medium text-gray-600">Cash Received</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-medium text-gray-500">Ksh</span>
                      <span className="text-base font-semibold text-gray-900">
                        {cashAmount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {cashBalance !== null && cashBalance !== undefined && cashBalance > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 bg-green-50 rounded-md border border-green-200">
                      <span className="text-sm font-semibold text-green-700">Change/Balance</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-medium text-green-600">Ksh</span>
                        <span className="text-lg font-bold text-green-700">
                          {cashBalance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* M-Pesa Payment Details */}
              {paymentMethod === 'mpesa' && mpesaReceiptNumber && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center px-3 py-2 bg-purple-50 rounded-md border border-purple-200">
                    <span className="text-sm font-semibold text-purple-700">M-Pesa Receipt</span>
                    <span className="text-sm font-mono font-bold text-purple-900">
                      #{mpesaReceiptNumber}
                    </span>
                  </div>
                </div>
              )}
              {paymentMethod === 'glovo' && glovoOrderNumber && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-md border border-orange-200">
                    <span className="text-sm font-semibold text-orange-700">Glovo Order #</span>
                    <span className="text-sm font-mono font-bold text-orange-900">
                      {glovoOrderNumber}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Message */}
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium">Thank you for visiting!</p>
              <p className="text-xs text-gray-400 mt-1">Please drink responsibly</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-3 flex-shrink-0">
          {/* Primary Print Button */}
          {hasSerialSupport && (
            <Button
              onClick={handleSmartPrint}
              disabled={isPrinting}
              className="w-full h-11 font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </>
              )}
            </Button>
          )}
          
          {/* Print Options Grid */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={handlePrintBrowser}
              disabled={isPrinting}
              className="flex-col gap-1.5 h-16 bg-white hover:bg-gray-50 border-gray-200"
              title="System Print: Opens browser print dialog"
            >
              <Printer className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">System</span>
              <span className="text-[9px] text-gray-500">Any Printer</span>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintSerial}
              disabled={isPrinting}
              className="flex-col gap-1.5 h-16 bg-white hover:bg-gray-50 border-gray-200"
              title="Direct Print: USB/Bluetooth thermal printer"
            >
              {hasSerialSupport ? (
                <Usb className="h-4 w-4 text-gray-600" />
              ) : (
                <Bluetooth className="h-4 w-4 text-gray-600" />
              )}
              <span className="text-[10px] font-medium text-gray-700">Direct</span>
              <span className="text-[9px] text-gray-500">USB/BT</span>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintWiFi}
              disabled={isPrinting}
              className="flex-col gap-1.5 h-16 bg-white hover:bg-gray-50 border-gray-200"
              title="WiFi Print: Network thermal printer"
            >
              <Wifi className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">WiFi</span>
              <span className="text-[9px] text-gray-500">Network</span>
            </Button>
          </div>
          
          {/* Secondary Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="flex-col gap-1.5 h-14 bg-white hover:bg-gray-50 border-gray-200">
              <Download className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">Save</span>
            </Button>
            <Button variant="outline" className="flex-col gap-1.5 h-14 bg-white hover:bg-gray-50 border-gray-200">
              <Mail className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">Email</span>
            </Button>
            <Button variant="outline" className="flex-col gap-1.5 h-14 bg-white hover:bg-gray-50 border-gray-200">
              <Share2 className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">Share</span>
            </Button>
          </div>

          {/* New Sale Button */}
          <Button 
            className="w-full h-11 font-semibold bg-gray-900 hover:bg-gray-800 text-white mt-2" 
            onClick={onClose}
          >
            New Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
