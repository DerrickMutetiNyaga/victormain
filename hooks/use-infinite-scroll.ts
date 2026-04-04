import { useEffect, useRef, useState } from 'react'

interface UseInfiniteScrollOptions {
  hasMore: boolean
  loadMore: () => void
  threshold?: number // Distance from bottom to trigger load (in pixels)
}

export function useInfiniteScroll({ hasMore, loadMore, threshold = 200 }: UseInfiniteScrollOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setIsLoading(true)
          loadMore()
          // Reset loading state after a short delay
          setTimeout(() => setIsLoading(false), 300)
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loadMore, threshold, isLoading])

  return { observerTarget, isLoading }
}

