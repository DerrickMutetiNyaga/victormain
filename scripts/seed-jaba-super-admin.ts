/**
 * Ensures the given email is a super_admin in jaba_users (Jaba).
 * Default email: derrickmuteti2001@gmail.com
 *
 * Run: npm run seed-jaba-super-admin
 * Or: npx tsx scripts/seed-jaba-super-admin.ts
 * Set SEED_JABA_SUPER_ADMIN_EMAIL / SEED_JABA_SUPER_ADMIN_NAME in .env to override.
 *
 * - If a user with that email exists: updates their role to super_admin and status to active.
 * - If no user with that email exists: creates a new document (they can sign in with Google to link).
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'jaba_users'

const SUPER_ADMIN_EMAIL = process.env.SEED_JABA_SUPER_ADMIN_EMAIL || process.env.SEED_SUPER_ADMIN_EMAIL || 'derrickmuteti2001@gmail.com'
const SUPER_ADMIN_NAME = process.env.SEED_JABA_SUPER_ADMIN_NAME || process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin'

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
    // Match email case-insensitively (DB may have different casing)
    const existingByEmail = await col.findOne({ email: { $regex: new RegExp(`^${SUPER_ADMIN_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } })
    if (existingByEmail) {
      if (existingByEmail.role === 'super_admin') {
        console.log('Jaba user already super_admin:', existingByEmail.email)
        return
      }
      await col.updateOne(
        { _id: existingByEmail._id },
        { $set: { role: 'super_admin', status: 'active', approved: true } }
      )
      console.log('Updated Jaba user to super_admin:', existingByEmail.email)
      console.log('Sign in at /jaba/login with this Google account to access /jaba/users.')
      return
    }
    const doc = {
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      provider: 'google',
      providerId: '', // will be set on first Google sign-in
      role: 'super_admin',
      status: 'active',
      permissions: {},
      createdAt: new Date(),
    }
    await col.insertOne(doc)
    console.log('Created Jaba super_admin:', doc.email)
    console.log('Sign in at /jaba/login with this Google account to access /jaba/users.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
