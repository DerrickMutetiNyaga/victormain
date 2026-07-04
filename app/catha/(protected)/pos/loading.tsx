export default function POSLoading() {
  return (
    <div className="flex h-screen overflow-hidden w-full bg-background animate-in fade-in duration-150">
      <div className="flex flex-1 min-w-0">
        {/* Categories skeleton */}
        <div className="w-[220px] flex-shrink-0 border-r border-border p-3 space-y-2">
          <div className="h-10 bg-muted/60 rounded-xl animate-pulse" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-[70px] border-b border-border flex items-center gap-2 px-4">
            <div className="h-10 w-24 bg-muted/60 rounded-xl animate-pulse" />
            <div className="flex-1 h-10 max-w-md bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-10 w-32 bg-muted/60 rounded-xl animate-pulse" />
            <div className="h-10 w-28 bg-muted/60 rounded-xl animate-pulse" />
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="aspect-[4/3] bg-muted/60 animate-pulse" />
                  <div className="p-2 space-y-2">
                    <div className="h-4 bg-muted/40 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse" />
                    <div className="flex justify-between">
                      <div className="h-5 bg-muted/60 rounded w-16 animate-pulse" />
                      <div className="h-9 w-9 bg-muted/40 rounded-xl animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Order panel skeleton */}
        <div className="w-[360px] flex-shrink-0 border-l border-border flex flex-col">
          <div className="h-14 border-b border-border p-3 flex items-center gap-2">
            <div className="h-8 w-8 bg-muted/60 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted/40 rounded w-24 animate-pulse" />
              <div className="h-3 bg-muted/30 rounded w-16 animate-pulse" />
            </div>
          </div>
          <div className="flex-1 p-3 space-y-3">
            <div className="h-24 bg-muted/30 rounded-xl animate-pulse" />
            <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
            <div className="h-14 bg-muted/30 rounded-xl animate-pulse" />
          </div>
          <div className="p-3 border-t border-border space-y-2">
            <div className="h-16 bg-muted/40 rounded-xl animate-pulse" />
            <div className="flex gap-2">
              <div className="flex-1 h-12 bg-muted/50 rounded-xl animate-pulse" />
              <div className="flex-1 h-12 bg-muted/50 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

