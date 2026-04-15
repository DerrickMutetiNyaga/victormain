"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function MenuTableRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const tableId = params?.id as string

  useEffect(() => {
    if (tableId) {
      router.replace(`/menu?t=${encodeURIComponent(tableId)}`)
    } else {
      router.replace("/menu")
    }
  }, [tableId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-500 text-sm">Redirecting...</div>
    </div>
  )
}
