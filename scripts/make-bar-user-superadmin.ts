import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

// Email to update - change this to the user's email
const USER_EMAIL = 'infusionjaba@gmail.com'

async function makeUserSuperAdmin() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')

    const db = client.db('infusion_jaba')
    console.log('📊 Using database: infusion_jaba')

    const usersCollection = db.collection('bar_users')
    
    // Find user by email
    const user = await usersCollection.findOne({ email: USER_EMAIL })
    
    if (!user) {
      console.log(`\n❌ User with email ${USER_EMAIL} not found in bar_users collection`)
      console.log('\n📋 Available users in bar_users:')
      const allUsers = await usersCollection.find({}).toArray()
      if (allUsers.length === 0) {
        console.log('  No users found')
      } else {
        allUsers.forEach((u, index) => {
          console.log(`  ${index + 1}. ${u.name || 'N/A'} (${u.email}) - Role: ${u.role || 'pending'}`)
        })
      }
      await client.close()
      return
    }

    console.log(`\n👤 Found user: ${user.name} (${user.email})`)
    console.log(`   Current role: ${user.role || 'pending'}`)
    console.log(`   Current approved: ${user.approved || false}`)

    // Update user to super_admin
    const result = await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          role: 'super_admin',
          approved: true
        } 
      }
    )

    if (result.modifiedCount > 0) {
      console.log(`\n✅ Successfully updated user to super_admin!`)
      
      // Verify the update
      const updatedUser = await usersCollection.findOne({ _id: user._id })
      console.log(`\n📋 Updated user details:`)
      console.log(`   Name: ${updatedUser?.name}`)
      console.log(`   Email: ${updatedUser?.email}`)
      console.log(`   Role: ${updatedUser?.role}`)
      console.log(`   Approved: ${updatedUser?.approved}`)
    } else {
      console.log(`\n⚠️  User was already super_admin or update failed`)
    }

    await client.close()
    console.log('\n✅ Done!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error updating user:', error.message)
    await client.close()
    process.exit(1)
  }
}

makeUserSuperAdmin()

