import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

async function clearDistributors() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_distributors')
    
    // Count existing distributors
    const count = await collection.countDocuments({})
    console.log(`Found ${count} distributors in the database`)
    
    if (count === 0) {
      console.log('No distributors to delete.')
      return
    }
    
    // Delete all distributors
    const result = await collection.deleteMany({})
    
    console.log(`✅ Deleted ${result.deletedCount} distributor(s) from jaba_distributors collection`)
    
  } catch (error) {
    console.error('❌ Error clearing distributors:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

clearDistributors()
  .then(() => {
    console.log('✨ Clear completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Clear failed:', error)
    process.exit(1)
  })

