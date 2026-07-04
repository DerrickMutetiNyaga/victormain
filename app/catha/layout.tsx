"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { useEffect } from "react"

export default function CathaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.title = "Catha Lounge | Restaurant & Bar"
  }, [])

  return (
    <div className="flex h-screen min-h-0 bg-background overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden pos-scroll xl:pl-64">
        {children}
      </main>
    </div>
  )
}
