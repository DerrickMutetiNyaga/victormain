/**
 * lib/db-sync.ts
 *
 * Dual-database sync engine.
 *
 * How it works
 * ─────────────
 * This module exports `wrapClientWithSync`, which wraps a MongoClient in a
 * JavaScript Proxy.  The proxy intercepts every call to:
 *   client.db(dbName)          → returns a proxied Db
 *   db.collection(name)        → returns a proxied Collection
 *   collection.<writeMethod>() → executes on the PRIMARY, then fires an
 *                                async (non-blocking) copy to the SECONDARY.
 *
 * Intercepted write methods
 * ─────────────────────────
 *   insertOne · insertMany · updateOne · updateMany
 *   deleteOne · deleteMany · replaceOne · bulkWrite
 *   findOneAndUpdate · findOneAndDelete · findOneAndReplace
 *
 * Reads are NEVER intercepted — they always come from the primary only.
 *
 * Retry / resilience model
 * ────────────────────────
 * Failures are split into two categories:
 *
 *   CONNECTION FAILURES  (secondary unreachable / SSL error / cooldown active)
 *   ─ Retry cycles are SKIPPED entirely while the cooldown is active, so item
 *     attempt-counts are NOT incremented.  Only when cooldown expires and an
 *     actual connection attempt is made does the attempt counter advance.
 *   ─ Items survive up to MAX_WRITE_ATTEMPTS connection attempts before being
 *     dropped, giving ~75+ minutes of patience with a 60 s cooldown.
 *   ─ Items are also dropped if they are older than MAX_ITEM_AGE_MS (24 h).
 *
 *   WRITE FAILURES  (connected to secondary but the write itself failed)
 *   ─ Item attempt-count is incremented normally.
 *   ─ Permanently dropped after MAX_WRITE_ATTEMPTS attempts.
 *
 * Safety guarantees
 * ─────────────────
 * • Primary write always completes first; result returned to caller immediately.
 * • A secondary failure NEVER affects the primary result / HTTP response.
 * • insertOne/insertMany sync via upsert with the primary-assigned _id so
 *   retries never create duplicate documents.
 * • The secondary is NEVER used for reads.
 */

import { Collection, Db, MongoClient } from 'mongodb'
import {
  getSecondaryClientPromise,
  getSecondaryCooldownRemainingMs,
  isSecondaryConfigured,
  isSecondaryInCooldown,
} from './mongodb-secondary'

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * How many genuine connection attempts (each separated by the 60 s cooldown)
 * are made before an item is permanently dropped.
 * 50 attempts × ~90 s per cycle ≈ 75+ minutes of persistence.
 */
const MAX_WRITE_ATTEMPTS = 50

/**
 * Items older than this are dropped regardless of attempt count (prevents
 * unbounded in-memory accumulation during multi-hour outages).
 */
const MAX_ITEM_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/** How often the retry processor fires (ms). */
const RETRY_INTERVAL_MS = 30_000

// ─── Retry queue ──────────────────────────────────────────────────────────────

interface RetryItem {
  id: string
  dbName: string
  collectionName: string
  method: string
  /** Original args forwarded to the primary write method */
  args: unknown[]
  /** For insertOne: the full document with the _id assigned by the driver */
  insertedDoc: Record<string, unknown> | undefined
  /** For insertMany: array of documents with their driver-assigned _ids */
  insertedDocs: Record<string, unknown>[] | undefined
  /**
   * Number of times a genuine sync attempt has been made (not counting
   * cycles that were skipped due to connection cooldown).
   */
  attempts: number
  firstFailedAt: Date
  lastAttemptAt: Date
}

const retryQueue: RetryItem[] = []

/** Global slot so HMR in dev doesn't spin up duplicate intervals. */
const _g = global as typeof globalThis & {
  _dbSyncRetryInterval?: ReturnType<typeof setInterval>
}

function startRetryProcessor(): void {
  if (_g._dbSyncRetryInterval) return

  _g._dbSyncRetryInterval = setInterval(() => {
    void processRetryQueue()
  }, RETRY_INTERVAL_MS)

  console.log(
    '[DB-Sync] 🔄 Secondary sync retry processor started (every 30 s)',
  )
}

