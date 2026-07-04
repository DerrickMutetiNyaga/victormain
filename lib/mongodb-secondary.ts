/**
 * lib/mongodb-secondary.ts
 *
 * Secondary MongoDB connection — used ONLY by the sync layer.
 * No app code, routes, or pages should import this directly.
 *
 * Connection safety
 * ─────────────────
 * After any connection failure a RECONNECT_COOLDOWN_MS (60 s) cooling period
 * is enforced.  During the cooldown getSecondaryClientPromise() returns null
 * so the sync layer skips individual writes without spawning redundant TCP/SSL
 * handshake attempts.  The cooldown resets automatically once it expires,
 * allowing the next retry cycle to attempt a fresh connection.
 *
 * The primary database is never touched by this file.
 */

import { MongoClient, MongoClientOptions } from 'mongodb'

const SECONDARY_URI = process.env.SECONDARY_MONGODB_URI

/**
 * How long to pause reconnection attempts after a failure (ms).
 * Prevents hammering a temporarily-unreachable or mis-configured secondary
 * with rapid-fire SSL/TCP handshakes.
 */
const RECONNECT_COOLDOWN_MS = 60_000

const secondaryOptions: MongoClientOptions = {
  // Keep timeouts shorter than the primary so failures are detected quickly
  // and the cooldown kicks in fast without blocking the retry queue.
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 20_000,
  connectTimeoutMS: 10_000,
  retryWrites: true,
  maxPoolSize: 5,
  minPoolSize: 1,
  heartbeatFrequencyMS: 15_000,
  directConnection: false,
}

// ─── State ────────────────────────────────────────────────────────────────────

let _productionPromise: Promise<MongoClient> | null = null
let _lastFailureAt: number | null = null

/**
 * In development the module is re-evaluated on HMR so we stash state on
 * `global` to keep a single connection across hot reloads.
 */
const _dev = global as typeof globalThis & {
  _secondaryMongoClientPromise?: Promise<MongoClient>
  _secondaryLastFailureAt?: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getLastFailureAt(): number | null {
  return process.env.NODE_ENV === 'development'
    ? (_dev._secondaryLastFailureAt ?? null)
    : _lastFailureAt
}

function setLastFailureAt(ts: number): void {
  if (process.env.NODE_ENV === 'development') {
    _dev._secondaryLastFailureAt = ts
  } else {
    _lastFailureAt = ts
  }
}

function clearLastFailureAt(): void {
  if (process.env.NODE_ENV === 'development') {
    delete _dev._secondaryLastFailureAt
  } else {
    _lastFailureAt = null
  }
}

function resetCachedPromise(): void {
  if (process.env.NODE_ENV === 'development') {
    delete _dev._secondaryMongoClientPromise
  } else {
    _productionPromise = null
  }
}

function buildConnection(): Promise<MongoClient> {
  if (!SECONDARY_URI) {
    return Promise.reject(
      new Error('[MongoDB-Secondary] SECONDARY_MONGODB_URI is not set'),
    )
  }

  const client = new MongoClient(SECONDARY_URI, secondaryOptions)

  return (async () => {
    console.log('[MongoDB-Secondary] 🔌 Connecting to secondary database…')
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    console.log('[MongoDB-Secondary] ✅ Connected to secondary database')
    // Clear any previous failure record on successful connection
    clearLastFailureAt()
    return client
  })().catch((err: Error) => {
    console.error(
      '[MongoDB-Secondary] ❌ Failed to connect to secondary database:',
      err.message,
    )
    console.warn(
      `[MongoDB-Secondary] ⏳ Connection cooldown started — next reconnect attempt in` +
        ` ${RECONNECT_COOLDOWN_MS / 1000}s.`,
    )
    console.warn(
      '[MongoDB-Secondary] ℹ️  If you see an SSL / TLS error above, the most likely cause is' +
        ' that the connecting server IP is not whitelisted in the secondary Atlas cluster.' +
        ' Go to Atlas → secondary cluster → Network Access → Add IP Address.',
    )
    console.warn(
      '[MongoDB-Secondary] ℹ️  Primary database is unaffected and continues working normally.',
    )
    setLastFailureAt(Date.now())
    resetCachedPromise()
    throw err
  })
}

// ─── Public status helpers (used by db-sync.ts) ───────────────────────────────

/** True when SECONDARY_MONGODB_URI is set in the environment (even if unreachable). */
export function isSecondaryConfigured(): boolean {
  return Boolean(SECONDARY_URI)
}

/**
 * True when a connection attempt recently failed and the cooldown window is
 * still active.  During this period getSecondaryClientPromise() returns null
 * to prevent redundant reconnection attempts.
 */
export function isSecondaryInCooldown(): boolean {
  const failedAt = getLastFailureAt()
  if (failedAt === null) return false
  return Date.now() - failedAt < RECONNECT_COOLDOWN_MS
}

/** Milliseconds remaining in the active cooldown period (0 if not in cooldown). */
export function getSecondaryCooldownRemainingMs(): number {
  const failedAt = getLastFailureAt()
  if (failedAt === null) return 0
  return Math.max(0, RECONNECT_COOLDOWN_MS - (Date.now() - failedAt))
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns a Promise that resolves to the secondary MongoClient.
 *
 * Returns null when:
 *   • SECONDARY_MONGODB_URI is not set, OR
 *   • A connection failure cooldown is currently active.
 *
 * Callers should use isSecondaryConfigured() + isSecondaryInCooldown() to
 * distinguish between these two cases when they need to take different action.
 */
export function getSecondaryClientPromise(): Promise<MongoClient> | null {
  if (!SECONDARY_URI) return null

  // Return null during cooldown — the sync layer will queue/hold writes
  // without making redundant TCP/SSL handshakes.
  if (isSecondaryInCooldown()) return null

  if (process.env.NODE_ENV === 'development') {
    if (!_dev._secondaryMongoClientPromise) {
      _dev._secondaryMongoClientPromise = buildConnection()
    }
    return _dev._secondaryMongoClientPromise
  }

  if (!_productionPromise) {
    _productionPromise = buildConnection()
  }
  return _productionPromise
}
