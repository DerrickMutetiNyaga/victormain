"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { topSellingItems, products } from "@/lib/dummy-data"
import { Package } from "lucide-react"

export function ProductPerformance() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
          <Package className="h-5 w-5 text-primary" />
          Product Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Rank</TableHead>
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground text-right">Units Sold</TableHead>
              <TableHead className="text-muted-foreground text-right">Revenue</TableHead>
              <TableHead className="text-muted-foreground text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topSellingItems.map((item, index) => {
              const product = products.find((p) => p.id === item.id)
              const profit = product ? (product.price - product.cost) * item.quantity : 0

              return (
                <TableRow key={item.id} className="border-border">
                  <TableCell>
                    <Badge
                      variant={index < 3 ? "default" : "outline"}
                      className={index < 3 ? "bg-primary/20 text-primary" : ""}
                    >
                      #{index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={product?.image || "/placeholder.svg?height=32&width=32&query=bottle"}
                        alt={item.name}
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                      <span className="font-medium text-card-foreground">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-card-foreground">{item.quantity}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    Ksh {item.sales.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium text-chart-2">
                    Ksh {profit.toLocaleString()}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
