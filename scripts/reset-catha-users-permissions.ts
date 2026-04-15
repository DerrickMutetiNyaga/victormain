/**
 * Reset / seed Catha users permissions (CATHA-ONLY).
 *
 * Usage:
 *  - npm run reset-catha-permissions
 *  - or: npx tsx scripts/reset-catha-users-permissions.ts
 *
 * Env:
 *  - MONGODB_URI (required)
 *  - CATHA_SUPER_ADMIN_EMAIL (optional): email to grant SUPER_ADMIN template
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { ROLE_TEMPLATES, normalizePermissions } from '@/lib/catha-permissions-model'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'catha_users'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('[reset-catha-users-permissions] Missing MONGODB_URI')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const col = db.collection(COLLECTION)

    const superAdminEmail = process.env.CATHA_SUPER_ADMIN_EMAIL?.trim()

    console.log('[reset-catha-users-permissions] Starting reset for catha_users')

    // Clear permissions for all users
    const clearRes = await col.updateMany({}, { $set: { permissions: {} } })
    console.log(
      `[reset-catha-users-permissions] Cleared permissions for ${clearRes.modifiedCount} catha_users documents`
    )

    if (superAdminEmail) {
      const existing = await col.findOne({ email: superAdminEmail })
      if (existing) {
        const perms = normalizePermissions(ROLE_TEMPLATES.SUPER_ADMIN)
        await col.updateOne(
          { email: superAdminEmail },
          {
            $set: {
              role: 'SUPER_ADMIN',
              status: 'ACTIVE',
              permissions: perms,
            },
          }
        )
        console.log(
          `[reset-catha-users-permissions] Applied SUPER_ADMIN template to ${superAdminEmail} in catha_users`
        )
      } else {
        console.warn(
          `[reset-catha-users-permissions] CATHA_SUPER_ADMIN_EMAIL=${superAdminEmail} not found in catha_users`
        )
      }
    } else {
      console.log(
        '[reset-catha-users-permissions] No CATHA_SUPER_ADMIN_EMAIL set, skipped SUPER_ADMIN template seeding'
      )
    }

    console.log('[reset-catha-users-permissions] Done.')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[reset-catha-users-permissions] Fatal error:', err)
  process.exit(1)
})

