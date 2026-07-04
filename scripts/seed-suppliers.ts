import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

const suppliers = [
  {
    name: "Water Supplier",
    category: "Raw Material",
    contactPerson: "Water Supply Manager",
    phone: "+1 555-0100",
    email: "water@supplier.com",
    address: "123 Water Street, City, State 12345",
    itemsSupplied: ["Water"],
    type: "External Supplier",
  },
  {
    name: "Flavors Supplier",
    category: "Raw Material",
    contactPerson: "Flavor Manager",
    phone: "+1 555-0101",
    email: "flavors@supplier.com",
    address: "456 Flavor Avenue, City, State 12345",
    itemsSupplied: ["Pineapple", "Dawa"],
    type: "External Supplier",
  },
  {
    name: "Containers Supplier",
    category: "Packaging",
    contactPerson: "Container Manager",
    phone: "+1 555-0102",
    email: "containers@supplier.com",
    address: "789 Container Road, City, State 12345",
    itemsSupplied: ["Containers"],
    type: "External Supplier",
  },
  {
    name: "Branding Papers Supplier",
    category: "Packaging",
    contactPerson: "Branding Manager",
    phone: "+1 555-0103",
    email: "branding@supplier.com",
    address: "321 Branding Boulevard, City, State 12345",
    itemsSupplied: ["Branding Papers"],
    type: "External Supplier",
  },
]

async function seedSuppliers() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_suppliers')
    
    // Check for existing suppliers
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing suppliers.`)
      console.log('   Adding new suppliers...')
    }
    
    // Add timestamps to each supplier
    const suppliersWithTimestamps = suppliers.map(supplier => ({
      ...supplier,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    
    // Insert suppliers (skip duplicates by name)
    let insertedCount = 0
    let skippedCount = 0
    
    for (const supplier of suppliersWithTimestamps) {
      const existing = await collection.findOne({ 
        name: { $regex: new RegExp(`^${supplier.name}$`, 'i') }
      })
      
      if (!existing) {
        await collection.insertOne(supplier)
        insertedCount++
        console.log(`   ✅ Added: ${supplier.name}`)
      } else {
        skippedCount++
        console.log(`   ⏭️  Skipped (already exists): ${supplier.name}`)
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   - New suppliers added: ${insertedCount}`)
    console.log(`   - Skipped (duplicates): ${skippedCount}`)
    console.log(`   - Total suppliers in database: ${await collection.countDocuments({})}`)
    
  } catch (error) {
    console.error('❌ Error seeding suppliers:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedSuppliers()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })

