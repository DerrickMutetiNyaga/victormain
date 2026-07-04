"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { lowStockItems as defaultItems, products as defaultProducts } from "@/lib/dummy-data"
import { AlertTriangle, ShoppingCart } from "lucide-react"

interface StockAlertsProps {
  items?: { id: string; name: string; stock: number; minStock: number; status: string }[]
  products?: { id: string; name: string; image?: string }[]
}

export function StockAlerts({ items = defaultItems, products = defaultProducts }: StockAlertsProps) {
  const lowStockItems = items?.length ? items : defaultItems
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 md:pb-3 px-4 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold text-card-foreground">
          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
          Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 px-4 md:px-6">
        {lowStockItems.map((item) => {
          const product = products.find((p) => p.id === item.id)
          return (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 md:p-3 gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <img
                  src={product?.image || "/placeholder.svg?height=40&width=40&query=bottle"}
                  alt={item.name}
                  className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-card-foreground truncate">{item.name}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    {item.stock} left • Min: {item.minStock}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                <Badge variant={item.status === "warning" ? "destructive" : "secondary"} className="text-[10px] md:text-xs px-1.5">
                  {item.status === "warning" ? "Critical" : "Low"}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 md:h-8 text-[10px] md:text-xs bg-transparent px-2 md:px-3 hidden sm:flex">
                  <ShoppingCart className="mr-1 h-3 w-3" />
                  Order
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
