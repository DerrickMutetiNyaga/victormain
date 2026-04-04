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
 * Retry mechanism
 * ───────────────
 * If the secondary sync fails the operation is queued in an in-memory retry
 * list.  A setInterval (30 s) retries each item up to MAX_ATTEMPTS (5) times.
 * After all attempts are exhausted the failure is logged with full context so
 * it can be investigated or manually replayed.
 *
 * Safety guarantees
 * ─────────────────
 * • Primary write always completes first.
 * • A secondary failure NEVER affects the primary result / HTTP response.
 * • insertOne/insertMany use the _id already assigned by the primary so the
 *   secondary always gets the exact same document identity (upsert-safe).
 * • All other writes replay the same filter + update args — idempotent for
 *   retries as long as the primary hasn't changed the document again by then.
 */

import { Collection, Db, MongoClient } from 'mongodb'
import { getSecondaryClientPromise } from './mongodb-secondary'

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
  attempts: number
  maxAttempts: number
  firstFailedAt: Date
  lastAttemptAt: Date
}

const retryQueue: RetryItem[] = []
const MAX_ATTEMPTS = 5
const RETRY_INTERVAL_MS = 30_000

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

  console.log(
    `[DB-Sync] 🔄 Processing retry queue — ${retryQueue.length} pending item(s)`,
  )

  // Drain the queue before iterating so new failures during this pass don't
  // get processed immediately.
  const batch = retryQueue.splice(0)

  for (const item of batch) {
    item.attempts += 1
    item.lastAttemptAt = new Date()

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
          ` (attempt ${item.attempts}/${item.maxAttempts})`,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (item.attempts < item.maxAttempts) {
        console.error(
          `[DB-Sync] ❌ Retry ${item.attempts}/${item.maxAttempts} failed —` +
            ` ${item.method} on ${item.dbName}.${item.collectionName}: ${message}`,
        )
        retryQueue.push(item)
      } else {
        console.error(
          `[DB-Sync] 💀 PERMANENTLY FAILED after ${item.maxAttempts} attempts —` +
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
  retryQueue.push({
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    firstFailedAt: new Date(),
    lastAttemptAt: new Date(),
  })
  console.warn(
    `[DB-Sync] ⚠️ Queued retry for ${payload.method} on` +
      ` ${payload.dbName}.${payload.collectionName}` +
      ` — queue size: ${retryQueue.length}`,
  )
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Log the "secondary not configured" message only once per process lifetime so
 * it appears clearly at startup without flooding every subsequent write log.
 */
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
    // SECONDARY_MONGODB_URI is absent, empty, or was never set.
    // Log once so it is visible in server output, then skip silently.
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
      // Use the captured document (with _id already assigned by the primary
      // driver) and upsert so retries never create duplicates.
      if (!insertedDoc) break
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

    // For all other write operations we replay the exact same arguments.
    // These are all idempotent when retried (filters remain the same).
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
        // Return an async wrapper that:
        //   1. Executes the write on the primary (awaited — blocking)
        //   2. Fires an async sync to the secondary (non-blocking)
        //   3. Returns the primary result immediately
        return async function (...args: unknown[]) {
          // ── Primary write ─────────────────────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (target as any)[prop].apply(target, args)
          console.log(
            `[DB-Sync] ✅ Primary write — ${prop} on ${dbName}.${collectionName}`,
          )

          // ── Capture _ids for insert operations ────────────────────────────
          // The MongoDB driver mutates the document in-place to set _id, and
          // result.insertedId / result.insertedIds holds the same value.
          // We snapshot here so retries have stable references.
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

          // ── Non-blocking secondary sync ───────────────────────────────────
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

      // All non-write properties/methods pass straight through to the primary.
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
 * After every successful write on any collection of any database, the same
 * operation is replicated asynchronously to the secondary MongoDB.
 *
 * Call this once during app startup (already done inside lib/mongodb.ts).
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
      maxAttempts: item.maxAttempts,
      firstFailedAt: item.firstFailedAt,
      lastAttemptAt: item.lastAttemptAt,
    })),
  }
}
