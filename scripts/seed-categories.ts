import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

const categories = [
  { name: "Base Spirit" },
  { name: "Flavoring" },
  { name: "Base" },
  { name: "Packaging" },
]

async function seedCategories() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_categories')
    
    // Check for existing categories
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing categories. Skipping seed.`)
      console.log('   To re-seed, delete the collection first or clear it in the script.')
      return
    }
    
    // Add timestamps to each category
    const categoriesWithTimestamps = categories.map(category => ({
      ...category,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    
    const result = await collection.insertMany(categoriesWithTimestamps)
    console.log(`✅ Seeded ${result.insertedCount} categories to jaba_categories collection`)
    
    // Display summary
    console.log(`\n📊 Summary:`)
    console.log(`   - Total categories: ${result.insertedCount}`)
    console.log(`   - Categories: ${categories.map(c => c.name).join(', ')}`)
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedCategories()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })

