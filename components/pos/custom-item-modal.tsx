"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Package, Banknote, Tag } from "lucide-react"

interface CustomItemModalProps {
  onAddItem: (name: string, price: number) => void
}

export function CustomItemModal({ onAddItem }: CustomItemModalProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")

  const handleSubmit = () => {
    if (name && price) {
      onAddItem(name, Number.parseFloat(price))
      setName("")
      setPrice("")
      setOpen(false)
    }
  }

  const presets = [
    { label: "Small", price: 500 },
    { label: "Medium", price: 1000 },
    { label: "Large", price: 1500 },
    { label: "Premium", price: 2500 },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button id="custom-item-trigger" className="hidden" />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Package className="h-5 w-5 text-accent" />
            </div>
            <div>
              <span className="text-lg font-bold">Add Custom Item</span>
              <p className="text-xs text-muted-foreground font-normal">Create a one-time menu item</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              Item Name
            </Label>
            <Input
              id="name"
              placeholder="e.g., Special Cocktail, Custom Mix..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
              Price
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold tracking-wide">
                Ksh
              </span>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-12 pl-16 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary text-lg font-bold"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Quick Presets</Label>
            <div className="grid grid-cols-4 gap-3">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setPrice(preset.price.toString())}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/70 bg-secondary/40 px-3 py-3.5 hover:bg-secondary hover:border-primary/60 transition-all text-center min-h-[88px]"
                >
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">
                    Ksh {preset.price.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12 bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !price} className="flex-1 h-12 font-bold gap-2">
            <Plus className="h-4 w-4" />
            Add to Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
