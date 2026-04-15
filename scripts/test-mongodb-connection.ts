import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env')
  process.exit(1)
}

console.log('Testing MongoDB connection...')
console.log('Connection string:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')) // Hide credentials

async function testConnection() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })

  try {
    console.log('\nAttempting to connect...')
    await client.connect()
    console.log('✅ Successfully connected to MongoDB!')
    
    const db = client.db('infusion_jaba')
    const collections = await db.listCollections().toArray()
    console.log(`\n📊 Database: infusion_jaba`)
    console.log(`📁 Collections found: ${collections.length}`)
    
    if (collections.length > 0) {
      console.log('\nCollections:')
      collections.forEach(col => {
        console.log(`  - ${col.name}`)
      })
      
      // Test query
      const batchCount = await db.collection('jaba_batches').countDocuments()
      console.log(`\n✅ jaba_batches collection has ${batchCount} documents`)
    } else {
      console.log('\n⚠️  No collections found. Make sure you\'ve run: npm run seed')
    }
    
    await client.close()
    console.log('\n✅ Connection test completed successfully!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Connection failed!')
    console.error('Error:', error.message)
    
    if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
      console.error('\n💡 DNS Resolution Issue Detected!')
      console.error('\nPossible solutions:')
      console.error('1. Check your internet connection')
      console.error('2. Verify MongoDB Atlas cluster is running (not paused)')
      console.error('3. Check Network Access in MongoDB Atlas - ensure your IP is whitelisted')
      console.error('4. Try using a VPN or different network')
      console.error('5. Check if your firewall/antivirus is blocking the connection')
    }
    
    process.exit(1)
  }
}

testConnection()

