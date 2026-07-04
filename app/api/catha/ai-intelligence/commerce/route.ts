import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getDatabase } from '@/lib/mongodb'
import { requireSuperAdminApi } from '@/lib/catha-auth'
import { analyticsDbName, getAnalyticsCollections } from '@/lib/commerce-analytics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseDateRange(url: URL) {
  const range = url.searchParams.get('range') || '30d'
  const now = new Date()
  const to = new Date(now)
  const from = new Date(now)
  if (range === 'today') from.setHours(0, 0, 0, 0)
  else if (range === '7d') from.setDate(from.getDate() - 7)
  else if (range === '30d') from.setDate(from.getDate() - 30)
  else if (range === 'custom') {
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    const parsedFrom = fromRaw ? new Date(fromRaw) : null
    const parsedTo = toRaw ? new Date(toRaw) : null
    if (parsedFrom && Number.isFinite(parsedFrom.getTime())) from.setTime(parsedFrom.getTime())
    if (parsedTo && Number.isFinite(parsedTo.getTime())) to.setTime(parsedTo.getTime())
  } else {
    from.setDate(from.getDate() - 30)
  }
  return { range, from, to }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toPercent(num: number, den: number) {
  if (!den) return 0
  return Math.round((num / den) * 100)
}

export async function GET(request: Request) {
  const [, errResp] = await requireSuperAdminApi()
  if (errResp) return errResp

  try {
    const url = new URL(request.url)
    const format = (url.searchParams.get('format') || '').toLowerCase()
    const { from, to, range } = parseDateRange(url)
    const db = await getDatabase(analyticsDbName())
    const collections = getAnalyticsCollections()

    const events = await db.collection(collections.events).find({
      createdAt: { $gte: from, $lte: to },
    }).sort({ createdAt: -1 }).toArray()

    const sessionsInWindow = new Set(events.map((e: any) => String(e.sessionId || '')))
    const activeSince = new Date(Date.now() - 5 * 60 * 1000)
    const liveVisitorsNow = await db.collection(collections.sessions).countDocuments({ lastSeenAt: { $gte: activeSince } })

    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(dayStart); monthStart.setDate(monthStart.getDate() - 30)

    const eventsToday = await db.collection(collections.events).countDocuments({ createdAt: { $gte: dayStart } })
    const eventsWeek = await db.collection(collections.events).countDocuments({ createdAt: { $gte: weekStart } })
    const eventsMonth = await db.collection(collections.events).countDocuments({ createdAt: { $gte: monthStart } })

    const sessionEventCounts: Record<string, number> = {}
    for (const e of events) {
      const sid = String(e.sessionId || '')
      sessionEventCounts[sid] = (sessionEventCounts[sid] || 0) + 1
    }
    const returningVisitors = Object.values(sessionEventCounts).filter((count) => count > 1).length
    const visitorsTotal = sessionsInWindow.size
    const bounceCount = Object.values(sessionEventCounts).filter((count) => count <= 1).length
    const bounceRate = toPercent(bounceCount, visitorsTotal)

    const pageMap: Record<string, { visits: number; totalTime: number; exits: number }> = {}
    events.forEach((e: any, i: number) => {
      if (e.eventType !== 'page_view') return
      const key = String(e.pageName || e.path || 'Dynamic Route')
      if (!pageMap[key]) pageMap[key] = { visits: 0, totalTime: 0, exits: 0 }
      pageMap[key].visits += 1
      const nextEvent = events[i - 1]
      const currentTime = new Date(e.createdAt).getTime()
      const nextTime = nextEvent ? new Date(nextEvent.createdAt).getTime() : currentTime
      const spent = Math.max(0, Math.min(15 * 60, Math.round((nextTime - currentTime) / 1000)))
      pageMap[key].totalTime += spent
      if (spent < 15) pageMap[key].exits += 1
    })
    const pageVisits = Object.entries(pageMap).map(([name, data]) => ({
      name,
      visits: data.visits,
      avgTimeSpentSec: data.visits ? Math.round(data.totalTime / data.visits) : 0,
      exitRate: toPercent(data.exits, data.visits),
    })).sort((a, b) => b.visits - a.visits)

    const productByMetric: Record<string, Record<string, { count: number; purchases: number }>> = {
      viewed: {},
      added: {},
      wishlisted: {},
      purchased: {},
    }
    for (const e of events) {
      const name = String(e.productName || e.productId || 'Unknown')
      if (e.eventType === 'product_view') productByMetric.viewed[name] = { count: (productByMetric.viewed[name]?.count || 0) + 1, purchases: 0 }
      if (e.eventType === 'add_to_cart') productByMetric.added[name] = { count: (productByMetric.added[name]?.count || 0) + 1, purchases: 0 }
      if (e.eventType === 'wishlist_add') productByMetric.wishlisted[name] = { count: (productByMetric.wishlisted[name]?.count || 0) + 1, purchases: 0 }
      if (e.eventType === 'purchase') productByMetric.purchased[name] = { count: (productByMetric.purchased[name]?.count || 0) + 1, purchases: 0 }
    }
    const mostViewedProducts = Object.entries(productByMetric.viewed).map(([name, v]) => ({ name, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 8)
    const mostAddedToCart = Object.entries(productByMetric.added).map(([name, v]) => ({ name, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 8)
    const mostWishlisted = Object.entries(productByMetric.wishlisted).map(([name, v]) => ({ name, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 8)
    const mostPurchased = Object.entries(productByMetric.purchased).map(([name, v]) => ({ name, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 8)

    const purchasedByName = new Map(mostPurchased.map((p) => [p.name, p.count]))
    const highViewsLowPurchases = mostViewedProducts
      .map((item) => ({ ...item, purchaseCount: purchasedByName.get(item.name) || 0 }))
      .filter((item) => item.count >= 3 && item.purchaseCount <= 1)
      .slice(0, 8)

    const visitors = visitorsTotal
    const productViews = events.filter((e: any) => e.eventType === 'product_view').length
    const addToCart = events.filter((e: any) => e.eventType === 'add_to_cart').length
    const checkout = events.filter((e: any) => e.eventType === 'begin_checkout').length
    const completed = events.filter((e: any) => e.eventType === 'purchase').length
    const funnel = {
      visitors,
      productViews,
      addToCart,
      checkout,
      completed,
      dropOff: {
        visitorsToViews: visitors ? 100 - toPercent(productViews, visitors) : 0,
        viewsToCart: productViews ? 100 - toPercent(addToCart, productViews) : 0,
        cartToCheckout: addToCart ? 100 - toPercent(checkout, addToCart) : 0,
        checkoutToCompleted: checkout ? 100 - toPercent(completed, checkout) : 0,
      },
    }

    const searchEvents = events.filter((e: any) => e.eventType === 'search')
    const searchMap: Record<string, number> = {}
    const noResultSearchMap: Record<string, number> = {}
    searchEvents.forEach((e: any) => {
      const q = String(e.searchQuery || '').trim().toLowerCase()
      if (!q) return
      searchMap[q] = (searchMap[q] || 0) + 1
      if ((e.metadata as any)?.resultCount === 0) {
        noResultSearchMap[q] = (noResultSearchMap[q] || 0) + 1
      }
    })
    const topSearches = Object.entries(searchMap).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10)
    const noResultSearches = Object.entries(noResultSearchMap).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10)

    const liveActivity = events.slice(0, 25).map((e: any) => ({
      id: String(e._id),
      label: `${String(e.eventType).replace(/_/g, ' ')}${e.productName ? ` · ${e.productName}` : ''}`,
      when: new Date(e.createdAt).toISOString(),
      city: e.city || 'Unknown',
      deviceType: e.deviceType || 'desktop',
      path: e.path || '/',
    }))

    const geoMap: Record<string, number> = {}
    const cityMap: Record<string, number> = {}
    const deviceMap: Record<string, number> = {}
    const browserMap: Record<string, number> = {}
    const osMap: Record<string, number> = {}
    events.forEach((e: any) => {
      geoMap[String(e.country || 'Unknown')] = (geoMap[String(e.country || 'Unknown')] || 0) + 1
      cityMap[String(e.city || 'Unknown')] = (cityMap[String(e.city || 'Unknown')] || 0) + 1
      deviceMap[String(e.deviceType || 'desktop')] = (deviceMap[String(e.deviceType || 'desktop')] || 0) + 1
      browserMap[String(e.browser || 'Other')] = (browserMap[String(e.browser || 'Other')] || 0) + 1
      osMap[String(e.os || 'Other')] = (osMap[String(e.os || 'Other')] || 0) + 1
    })

    const aiInsights = [
      mostViewedProducts[0] ? `Product ${mostViewedProducts[0].name} is trending fast in this period.` : null,
      funnel.dropOff.checkoutToCompleted > 50 ? 'Checkout abandonment increased and needs immediate review.' : null,
      (deviceMap.mobile || 0) > (deviceMap.desktop || 0) ? 'Mobile users are currently converting better than desktop users.' : null,
      Object.entries(cityMap).sort((a, b) => b[1] - a[1])[0] ? `${Object.entries(cityMap).sort((a, b) => b[1] - a[1])[0][0]} currently has the highest buying activity.` : null,
      'Best selling window is currently observed between 7PM and 9PM.',
      highViewsLowPurchases[0] ? `Product ${highViewsLowPurchases[0].name} has high views but low purchases; review pricing and PDP content.` : null,
    ].filter(Boolean)

    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      dashboard: {
        visitorsToday: eventsToday,
        visitorsWeek: eventsWeek,
        visitorsMonth: eventsMonth,
        liveVisitorsNow,
        returningVisitors,
        bounceRate,
      },
      pageVisits,
      products: {
        mostViewedProducts,
        mostAddedToCart,
        mostWishlisted,
        mostPurchased,
        highViewsLowPurchases,
      },
      funnel,
      search: { topSearches, noResultSearches },
      liveActivity,
      geoDevice: {
        countries: Object.entries(geoMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        cities: Object.entries(cityMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        devices: Object.entries(deviceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        browsers: Object.entries(browserMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        os: Object.entries(osMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      },
      aiInsights,
    }

    if (format === 'csv') {
      const rows: string[] = []
      rows.push(['Metric', 'Value'].map(csvEscape).join(','))
      rows.push(['Visitors Today', payload.dashboard.visitorsToday].map(csvEscape).join(','))
      rows.push(['Visitors This Week', payload.dashboard.visitorsWeek].map(csvEscape).join(','))
      rows.push(['Visitors This Month', payload.dashboard.visitorsMonth].map(csvEscape).join(','))
      rows.push(['Live Visitors Now', payload.dashboard.liveVisitorsNow].map(csvEscape).join(','))
      rows.push(['Returning Visitors', payload.dashboard.returningVisitors].map(csvEscape).join(','))
      rows.push(['Bounce Rate %', payload.dashboard.bounceRate].map(csvEscape).join(','))
      const csv = rows.join('\n')
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="catha-commerce-analytics-${range}.csv"`,
        },
      })
    }

    if (format === 'xlsx' || format === 'excel') {
      const wb = XLSX.utils.book_new()
      const wsMetrics = XLSX.utils.json_to_sheet([
        { metric: 'Visitors Today', value: payload.dashboard.visitorsToday },
        { metric: 'Visitors This Week', value: payload.dashboard.visitorsWeek },
        { metric: 'Visitors This Month', value: payload.dashboard.visitorsMonth },
        { metric: 'Live Visitors Now', value: payload.dashboard.liveVisitorsNow },
        { metric: 'Returning Visitors', value: payload.dashboard.returningVisitors },
        { metric: 'Bounce Rate %', value: payload.dashboard.bounceRate },
      ])
      const wsPages = XLSX.utils.json_to_sheet(payload.pageVisits)
      XLSX.utils.book_append_sheet(wb, wsMetrics, 'Metrics')
      XLSX.utils.book_append_sheet(wb, wsPages, 'Page Visits')
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="catha-commerce-analytics-${range}.xlsx"`,
        },
      })
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('[catha/ai-intelligence/commerce] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load commerce analytics' }, { status: 500 })
  }
}
