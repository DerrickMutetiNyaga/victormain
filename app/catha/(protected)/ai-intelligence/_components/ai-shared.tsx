'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, ArrowRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

export function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
    high: { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-400', label: 'High' },
    medium: { bg: 'bg-yellow-100 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-400', label: 'Medium' },
    low: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', label: 'Low' },
  }
  const c = config[severity] || config.low
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', c.bg, c.text)}>
      {severity === 'critical' && <AlertCircle className="h-3 w-3" />}
      {severity === 'high' && <AlertTriangle className="h-3 w-3" />}
      {severity === 'medium' && <Info className="h-3 w-3" />}
      {severity === 'low' && <CheckCircle className="h-3 w-3" />}
      {c.label}
    </span>
  )
}

export function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    profit: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    revenue: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
    cost: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    operations: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    data: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    retention: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', colors[impact] || colors.operations)}>
      {impact}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    increase: 'bg-emerald-100 text-emerald-700',
    reduce: 'bg-orange-100 text-orange-700',
    promote: 'bg-indigo-100 text-indigo-700',
    fix: 'bg-red-100 text-red-700',
    monitor: 'bg-slate-100 text-slate-700',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', colors[type] || colors.monitor)}>
      {type}
    </span>
  )
}

export function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  )
}

export function ScoreGauge({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'
  const bgColor = score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-red-500'
  const dims = { sm: { w: 56, r: 22, sw: 4 }, md: { w: 80, r: 32, sw: 5 }, lg: { w: 120, r: 48, sw: 6 } }
  const d = dims[size]
  const circumference = 2 * Math.PI * d.r
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: d.w, height: d.w }}>
        <svg className="transform -rotate-90" width={d.w} height={d.w}>
          <circle cx={d.w / 2} cy={d.w / 2} r={d.r} fill="none" className="stroke-muted/30" strokeWidth={d.sw} />
          <circle cx={d.w / 2} cy={d.w / 2} r={d.r} fill="none" className={bgColor} strokeWidth={d.sw}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', color, size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm')}>{score}</span>
        </div>
      </div>
      <span className={cn('text-muted-foreground font-medium text-center', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{label}</span>
    </div>
  )
}

export function TrendIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600"><TrendingUp className="h-3 w-3" />+{value}{suffix}</span>
  if (value < 0) return <span className="inline-flex items-center gap-0.5 text-xs text-red-600"><TrendingDown className="h-3 w-3" />{value}{suffix}</span>
  return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0{suffix}</span>
}

export function AISection({ id, title, icon: Icon, children, className, defaultOpen = true }: {
  id: string; title: string; icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode; className?: string; defaultOpen?: boolean
}) {
  return (
    <section id={id} className={cn('rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden', className)}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 bg-muted/20">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
      <div className="text-center">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
        <p>{message}</p>
      </div>
    </div>
  )
}

export function StatCard({ title, value, subtitle, trend, className }: {
  title: string; value: string | number; subtitle?: string; trend?: number; className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border/50 bg-card p-4 shadow-sm', className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {trend !== undefined && <TrendIndicator value={trend} />}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
