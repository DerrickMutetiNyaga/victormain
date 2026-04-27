import type { Db } from 'mongodb'
import { getClientIp } from '@/lib/rate-limit-simple'

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'wishlist_add'

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType
  sessionId?: string | null
  path?: string | null
  pageName?: string | null
  productId?: string | null
  productName?: string | null
  category?: string | null
  searchQuery?: string | null
  quantity?: number | null
  value?: number | null
  orderId?: string | null
  metadata?: Record<string, unknown> | null
}

const DB_NAME = 'infusion_jaba'
const EVENTS_COLL = 'analytics_events'
const SESSIONS_COLL = 'analytics_sessions'
const DAILY_SUMMARY_COLL = 'analytics_daily_summary'

export function analyticsDbName() {
  return DB_NAME
}

export function getAnalyticsCollections() {
  return {
    events: EVENTS_COLL,
    sessions: SESSIONS_COLL,
    dailySummary: DAILY_SUMMARY_COLL,
  }
}

function getPageNameFromPath(path: string) {
  if (path === '/') return 'Homepage'
  if (path.startsWith('/shop')) return 'Shop Page'
  if (path.startsWith('/product/')) return 'Product Pages'
  if (path.startsWith('/checkout')) return 'Checkout'
  if (path.startsWith('/cart')) return 'Cart'
  if (path.startsWith('/catha/ai-intelligence')) return 'AI Page'
  return 'Dynamic Route'
}

function normalizePath(path?: string | null) {
  if (!path) return '/'
  const safe = String(path).trim()
  if (!safe.startsWith('/')) return `/${safe}`
  return safe || '/'
}

function parseUserAgent(userAgent: string | null) {
  const ua = (userAgent || '').toLowerCase()
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop'
  if (/tablet|ipad/.test(ua)) deviceType = 'tablet'
  else if (/mobile|android|iphone|ipod/.test(ua)) deviceType = 'mobile'

  const browser =
    /edg\//.test(ua) ? 'Edge' :
    /opr\//.test(ua) ? 'Opera' :
    /chrome\//.test(ua) ? 'Chrome' :
    /firefox\//.test(ua) ? 'Firefox' :
    /safari\//.test(ua) && !/chrome\//.test(ua) ? 'Safari' :
    'Other'

  const os =
    /windows/.test(ua) ? 'Windows' :
    /mac os/.test(ua) ? 'macOS' :
    /android/.test(ua) ? 'Android' :
    /iphone|ipad|ios/.test(ua) ? 'iOS' :
    /linux/.test(ua) ? 'Linux' :
    'Other'

  return { deviceType, browser, os }
}

export async function ensureAnalyticsIndexes(db: Db) {
  const { events, sessions, dailySummary } = getAnalyticsCollections()
  await Promise.all([
    db.collection(events).createIndex({ createdAt: -1 }).catch(() => {}),
    db.collection(events).createIndex({ eventType: 1, createdAt: -1 }).catch(() => {}),
    db.collection(events).createIndex({ sessionId: 1, createdAt: -1 }).catch(() => {}),
    db.collection(events).createIndex({ path: 1, createdAt: -1 }).catch(() => {}),
    db.collection(events).createIndex({ productId: 1, createdAt: -1 }).catch(() => {}),
    db.collection(sessions).createIndex({ sessionId: 1 }, { unique: true }).catch(() => {}),
    db.collection(sessions).createIndex({ lastSeenAt: -1 }).catch(() => {}),
    db.collection(dailySummary).createIndex({ day: 1 }, { unique: true }).catch(() => {}),
  ])
}

export async function trackAnalyticsEvent(db: Db, request: Request, input: AnalyticsEventInput) {
  await ensureAnalyticsIndexes(db)

  const now = new Date()
  const path = normalizePath(input.path)
  const pageName = input.pageName?.trim() || getPageNameFromPath(path)
  const sessionId = input.sessionId?.trim() || `anon:${getClientIp(request)}`
  const userAgent = request.headers.get('user-agent')
  const forwardedCountry = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'Unknown'
  const forwardedCity = request.headers.get('x-vercel-ip-city') || 'Unknown'
  const ip = getClientIp(request)
  const ua = parseUserAgent(userAgent)

  const eventDoc = {
    eventType: input.eventType,
    sessionId,
    path,
    pageName,
    productId: input.productId || null,
    productName: input.productName || null,
    category: input.category || null,
    searchQuery: input.searchQuery || null,
    quantity: Number.isFinite(input.quantity) ? Number(input.quantity) : null,
    value: Number.isFinite(input.value) ? Number(input.value) : null,
    orderId: input.orderId || null,
    metadata: input.metadata || null,
    ip,
    country: forwardedCountry,
    city: forwardedCity,
    deviceType: ua.deviceType,
    browser: ua.browser,
    os: ua.os,
    createdAt: now,
  }

  await db.collection(EVENTS_COLL).insertOne(eventDoc)

  await db.collection(SESSIONS_COLL).updateOne(
    { sessionId },
    {
      $set: {
        lastSeenAt: now,
        ip,
        country: forwardedCountry,
        city: forwardedCity,
        deviceType: ua.deviceType,
        browser: ua.browser,
        os: ua.os,
      },
      $setOnInsert: { sessionId, createdAt: now },
      $inc: { totalEvents: 1 },
    },
    { upsert: true }
  )

  const day = now.toISOString().slice(0, 10)
  await db.collection(DAILY_SUMMARY_COLL).updateOne(
    { day },
    {
      $set: { updatedAt: now },
      $setOnInsert: { day, createdAt: now },
      $inc: {
        totalEvents: 1,
        [`events.${input.eventType}`]: 1,
      },
    },
    { upsert: true }
  )
}
