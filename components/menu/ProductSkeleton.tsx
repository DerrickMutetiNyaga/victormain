"use client"

import React from "react"

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden animate-pulse">
      <div className="aspect-[4/5] bg-slate-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-5 bg-slate-200 rounded w-1/3 mt-3" />
      </div>
    </div>
  )
}
