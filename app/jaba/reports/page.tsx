"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function ReportsPage() {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Production and distribution reports</p>
        </div>
      </header>

      <div className="p-6">
        <Card className="border-border bg-card max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Reports Coming Soon</h3>
            <p className="text-muted-foreground">
              Production reports, distribution analytics, and detailed insights will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