async function processRetryQueue(): Promise<void> {
  if (retryQueue.length === 0) return

  // ── Connection cooldown check ──────────────────────────────────────────────
  // If the secondary is configured but its connection is in the post-failure
  // cooldown period, skip this entire retry cycle.  No items are removed or
  // incremented — they wait for the cooldown to expire before a real attempt.
  if (isSecondaryConfigured() && isSecondaryInCooldown()) {
    const remaining = getSecondaryCooldownRemainingMs()
    console.log(
      `[DB-Sync] ⏳ Retry cycle skipped — secondary connection in cooldown` +
        ` (${Math.ceil(remaining / 1000)}s remaining).` +
        ` Queue: ${retryQueue.length} item(s) preserved.`,
    )
    return
  }

  console.log(
    `[DB-Sync] 🔄 Processing retry queue — ${retryQueue.length} pending item(s)`,
  )

  // Drain the queue before iterating so new failures during this pass don't
  // get processed immediately.
  const batch = retryQueue.splice(0)
  const now = new Date()

  for (const item of batch) {
    // ── Max-age guard ────────────────────────────────────────────────────────
    if (now.getTime() - item.firstFailedAt.getTime() > MAX_ITEM_AGE_MS) {
      console.error(
        `[DB-Sync] 🗑️  Dropped stale item — ${item.method} on` +
          ` ${item.dbName}.${item.collectionName}` +
          ` (queued ${item.firstFailedAt.toISOString()}, older than 24 h)`,
      )
      continue
    }

    item.attempts += 1
    item.lastAttemptAt = now

    try {
      await performSecondarySync(
        item.dbName,
        item.collectionName,
        item.method,
        item.args,
        item.insertedDoc,
        item.insertedDocs,
      )
      console.log(
        `[DB-Sync] ✅ Retry succeeded — ${item.method} on` +
          ` ${item.dbName}.${item.collectionName}` +
          ` (attempt ${item.attempts})`,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      if (item.attempts < MAX_WRITE_ATTEMPTS) {
        console.error(
          `[DB-Sync] ❌ Retry ${item.attempts}/${MAX_WRITE_ATTEMPTS} failed —` +
            ` ${item.method} on ${item.dbName}.${item.collectionName}: ${message}`,
        )
        retryQueue.push(item)
      } else {
        console.error(
          `[DB-Sync] 💀 PERMANENTLY FAILED after ${MAX_WRITE_ATTEMPTS} attempts —` +
            ` ${item.method} on ${item.dbName}.${item.collectionName}` +
            ` | firstFailed: ${item.firstFailedAt.toISOString()}` +
            ` | lastAttempt: ${item.lastAttemptAt.toISOString()}`,
        )
      }
    }
  }
}

function enqueueRetry(payload: {
  dbName: string
  collectionName: string
  method: string
  args: unknown[]
  insertedDoc: Record<string, unknown> | undefined
  insertedDocs: Record<string, unknown>[] | undefined
}): void {
  const item: RetryItem = {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attempts: 0,
    firstFailedAt: new Date(),
    lastAttemptAt: new Date(),
  }
  retryQueue.push(item)
  console.warn(
    `[DB-Sync] ⚠️  Queued for secondary retry — ${payload.method} on` +
      ` ${payload.dbName}.${payload.collectionName}` +
      ` | queue size: ${retryQueue.length}`,
  )
}

// ─── Secondary sync logic ("not configured" guard, one-time log) ──────────────

let _secondaryMissingLogged = false

async function performSecondarySync(
  dbName: string,
  collectionName: string,
  method: string,
  args: unknown[],
  insertedDoc: Record<string, unknown> | undefined,
  insertedDocs: Record<string, unknown>[] | undefined,
): Promise<void> {
  const secondaryPromise = getSecondaryClientPromise()

  if (!secondaryPromise) {
    if (isSecondaryConfigured() && isSecondaryInCooldown()) {
      // Secondary IS set in env but is currently in post-failure cooldown.
      // Throw so that callers (initial proxy sync) know to queue this write
      // for later rather than silently discarding it.
      const remaining = getSecondaryCooldownRemainingMs()
      throw new Error(
        `Secondary connection in cooldown — retry in ${Math.ceil(remaining / 1000)}s`,
      )
    }

    // SECONDARY_MONGODB_URI is not set at all — silently skip.
    // Log once per process lifetime so the intent is visible at startup.
    if (!_secondaryMissingLogged) {
      console.log(
        '[DB-Sync] ℹ️  Secondary sync skipped — SECONDARY_MONGODB_URI is not set.' +
          ' Primary database continues working normally.',
      )
      _secondaryMissingLogged = true
    }
    return
  }

  const secondaryClient = await secondaryPromise
  const col = secondaryClient.db(dbName).collection(collectionName)

  switch (method) {
    case 'insertOne': {
      if (!insertedDoc) break
      // Upsert by primary-assigned _id → idempotent, never creates duplicates.
      await col.replaceOne({ _id: insertedDoc._id }, insertedDoc, {
        upsert: true,
      })
      break
    }

    case 'insertMany': {
      const docs = insertedDocs ?? []
      if (docs.length === 0) break
      const ops = docs.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }))
      await col.bulkWrite(ops, { ordered: false })
      break
    }

    // All other write operations replay the exact same arguments.
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (col as any)[method](...args)
      break
    }
  }
}

