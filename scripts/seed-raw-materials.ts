import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

const rawMaterials = [
  { name: "Premium Whiskey Base", category: "Base Spirit", currentStock: 450, unit: "litres", minStock: 100, reorderLevel: 100, supplier: "Premium Spirits Ltd", lastRestocked: new Date("2024-11-15"), preferredSupplier: "Premium Spirits Ltd" },
  { name: "Organic Honey", category: "Flavoring", currentStock: 120, unit: "kg", minStock: 30, reorderLevel: 30, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-20"), preferredSupplier: "Natural Ingredients Co" },
  { name: "Fresh Herbs Mix", category: "Flavoring", currentStock: 85, unit: "kg", minStock: 20, reorderLevel: 20, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-18"), preferredSupplier: "Herb Suppliers Ltd" },
  { name: "Citrus Extract", category: "Flavoring", currentStock: 95, unit: "litres", minStock: 25, reorderLevel: 25, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-22"), preferredSupplier: "Natural Ingredients Co" },
  { name: "Vanilla Beans", category: "Flavoring", currentStock: 45, unit: "kg", minStock: 10, reorderLevel: 10, supplier: "Spice Importers", lastRestocked: new Date("2024-11-10"), preferredSupplier: "Spice Importers" },
  { name: "Cinnamon Sticks", category: "Flavoring", currentStock: 60, unit: "kg", minStock: 15, reorderLevel: 15, supplier: "Spice Importers", lastRestocked: new Date("2024-11-12"), preferredSupplier: "Spice Importers" },
  { name: "Lavender Flowers", category: "Flavoring", currentStock: 35, unit: "kg", minStock: 8, reorderLevel: 8, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-08"), preferredSupplier: "Herb Suppliers Ltd" },
  { name: "Fresh Mint", category: "Flavoring", currentStock: 50, unit: "kg", minStock: 12, reorderLevel: 12, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-14"), preferredSupplier: "Herb Suppliers Ltd" },
  { name: "Peach Extract", category: "Flavoring", currentStock: 70, unit: "litres", minStock: 18, reorderLevel: 18, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-16"), preferredSupplier: "Natural Ingredients Co" },
  { name: "Ginger Root", category: "Flavoring", currentStock: 80, unit: "kg", minStock: 20, reorderLevel: 20, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-19"), preferredSupplier: "Herb Suppliers Ltd" },
  { name: "Coffee Beans", category: "Flavoring", currentStock: 100, unit: "kg", minStock: 25, reorderLevel: 25, supplier: "Coffee Importers", lastRestocked: new Date("2024-11-21"), preferredSupplier: "Coffee Importers" },
  { name: "Cocoa Powder", category: "Flavoring", currentStock: 55, unit: "kg", minStock: 12, reorderLevel: 12, supplier: "Spice Importers", lastRestocked: new Date("2024-11-13"), preferredSupplier: "Spice Importers" },
  { name: "Distilled Water", category: "Base", currentStock: 2000, unit: "litres", minStock: 500, reorderLevel: 500, supplier: "Water Purification Co", lastRestocked: new Date("2024-11-25"), preferredSupplier: "Water Purification Co" },
  { name: "Sugar Cane", category: "Base", currentStock: 300, unit: "kg", minStock: 75, reorderLevel: 75, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-17"), preferredSupplier: "Natural Ingredients Co" },
  { name: "500ml Bottles", category: "Packaging", currentStock: 5000, unit: "pcs", minStock: 1000, reorderLevel: 1000, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-24"), preferredSupplier: "Packaging Solutions Inc" },
  { name: "1L Bottles", category: "Packaging", currentStock: 3000, unit: "pcs", minStock: 800, reorderLevel: 800, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-23"), preferredSupplier: "Packaging Solutions Inc" },
  { name: "2L Bottles", category: "Packaging", currentStock: 1500, unit: "pcs", minStock: 400, reorderLevel: 400, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-22"), preferredSupplier: "Packaging Solutions Inc" },
  { name: "Labels", category: "Packaging", currentStock: 10000, unit: "pcs", minStock: 2000, reorderLevel: 2000, supplier: "Print Solutions Ltd", lastRestocked: new Date("2024-11-20"), preferredSupplier: "Print Solutions Ltd" },
]

async function seedRawMaterials() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_rawMaterials')
    
    // Clear existing materials (optional - comment out if you want to keep existing)
    // await collection.deleteMany({})
    // console.log('🗑️  Cleared existing raw materials')
    
    // Check for existing materials
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing raw materials. Skipping seed.`)
      console.log('   To re-seed, delete the collection first or clear it in the script.')
      return
    }
    
    // Add timestamps to each material
    const materialsWithTimestamps = rawMaterials.map(material => ({
      ...material,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    
    const result = await collection.insertMany(materialsWithTimestamps)
    console.log(`✅ Seeded ${result.insertedCount} raw materials to jaba_rawMaterials collection`)
    
    // Display summary
    const categories = await collection.distinct('category')
    console.log(`\n📊 Summary:`)
    console.log(`   - Total materials: ${result.insertedCount}`)
    console.log(`   - Categories: ${categories.join(', ')}`)
    
  } catch (error) {
    console.error('❌ Error seeding raw materials:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedRawMaterials()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })

