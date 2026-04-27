/**
 * One-time backfill:
 * Ensure ACTIVE Catha cashiers always have `permissions.myShift.view = true`.
 *
 * Safe behavior:
 * - Touches only users where role === CASHIER and status === ACTIVE
 * - Preserves all existing permissions
 * - Only patches missing/malformed myShift view permission
 *
 * Usage:
 *   npm run backfill-catha-cashier-my-shift
 *   npm run backfill-catha-cashier-my-shift -- --dry-run
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { normalizePermissions } from '@/lib/catha-permissions-model'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_users'

const CASHIER_MY_SHIFT_MIN_PERMS = { view: true, add: false, edit: false, delete: false } as const

function hasValidMyShiftViewPermission(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return obj.view === true
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const dryRun = process.argv.includes('--dry-run')
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const col = client.db(DB_NAME).collection(COLLECTION)

    const candidates = await col
      .find(
        { role: 'CASHIER', status: 'ACTIVE' },
        { projection: { email: 1, permissions: 1 } }
      )
      .toArray()

    let updatedCount = 0
    let skippedCount = 0

    for (const user of candidates) {
      const normalized = normalizePermissions(user.permissions ?? {})
      if (hasValidMyShiftViewPermission(normalized.myShift)) {
        skippedCount += 1
        continue
      }

      normalized.myShift = { ...CASHIER_MY_SHIFT_MIN_PERMS }

      if (!dryRun) {
        await col.updateOne(
          { _id: user._id },
          { $set: { permissions: normalized, updatedAt: new Date() } }
        )
      }

      updatedCount += 1
      console.log(`${dryRun ? '[dry-run] would patch' : 'patched'} cashier: ${user.email ?? String(user._id)}`)
    }

    console.log('--- backfill summary ---')
    console.log('cashier candidates:', candidates.length)
    console.log('patched:', updatedCount)
    console.log('already-valid:', skippedCount)
    console.log('mode:', dryRun ? 'dry-run (no writes)' : 'apply')
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('[backfill-catha-cashier-my-shift] failed:', error?.message || error)
  process.exit(1)
})
