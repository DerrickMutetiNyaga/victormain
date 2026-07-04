/**
 * Ensures the given email is a super_admin in bar_users (Catha).
 * Default email: infusionjaba@gmail.com
 *
 * Run: npm run seed-catha-super-admin
 * Or: npx tsx scripts/seed-catha-super-admin.ts
 * Set SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_NAME in .env to override.
 *
 * - If a user with that email exists: updates their role to super_admin and status to active.
 * - If no user with that email exists: creates a new document (they can sign in with Google to link).
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'bar_users'

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || 'infusionjaba@gmail.com'
const SUPER_ADMIN_NAME = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const col = db.collection(COLLECTION)
    const existingByEmail = await col.findOne({ email: SUPER_ADMIN_EMAIL })
    if (existingByEmail) {
      if (existingByEmail.role === 'super_admin') {
        console.log('User already super_admin:', SUPER_ADMIN_EMAIL)
        return
      }
      await col.updateOne(
        { email: SUPER_ADMIN_EMAIL },
        { $set: { role: 'super_admin', status: 'active' } }
      )
      console.log('Updated user to super_admin:', SUPER_ADMIN_EMAIL)
      console.log('Sign in at /catha/login with this Google account to access /catha/users.')
      return
    }
    const doc = {
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active',
      permissions: [],
      createdAt: new Date(),
    }
    await col.insertOne(doc)
    console.log('Created super_admin:', doc.email)
    console.log('Sign in at /catha/login with this Google account to access /catha/users.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
