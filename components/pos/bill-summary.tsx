"use client"

import { type Product, staff } from "@/lib/dummy-data"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, Receipt } from "lucide-react"

interface CartItem extends Product {
  quantity: number
}

interface BillSummaryProps {
  items: CartItem[]
  selectedTable: number | null
  cashierId: string
  waiterId: string
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onCheckout: (method: string) => void
}

export function BillSummary({
  items,
  selectedTable,
  cashierId,
  waiterId,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: BillSummaryProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const vat = subtotal * 0.16
  const total = subtotal + vat

  const cashier = staff.find((s) => s.id === cashierId)
  const waiter = staff.find((s) => s.id === waiterId)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Current Order</h2>
            {selectedTable && <p className="text-sm text-muted-foreground">Table {selectedTable}</p>}
          </div>
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        {(cashier || waiter) && (
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            {cashier && <span>Cashier: {cashier.name}</span>}
            {waiter && <span>Waiter: {waiter.name}</span>}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">No items added yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg bg-secondary/50 p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Ksh {item.price} each</p>
                </div>
                <button onClick={() => onRemoveItem(item.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-secondary"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-secondary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  Ksh {(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-card-foreground">Ksh {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT (16%)</span>
            <span className="text-card-foreground">Ksh {vat.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span className="text-card-foreground">Total</span>
            <span className="text-primary">Ksh {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => onCheckout("cash")}
            disabled={items.length === 0}
            variant="outline"
            className="h-12 flex-col gap-1"
          >
            <Banknote className="h-5 w-5" />
            <span className="text-xs">Cash</span>
          </Button>
          <Button
            onClick={() => onCheckout("card")}
            disabled={items.length === 0}
            variant="outline"
            className="h-12 flex-col gap-1"
          >
            <CreditCard className="h-5 w-5" />
            <span className="text-xs">Card</span>
          </Button>
          <Button
            onClick={() => onCheckout("mobile")}
            disabled={items.length === 0}
            variant="outline"
            className="h-12 flex-col gap-1"
          >
            <Smartphone className="h-5 w-5" />
            <span className="text-xs">Mobile</span>
          </Button>
        </div>

        <Button
          onClick={() => onCheckout("card")}
          disabled={items.length === 0}
          className="w-full h-12 text-base font-semibold"
        >
          Complete Sale - Ksh {total.toFixed(2)}
        </Button>
      </div>
    </div>
  )
}
