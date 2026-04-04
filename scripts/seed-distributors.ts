import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

const distributors = [
  {
    name: "Premium Liquor Distributors",
    contactPerson: "Michael Johnson",
    phone: "+1 555-2001",
    email: "michael@premiumliquor.com",
    address: "123 Distribution Ave, New York, NY 10001",
    region: "Northeast",
    volumeMonthly: 5000,
    deliveryFrequency: "Weekly",
    notes: "Primary distributor for premium products",
  },
  {
    name: "Regional Beverage Network",
    contactPerson: "Sarah Williams",
    phone: "+1 555-2002",
    email: "sarah@regionalbev.com",
    address: "456 Network Blvd, Los Angeles, CA 90001",
    region: "West Coast",
    volumeMonthly: 3500,
    deliveryFrequency: "Bi-weekly",
    notes: "Covers multiple states in the region",
  },
  {
    name: "Retail Branch - Downtown",
    contactPerson: "James Wilson",
    phone: "+1 555-2009",
    email: "james@retaildowntown.com",
    address: "369 Main Street, Chicago, IL 60601",
    region: "Midwest",
    volumeMonthly: 2000,
    deliveryFrequency: "Daily",
    notes: "Main retail location",
  },
  {
    name: "Retail Branch - Uptown",
    contactPerson: "Emily Taylor",
    phone: "+1 555-2010",
    email: "emily@retailuptown.com",
    address: "741 Commerce Blvd, Boston, MA 02101",
    region: "Northeast",
    volumeMonthly: 1800,
    deliveryFrequency: "Daily",
    notes: "Secondary retail location",
  },
]

async function seedDistributors() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_distributors')
    
    // Check for existing distributors
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing distributors.`)
      console.log('   Adding new distributors...')
    }
    
    // Add timestamps to each distributor
    const distributorsWithTimestamps = distributors.map(distributor => ({
      ...distributor,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    
    // Insert distributors (skip duplicates by name)
    let insertedCount = 0
    let skippedCount = 0
    
    for (const distributor of distributorsWithTimestamps) {
      const existing = await collection.findOne({ 
        name: { $regex: new RegExp(`^${distributor.name}$`, 'i') }
      })
      
      if (!existing) {
        await collection.insertOne(distributor)
        insertedCount++
        console.log(`   ✅ Added: ${distributor.name}`)
      } else {
        skippedCount++
        console.log(`   ⏭️  Skipped (already exists): ${distributor.name}`)
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   - New distributors added: ${insertedCount}`)
    console.log(`   - Skipped (duplicates): ${skippedCount}`)
    console.log(`   - Total distributors in database: ${await collection.countDocuments({})}`)
    
  } catch (error) {
    console.error('❌ Error seeding distributors:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedDistributors()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })
