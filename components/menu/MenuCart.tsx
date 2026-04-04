"use client"

import React, { memo, useState, useEffect } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Minus, Trash2, Send } from "lucide-react"
import { CartItem } from "@/types/menu"
import Image from "next/image"

interface MenuCartProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  tableNumber?: string
  customerNumber?: string | null
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onSendNow: () => void
  onPayNow?: () => void
  total: number
}

const CartContent = memo(function CartContent({
  items,
  tableNumber,
  customerNumber,
  onUpdateQuantity,
  onRemove,
  onSendNow,
  onPayNow,
  total,
  onClose,
}: MenuCartProps & { onClose: () => void }) {
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <>
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3" />
            <p className="text-slate-600 font-medium text-sm">Your cart is empty</p>
            <p className="text-slate-400 text-xs mt-1">Add items to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100"
              >
                {item.image && (
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-white shrink-0">
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-emerald-600 font-medium">KES {item.unitPrice.toLocaleString()}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-slate-900">
                        KES {(item.unitPrice * item.quantity).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Total</span>
            <span className="text-lg font-semibold text-slate-900">KES {total.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-11 border-slate-200" onClick={onClose}>
              Continue
            </Button>
            <Button
              className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={onSendNow}
            >
              <Send className="h-4 w-4" />
              Send Now
            </Button>
          </div>
          {onPayNow && (
            <Button
              variant="ghost"
              className="w-full rounded-lg text-emerald-600 hover:bg-emerald-50"
              onClick={() => { onPayNow(); onClose(); }}
            >
              Pay Now
            </Button>
          )}
        </div>
      )}
    </>
  )
})

export const MenuCart = memo(function MenuCart(props: MenuCartProps) {
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const itemCount = props.items.reduce((s, i) => s + i.quantity, 0)

  if (isMobile) {
    return (
      <Drawer open={props.open} onOpenChange={props.onOpenChange}>
        <DrawerContent className="max-h-[88vh] rounded-t-2xl border-t border-slate-200 bg-white [&>div:first-child]:hidden">
          <DrawerHeader className="border-b border-slate-100 py-4 px-4">
            <DrawerTitle className="text-base font-semibold">
              Your order
              {props.tableNumber && (
                <span className="text-slate-500 font-normal ml-2">• Table {props.tableNumber}</span>
              )}
              {props.customerNumber && (
                <span className="text-slate-500 font-normal ml-2">• #{props.customerNumber}</span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <CartContent
            {...props}
            onClose={() => props.onOpenChange(false)}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="border-b border-slate-100 py-4 px-6">
          <SheetTitle className="text-base font-semibold">
            Your order
            {props.tableNumber && (
              <span className="text-slate-500 font-normal ml-2">• Table {props.tableNumber}</span>
            )}
            {props.customerNumber && (
              <span className="text-slate-500 font-normal ml-2">• #{props.customerNumber}</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <CartContent
          {...props}
          onClose={() => props.onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
})
