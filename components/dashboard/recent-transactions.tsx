"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { recentTransactions as defaultTransactions } from "@/lib/dummy-data"
import { Clock, CreditCard, Banknote } from "lucide-react"

interface RecentTransactionsProps {
  transactions?: { id: string; table: number; total: number; paymentMethod: string; cashier: string; timestamp: Date | string; status: string }[]
}

export function RecentTransactions({ transactions = defaultTransactions }: RecentTransactionsProps) {
  const list = transactions?.length ? transactions : defaultTransactions
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 md:pb-3 px-4 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold text-card-foreground">
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 px-4 md:px-6">
        {list.slice(0, 5).map((txn) => {
          const ts = txn.timestamp instanceof Date ? txn.timestamp : new Date(txn.timestamp)
          return (
          <div key={txn.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 md:p-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary/20 shrink-0">
                {txn.paymentMethod === "Card" ? (
                  <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                ) : (
                  <Banknote className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-card-foreground">Table {txn.table}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                  {ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} • {txn.cashier}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs md:text-sm font-semibold text-card-foreground">Ksh {Number(txn.total).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</p>
              <Badge variant="outline" className="text-[10px] md:text-xs text-chart-2 border-chart-2/30 px-1.5">
                {txn.status}
              </Badge>
            </div>
          </div>
        )})}
      </CardContent>
    </Card>
  )
}
