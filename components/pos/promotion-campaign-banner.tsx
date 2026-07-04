"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface PromotionBannerData {
  id: string
  name: string
  icon: string | null
  color: string | null
  headline: string
  subline: string | null
  endsAt: string | null
  priority: number
}

function formatCountdown(endsAt: string | null): string | null {
  if (!endsAt) return null
  const end = new Date(endsAt).getTime()
  const diff = end - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function PromotionCampaignBanner({
  banner,
  className,
}: {
  banner: PromotionBannerData | null
  className?: string
}) {
  const [countdown, setCountdown] = useState<string | null>(null)

  useEffect(() => {
    if (!banner?.endsAt) {
      setCountdown(null)
      return
    }
    const tick = () => setCountdown(formatCountdown(banner.endsAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [banner?.endsAt])

  if (!banner) return null

  const bg = banner.color || "#f59e0b"

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-white shadow-sm",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${bg} 0%, color-mix(in srgb, ${bg} 75%, #000) 100%)` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide flex items-center gap-2">
            <span>{banner.icon || "🔥"}</span>
            <span>{banner.headline}</span>
          </p>
          {banner.subline && (
            <p className="text-xs opacity-90 mt-0.5">{banner.subline}</p>
          )}
        </div>
        {countdown && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide opacity-80">Ends in</p>
            <p className="text-lg font-mono font-bold tabular-nums">{countdown}</p>
          </div>
        )}
      </div>
    </div>
  )
}
