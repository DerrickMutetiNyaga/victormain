'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackClientEvent } from '@/lib/commerce-analytics-client'

export function CommercePageTracker() {
  const pathname = usePathname()
  const previousPath = useRef<string>('')

  useEffect(() => {
    if (!pathname) return
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    trackClientEvent('page_view')
  }, [pathname])

  return null
}
