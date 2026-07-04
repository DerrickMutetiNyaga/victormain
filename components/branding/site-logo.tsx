"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface SiteLogoProps {
  className?: string
  imageClassName?: string
  priority?: boolean
}

const LOGO_SRC = "/infusion_logo_2.png"

export function SiteLogo({
  className,
  imageClassName,
  priority = false,
}: SiteLogoProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={LOGO_SRC}
        alt="Infusion Jaba"
        fill
        priority={priority}
        sizes="(max-width: 640px) 160px, (max-width: 1024px) 240px, 300px"
        className={cn(
          "object-contain",
          // Compensates for extra vertical canvas space in the SVG export.
          "[transform:translateY(-2%)_scale(1.18)] [transform-origin:center]",
          imageClassName
        )}
      />
    </div>
  )
}

