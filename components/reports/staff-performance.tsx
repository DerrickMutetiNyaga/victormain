"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { staff } from "@/lib/dummy-data"
import { TrendingUp } from "lucide-react"

export function StaffPerformance() {
  const salesStaff = staff.filter((s) => s.salesTotal > 0).sort((a, b) => b.salesTotal - a.salesTotal)
  const maxSales = Math.max(...salesStaff.map((s) => s.salesTotal))

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
          <TrendingUp className="h-5 w-5 text-primary" />
          Staff Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {salesStaff.map((member, index) => (
          <div key={member.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  {index < 3 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">Ksh {member.salesTotal.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{member.ordersCount} orders</p>
              </div>
            </div>
            <Progress value={(member.salesTotal / maxSales) * 100} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
