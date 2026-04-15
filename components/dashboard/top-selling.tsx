"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { topSellingItems as defaultItems, products as defaultProducts } from "@/lib/dummy-data"
import { TrendingUp } from "lucide-react"

interface TopSellingProps {
  items?: { id: string; name: string; sales: number; quantity: number }[]
  products?: { id: string; name: string; image?: string }[]
}

export function TopSelling({ items = defaultItems, products = defaultProducts }: TopSellingProps) {
  const topSellingItems = items?.length ? items : defaultItems
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 md:pb-3 px-4 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold text-card-foreground">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Top Selling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 px-4 md:px-6">
        {topSellingItems.map((item, index) => {
          const product = products.find((p) => p.id === item.id)
          return (
            <div key={item.id} className="flex items-center gap-2 md:gap-3 rounded-lg bg-secondary/50 p-2 md:p-3">
              <div className="flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-primary/20 text-xs md:text-sm font-bold text-primary shrink-0">
                {index + 1}
              </div>
              <img
                src={product?.image || "/placeholder.svg?height=40&width=40&query=bottle"}
                alt={item.name}
                className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-card-foreground truncate">{item.name}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{item.quantity} sold</p>
              </div>
              <p className="text-xs md:text-sm font-semibold text-primary shrink-0">Ksh {item.sales.toLocaleString("en-KE")}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
