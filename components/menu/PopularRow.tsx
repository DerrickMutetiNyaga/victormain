"use client"

import React, { memo, useRef, useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { MenuItem } from "@/types/menu"
import { ProductCard } from "./product-card"
import { motion } from "framer-motion"

interface PopularRowProps {
  items: MenuItem[]
  onItemClick: (item: MenuItem) => void
}

export const PopularRow = memo(function PopularRow({
  items,
  onItemClick,
}: PopularRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const scrollPosRef = useRef(0)
  const animFrameRef = useRef<number>()

  // Prefer Jaba items; fall back to first 10 products so the section is always visible
  const jabaItems = items.filter((i) => i.isJaba === true)
  const displayItems = jabaItems.length > 0 ? jabaItems : items.slice(0, 10)
  const isJabaMode = jabaItems.length > 0

  useEffect(() => {
    const el = scrollRef.current
    if (!el || displayItems.length === 0) return

    // Wait for content to mount before measuring
    const startAnim = () => {
      let lastTime = performance.now()

      const tick = (now: number) => {
        const delta = now - lastTime
        lastTime = now

        if (!isPaused && el) {
          const maxScroll = el.scrollWidth - el.clientWidth
          if (maxScroll > 0) {
            scrollPosRef.current += 0.6 * (delta / 16)
            if (scrollPosRef.current >= maxScroll) scrollPosRef.current = 0
            el.scrollLeft = scrollPosRef.current
          }
        }

        animFrameRef.current = requestAnimationFrame(tick)
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    const timeout = setTimeout(startAnim, 600)
    return () => {
      clearTimeout(timeout)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPaused, displayItems.length])

  if (displayItems.length === 0) return null

  return (
    <section className="pt-6 pb-4">
      {/* Redesigned section header */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(145deg, rgba(245,158,11,0.2) 0%, rgba(251,191,36,0.06) 100%)",
                border: "1px solid rgba(245,158,11,0.25)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Sparkles className="h-6 w-6 text-amber-400/90" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                Jaba Juice
              </h2>
              <p className="text-[13px] font-medium mt-1 text-amber-400/80">
                {isJabaMode ? "Special house selections" : "Our drinks selection"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 opacity-60" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 rounded-full bg-amber-400/80 animate-pulse"
                style={{
                  width: i === 1 ? "16px" : "8px",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scroll strip — container only; cards unchanged */}
      <div className="relative">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10"
          style={{ background: "linear-gradient(90deg, #0A0A0F 0%, transparent)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10"
          style={{ background: "linear-gradient(270deg, #0A0A0F 0%, transparent)" }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 pl-4 pr-4 sm:pl-5 sm:pr-5"
          style={{
            overflowX: "auto",
            flexWrap: "nowrap",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
        >
          {displayItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              style={{ width: "140px", flexShrink: 0 }}
              className="sm:w-[160px]"
            >
              <ProductCard
                item={item}
                onAdd={() => {}}
                onClick={onItemClick}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})
