/**
 * lib/mongodb-secondary.ts
 *
 * Secondary MongoDB connection — used ONLY by the sync layer to mirror writes
 * from the primary database. No app code should import this directly.
 *
 * The secondary is never used for reads or normal app operations.
 */

import { MongoClient, MongoClientOptions } from 'mongodb'

const SECONDARY_URI = process.env.SECONDARY_MONGODB_URI

const secondaryOptions: MongoClientOptions = {
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 30_000,
  connectTimeoutMS: 15_000,
  retryWrites: true,
  maxPoolSize: 5,
  minPoolSize: 1,
  heartbeatFrequencyMS: 15_000,
  directConnection: false,
}

/** Shared promise for the secondary client (production). */
let _productionPromise: Promise<MongoClient> | null = null

/** Global cache key for HMR-safe dev mode. */
const _dev = global as typeof globalThis & {
  _secondaryMongoClientPromise?: Promise<MongoClient>
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
    // Verify with a ping before accepting the connection
    await client.db('admin').command({ ping: 1 })
    console.log('[MongoDB-Secondary] ✅ Connected to secondary database')
    return client
  })().catch((err: Error) => {
    console.error(
      '[MongoDB-Secondary] ❌ Failed to connect to secondary database:',
      err.message,
    )
    // Reset so the next call can retry
    _productionPromise = null
    if (process.env.NODE_ENV === 'development') {
      delete _dev._secondaryMongoClientPromise
    }
    throw err
  })
}

/**
 * Returns the secondary MongoClient promise, or null if SECONDARY_MONGODB_URI
 * is not configured.  The promise is a singleton (one connection per process).
 */
export function getSecondaryClientPromise(): Promise<MongoClient> | null {
  if (!SECONDARY_URI) {
    // Only warn once at startup
    return null
  }

  if (process.env.NODE_ENV === 'development') {
    // In dev, store on global so HMR reloads reuse the same connection
    if (!_dev._secondaryMongoClientPromise) {
      _dev._secondaryMongoClientPromise = buildConnection()
    }
    return _dev._secondaryMongoClientPromise
  }

  // Production: module-level singleton
  if (!_productionPromise) {
    _productionPromise = buildConnection()
  }
  return _productionPromise
}
