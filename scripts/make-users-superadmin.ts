import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

async function makeUsersSuperAdmin() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')

    const db = client.db('infusion_jaba')
    console.log('📊 Using database: infusion_jaba')

    const usersCollection = db.collection('jaba_users')
    
    // Get all users
    const users = await usersCollection.find({}).toArray()
    console.log(`\n👥 Found ${users.length} user(s) in database`)

    if (users.length === 0) {
      console.log('⚠️  No users found in database')
      await client.close()
      return
    }

    // Update all users to super_admin
    const result = await usersCollection.updateMany(
      {},
      { $set: { role: 'super_admin' } }
    )

    console.log(`\n✅ Updated ${result.modifiedCount} user(s) to super_admin role`)
    
    // Show updated users
    const updatedUsers = await usersCollection.find({}).toArray()
    console.log('\n📋 Updated users:')
    updatedUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`)
    })

    await client.close()
    console.log('\n✅ All users are now super admins!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error updating users:', error.message)
    await client.close()
    process.exit(1)
  }
}

makeUsersSuperAdmin()

