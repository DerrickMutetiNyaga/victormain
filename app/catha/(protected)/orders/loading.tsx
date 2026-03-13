export default function OrdersLoading() {
  return (
    <div className="p-4 md:p-6 animate-in fade-in duration-150">
      <div className="flex flex-col gap-4">
        {/* Header skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-8 w-48 bg-muted/60 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-10 w-32 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-10 w-28 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        </div>
        {/* Filters skeleton */}
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-full max-w-xs bg-muted/40 rounded-xl animate-pulse" />
          <div className="h-10 w-24 bg-muted/40 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-muted/40 rounded-xl animate-pulse" />
        </div>
        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 bg-card">
              <div className="flex justify-between items-start mb-3">
                <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
                <div className="h-6 w-16 bg-muted/40 rounded-full animate-pulse" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-muted/40 rounded w-full animate-pulse" />
                <div className="h-4 bg-muted/40 rounded w-3/4 animate-pulse" />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-muted/40 rounded-lg animate-pulse" />
                  <div className="h-8 w-8 bg-muted/40 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