// ─── Write methods to intercept ───────────────────────────────────────────────

const WRITE_METHODS = new Set([
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'replaceOne',
  'bulkWrite',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
])

// ─── Proxy factories ──────────────────────────────────────────────────────────

function createSyncedCollection<T extends Document = Document>(
  primaryCol: Collection<T>,
  dbName: string,
  collectionName: string,
): Collection<T> {
  return new Proxy(primaryCol, {
    get(target, prop) {
      if (typeof prop === 'string' && WRITE_METHODS.has(prop)) {
        return async function (...args: unknown[]) {
          // ── 1. Execute on primary (blocking) ────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (target as any)[prop].apply(target, args)
          console.log(
            `[DB-Sync] ✅ Primary write — ${prop} on ${dbName}.${collectionName}`,
          )

          // ── 2. Snapshot _ids for insert operations ───────────────────────
          // The MongoDB driver mutates the document in-place to set _id;
          // result.insertedId / result.insertedIds holds the same value.
          let insertedDoc: Record<string, unknown> | undefined
          let insertedDocs: Record<string, unknown>[] | undefined

          if (
            prop === 'insertOne' &&
            result != null &&
            result.insertedId !== undefined
          ) {
            insertedDoc = {
              ...(args[0] as Record<string, unknown>),
              _id: result.insertedId,
            }
          } else if (
            prop === 'insertMany' &&
            result != null &&
            result.insertedIds !== undefined
          ) {
            const docsArr = args[0] as Record<string, unknown>[]
            insertedDocs = Object.keys(result.insertedIds).map((idxStr) => {
              const idx = Number(idxStr)
              return {
                ...(docsArr[idx] ?? {}),
                _id: result.insertedIds[idx],
              }
            })
          }

          // ── 3. Non-blocking secondary sync ──────────────────────────────
          // The primary result is returned to the caller BEFORE this fires.
          Promise.resolve()
            .then(() =>
              performSecondarySync(
                dbName,
                collectionName,
                prop,
                args,
                insertedDoc,
                insertedDocs,
              ),
            )
            .then(() => {
              console.log(
                `[DB-Sync] ✅ Secondary sync — ${prop} on ${dbName}.${collectionName}`,
              )
            })
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err)
              console.error(
                `[DB-Sync] ❌ Secondary sync failed — ${prop} on` +
                  ` ${dbName}.${collectionName}: ${message}`,
              )
              enqueueRetry({
                dbName,
                collectionName,
                method: prop,
                args,
                insertedDoc,
                insertedDocs,
              })
            })

          return result
        }
      }

      // All non-write properties/methods pass straight through to primary.
      const val = Reflect.get(target, prop, target)
      return typeof val === 'function' ? val.bind(target) : val
    },
  }) as unknown as Collection<T>
}

function createSyncedDb(primaryDb: Db): Db {
  return new Proxy(primaryDb, {
    get(target, prop) {
      if (prop === 'collection') {
        return function (collectionName: string, options?: unknown) {
          const col = (target as Db).collection(
            collectionName,
            options as Parameters<Db['collection']>[1],
          )
          return createSyncedCollection(
            col as unknown as Collection<Document>,
            target.databaseName,
            collectionName,
          )
        }
      }
      const val = Reflect.get(target, prop, target)
      return typeof val === 'function' ? val.bind(target) : val
    },
  }) as unknown as Db
}

/**
 * Wraps a primary MongoClient with a transparent sync proxy.
 *
 * After every successful write on any collection of any database the same
 * operation is replicated asynchronously to the secondary MongoDB.
 *
 * Called once from lib/mongodb.ts — no other file needs to import this.
 */
export function wrapClientWithSync(client: MongoClient): MongoClient {
  startRetryProcessor()

  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'db') {
        return function (dbName: string, options?: unknown) {
          const db = target.db(
            dbName,
            options as Parameters<MongoClient['db']>[1],
          )
          return createSyncedDb(db)
        }
      }
      const val = Reflect.get(target, prop, target)
      return typeof val === 'function' ? val.bind(target) : val
    },
  }) as unknown as MongoClient
}

// ─── Public monitoring helper ─────────────────────────────────────────────────

/** Returns a snapshot of the current secondary sync retry queue. */
export function getSyncRetryQueueStatus() {
  return {
    queueLength: retryQueue.length,
    pendingItems: retryQueue.map((item) => ({
      id: item.id,
      dbName: item.dbName,
      collectionName: item.collectionName,
      method: item.method,
      attempts: item.attempts,
      maxAttempts: MAX_WRITE_ATTEMPTS,
      firstFailedAt: item.firstFailedAt,
      lastAttemptAt: item.lastAttemptAt,
    })),
  }
}
