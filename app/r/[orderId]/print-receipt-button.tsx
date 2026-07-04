"use client"

import { Printer } from "lucide-react"

export function PrintReceiptButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-sm font-bold text-amber-100 transition hover:bg-stone-800 active:scale-[0.99] print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print receipt
    </button>
  )
}
