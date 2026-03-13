"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">System configuration and preferences</p>
        </div>
      </header>

      <div className="p-6">
        <Card className="border-border bg-card max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Settings Coming Soon</h3>
            <p className="text-muted-foreground">
              System settings, user preferences, and configuration options will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
