'use client'

import {
  DollarSign, Package, Users, Activity, Clock, Truck, ShoppingBag,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3,
} from 'lucide-react'
import { AISection, ActionLink, EmptyState, SeverityBadge } from './ai-shared'
import { cn } from '@/lib/utils'

// ── Profit Intelligence ──
export function ProfitIntelligence({ data }: { data: any }) {
  return (
    <AISection id="profit-intelligence" title="PROFIT INTELLIGENCE" icon={DollarSign}>
      {data.profitWarning && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Profit Visibility Warning</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{data.profitWarning}</p>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataTable title="Top Revenue Products" items={data.topRevenue} columns={[
          { key: 'name', label: 'Product' },
          { key: 'revenue', label: 'Revenue', format: (v: number) => `KES ${v.toLocaleString()}` },
          { key: 'qty', label: 'Qty Sold' },
          { key: 'margin', label: 'Margin', format: (v: number | null) => v !== null ? `${v}%` : '—' },
        ]} emptyMsg="No sales data yet." />

        <DataTable title="High Margin Products" items={data.highMargin} columns={[
          { key: 'name', label: 'Product' },
          { key: 'margin', label: 'Margin', format: (v: number) => `${v}%` },
          { key: 'price', label: 'Sell', format: (v: number) => `KES ${v}` },
          { key: 'monthlySales', label: 'Monthly' },
        ]} emptyMsg="Add buying prices to see margin data." />

        {data.lowMarginHighSales.length > 0 && (
          <div className="md:col-span-2">
            <DataTable title="Low Margin but High Sales (Review Pricing)" items={data.lowMarginHighSales} columns={[
              { key: 'name', label: 'Product' },
              { key: 'margin', label: 'Margin', format: (v: number) => `${v}%` },
              { key: 'cost', label: 'Cost', format: (v: number) => `KES ${v}` },
              { key: 'price', label: 'Sell', format: (v: number) => `KES ${v}` },
              { key: 'monthlySales', label: 'Monthly' },
            ]} emptyMsg="No low-margin high-sellers found." />
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniStat label="Products with cost data" value={`${data.totalWithCostData}`} subtitle={`of ${data.missingCostCount + data.totalWithCostData} total`} />
        <MiniStat label="Missing buying price" value={`${data.missingCostCount}`} alert={data.missingCostCount > 0} />
        <MiniStat label="Missing selling price" value={`${data.missingPriceCount}`} alert={data.missingPriceCount > 0} />
      </div>
    </AISection>
  )
}

// ── Inventory Intelligence ──
export function InventoryIntelligence({ data }: { data: any }) {
  return (
    <AISection id="inventory-intelligence" title="INVENTORY INTELLIGENCE" icon={Package}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Low Stock" value={`${data.lowStockCount}`} alert={data.lowStockCount > 0} />
        <MiniStat label="Out of Stock" value={`${data.outOfStockCount}`} alert={data.outOfStockCount > 0} />
        <MiniStat label="Dead Stock" value={`${data.deadStock.length}`} />
        <MiniStat label="Total Products" value={`${data.totalProducts}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.restockNow.length > 0 && (
          <DataTable title="Restock Now (High Demand + Low Stock)" items={data.restockNow} columns={[
            { key: 'name', label: 'Product' },
            { key: 'stock', label: 'Stock' },
            { key: 'minStock', label: 'Min' },
            { key: 'recentDemand', label: '7d Sales' },
          ]} emptyMsg="No urgent restocking needed." severity="critical" />
        )}
        {data.overstock.length > 0 && (
          <DataTable title="Overstock Risk" items={data.overstock} columns={[
            { key: 'name', label: 'Product' },
            { key: 'stock', label: 'Stock' },
            { key: 'monthlySales', label: '30d Sales' },
          ]} emptyMsg="No overstock detected." severity="medium" />
        )}
        <DataTable title="Fast Movers (Top 10)" items={data.fastMovers} columns={[
          { key: 'name', label: 'Product' },
          { key: 'monthlySales', label: '30d Sales' },
          { key: 'revenue', label: 'Revenue', format: (v: number) => `KES ${v.toLocaleString()}` },
          { key: 'stock', label: 'Stock' },
        ]} emptyMsg="No sales data yet." />
        <DataTable title="Slow Movers" items={data.slowMovers} columns={[
          { key: 'name', label: 'Product' },
          { key: 'monthlySales', label: '30d Sales' },
          { key: 'stock', label: 'Stock' },
        ]} emptyMsg="All products are moving." />
        {data.deadStock.length > 0 && (
          <div className="md:col-span-2">
            <DataTable title="Dead Stock (No Sales in 30 Days)" items={data.deadStock.slice(0, 10)} columns={[
              { key: 'name', label: 'Product' },
              { key: 'stock', label: 'Stock' },
              { key: 'category', label: 'Category' },
            ]} emptyMsg="No dead stock." severity="medium" />
          </div>
        )}
      </div>
    </AISection>
  )
}

// ── Client Intelligence ──
export function ClientIntelligence({ data }: { data: any }) {
  return (
    <AISection id="client-intelligence" title="CLIENT INTELLIGENCE" icon={Users}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Total Clients" value={`${data.totalClients}`} />
        <MiniStat label="Repeat Customers" value={`${data.repeatCustomers}`} />
        <MiniStat label="Repeat Rate" value={`${data.repeatRate}%`} />
        <MiniStat label="Avg Spend" value={`KES ${data.avgSpendPerClient.toLocaleString()}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataTable title="High-Value Clients" items={data.highValueClients} columns={[
          { key: 'name', label: 'Client' },
          { key: 'visits', label: 'Visits' },
          { key: 'spend', label: 'Total Spend', format: (v: number) => `KES ${v.toLocaleString()}` },
        ]} emptyMsg="No client data yet." />
        {data.inactiveClients.length > 0 && (
          <DataTable title="Inactive Repeat Customers (Win Back)" items={data.inactiveClients} columns={[
            { key: 'name', label: 'Client' },
            { key: 'visits', label: 'Visits' },
            { key: 'spend', label: 'Spent', format: (v: number) => `KES ${v.toLocaleString()}` },
          ]} emptyMsg="No inactive customers." severity="medium" />
        )}
      </div>
    </AISection>
  )
}

// ── Operations & Error Intelligence ──
export function OperationsIntelligence({ data }: { data: any }) {
  return (
    <AISection id="operations-intelligence" title="OPERATIONS & ERROR INTELLIGENCE" icon={Activity}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Cancel Rate" value={`${data.cancelRate}%`} alert={data.cancelRate > 5} />
        <MiniStat label="Edit Rate" value={`${data.editRate}%`} alert={data.editRate > 15} />
        <MiniStat label="Manual Adjustments" value={`${data.manualAdjustments}`} alert={data.manualAdjustments > 10} />
        <MiniStat label="Total Orders (30d)" value={`${data.totalOrders}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Payment Methods Distribution</h4>
          {data.paymentMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payment data.</p>
          ) : (
            <div className="space-y-2">
              {data.paymentMethods.map((pm: any) => {
                const total = data.paymentMethods.reduce((s: number, p: any) => s + p.count, 0)
                const pct = total > 0 ? Math.round((pm.count / total) * 100) : 0
                return (
                  <div key={pm.method} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-20 truncate">{pm.method}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{pm.count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/40 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Operational Health Indicators</h4>
          <div className="space-y-3">
            <HealthRow label="Order Cancellation" value={data.cancelRate} threshold={5} unit="%" />
            <HealthRow label="Order Edits" value={data.editRate} threshold={15} unit="%" />
            <HealthRow label="Manual Stock Adjustments" value={data.manualAdjustments} threshold={10} unit="" />
            <HealthRow label="Cancelled Orders" value={data.cancelledCount} threshold={5} unit="" />
          </div>
        </div>
      </div>
    </AISection>
  )
}

// ── Timing & Peak Hours Intelligence ──
export function PeakHoursIntelligence({ data }: { data: any }) {
  const maxOrders = Math.max(...data.hourlyDistribution.map((h: any) => h.orders), 1)

  return (
    <AISection id="peak-hours" title="TIMING & PEAK HOURS INTELLIGENCE" icon={Clock}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-border/40 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Peak Hours</h4>
          {data.peakHours.length === 0 ? (
            <p className="text-xs text-muted-foreground">No peak hour data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.peakHours.map((h: any, i: number) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className={cn('text-xs font-bold w-6', i === 0 ? 'text-primary' : 'text-muted-foreground')}>#{i + 1}</span>
                  <span className="text-sm font-medium text-foreground w-14">{h.hour}</span>
                  <span className="text-xs text-muted-foreground">{h.orders} orders</span>
                  <span className="text-xs text-muted-foreground">KES {h.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/40 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Busiest Days</h4>
          {data.peakDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">No daily data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.peakDays.map((d: any, i: number) => (
                <div key={d.day} className="flex items-center gap-3">
                  <span className={cn('text-xs font-bold w-6', i === 0 ? 'text-primary' : 'text-muted-foreground')}>#{i + 1}</span>
                  <span className="text-sm font-medium text-foreground w-20">{d.day}</span>
                  <span className="text-xs text-muted-foreground">{d.orders} orders</span>
                  <span className="text-xs text-muted-foreground">KES {d.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hourly Heatmap */}
      <div className="rounded-xl border border-border/40 p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Hourly Order Distribution (30 Days)</h4>
        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
          {data.hourlyDistribution.map((h: any) => {
            const intensity = maxOrders > 0 ? h.orders / maxOrders : 0
            return (
              <div key={h.hour} className="relative group">
                <div
                  className={cn(
                    'h-8 rounded-sm transition-colors',
                    intensity === 0 ? 'bg-muted/30' :
                    intensity < 0.25 ? 'bg-emerald-100 dark:bg-emerald-950' :
                    intensity < 0.5 ? 'bg-emerald-300 dark:bg-emerald-800' :
                    intensity < 0.75 ? 'bg-emerald-500 dark:bg-emerald-600' :
                    'bg-emerald-700 dark:bg-emerald-400'
                  )}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="rounded-lg bg-popover border border-border px-2 py-1 shadow-lg text-[10px] whitespace-nowrap">
                    <p className="font-medium">{h.hour}</p>
                    <p>{h.orders} orders · KES {h.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded-sm bg-muted/30" />
            <div className="h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-950" />
            <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-800" />
            <div className="h-3 w-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
            <div className="h-3 w-3 rounded-sm bg-emerald-700 dark:bg-emerald-400" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Daily Revenue Distribution */}
      <div className="rounded-xl border border-border/40 p-4 mt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Revenue by Day of Week</h4>
        <div className="space-y-2">
          {data.dailyDistribution.map((d: any) => {
            const maxRev = Math.max(...data.dailyDistribution.map((x: any) => x.revenue), 1)
            const pct = maxRev > 0 ? Math.round((d.revenue / maxRev) * 100) : 0
            return (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-xs font-medium text-foreground w-20">{d.day}</span>
                <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-28 text-right">KES {d.revenue.toLocaleString()} ({d.orders})</span>
              </div>
            )
          })}
        </div>
      </div>
    </AISection>
  )
}

// ── Supplier & Restocking Intelligence ──
export function SupplierIntelligence({ data }: { data: any }) {
  return (
    <AISection id="supplier-intelligence" title="SUPPLIER & RESTOCKING INTELLIGENCE" icon={Truck}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Total Suppliers" value={`${data.totalSuppliers}`} />
        <MiniStat label="Supplier Items Low" value={`${data.supplierLowStock.length}`} alert={data.supplierLowStock.length > 0} />
        <MiniStat label="Need Supplier Link" value={`${data.productsNeedingSupplier}`} />
        <MiniStat label="Missing Cost (w/ Supplier)" value={`${data.missingCostWithSupplier}`} alert={data.missingCostWithSupplier > 0} />
      </div>
      {data.supplierLowStock.length > 0 && (
        <DataTable title="Supplier-Linked Items at Low Stock" items={data.supplierLowStock} columns={[
          { key: 'name', label: 'Product' },
          { key: 'stock', label: 'Stock' },
          { key: 'supplier', label: 'Supplier' },
        ]} emptyMsg="No low stock items from suppliers." severity="high" />
      )}
      {data.supplierLowStock.length === 0 && data.totalSuppliers === 0 && (
        <EmptyState message="No supplier data available. Add suppliers to enable supply chain intelligence." />
      )}
    </AISection>
  )
}

// ── Order Source Intelligence ──
export function OrderSourceIntelligence({ data }: { data: any }) {
  return (
    <AISection id="order-source" title="ORDER SOURCE INTELLIGENCE" icon={ShoppingBag}>
      {data.sources.length === 0 ? (
        <EmptyState message="No order source data available yet." />
      ) : (
        <div className="space-y-3">
          {data.sources.map((src: any) => {
            const total = data.sources.reduce((s: number, x: any) => s + x.count, 0)
            const pct = total > 0 ? Math.round((src.count / total) * 100) : 0
            return (
              <div key={src.source} className="flex items-center gap-3 rounded-xl border border-border/40 p-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground capitalize">{src.source.replace(/-/g, ' ')}</h4>
                  <p className="text-xs text-muted-foreground">{src.count} orders · KES {src.revenue.toLocaleString()}</p>
                </div>
                <div className="w-24">
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">{pct}%</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AISection>
  )
}

// ── Shared Helpers ──
function DataTable({ title, items, columns, emptyMsg, severity }: {
  title: string; items: any[]; columns: { key: string; label: string; format?: (v: any) => string }[]; emptyMsg: string; severity?: string
}) {
  return (
    <div className="rounded-xl border border-border/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {severity && <SeverityBadge severity={severity} />}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{emptyMsg}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                {columns.map(col => (
                  <th key={col.key} className="text-left py-1.5 px-2 font-medium text-muted-foreground">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item: any, i: number) => (
                <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10">
                  {columns.map(col => (
                    <td key={col.key} className="py-1.5 px-2 text-foreground">
                      {col.format ? col.format(item[col.key]) : (item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 8 && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">+ {items.length - 8} more items</p>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, subtitle, alert: isAlert }: { label: string; value: string; subtitle?: string; alert?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3 text-center', isAlert ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20' : 'border-border/40')}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-lg font-bold mt-0.5', isAlert ? 'text-orange-600 dark:text-orange-400' : 'text-foreground')}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function HealthRow({ label, value, threshold, unit }: { label: string; value: number; threshold: number; unit: string }) {
  const isHealthy = value <= threshold
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-semibold', isHealthy ? 'text-emerald-600' : 'text-red-600')}>{value}{unit}</span>
        <div className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-emerald-500' : 'bg-red-500')} />
      </div>
    </div>
  )
}
