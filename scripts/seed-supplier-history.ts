import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

// Sample history for suppliers - using actual supplier names from database
const historyData = [
  {
    supplierName: "Water Supplier",
    itemName: "Purified Water",
    quantity: 5000,
    unit: "Liters",
    date: new Date("2024-12-15T10:00:00"),
    type: "Restock",
    batchNumber: "WB-2024-001",
    lotNumber: "LOT-001",
    cost: 250.00,
  },
  {
    supplierName: "Water Supplier",
    itemName: "Purified Water",
    quantity: 3000,
    unit: "Liters",
    date: new Date("2024-12-10T09:00:00"),
    type: "Restock",
    batchNumber: "WB-2024-002",
    lotNumber: "LOT-002",
    cost: 150.00,
  },
  {
    supplierName: "Water Supplier",
    itemName: "Purified Water",
    quantity: 2000,
    unit: "Liters",
    date: new Date("2024-12-05T11:00:00"),
    type: "Usage",
    batchNumber: "JB-2024-015",
    lotNumber: "LOT-003",
    cost: 100.00,
  },
  {
    supplierName: "Flavors Supplier",
    itemName: "Pineapple Flavoring",
    quantity: 50,
    unit: "Bottles",
    date: new Date("2024-12-14T08:00:00"),
    type: "Restock",
    batchNumber: "FB-2024-001",
    lotNumber: "LOT-PA-001",
    cost: 450.00,
  },
  {
    supplierName: "Flavors Supplier",
    itemName: "Dawa Flavoring",
    quantity: 45,
    unit: "Bottles",
    date: new Date("2024-12-14T08:00:00"),
    type: "Restock",
    batchNumber: "FB-2024-002",
    lotNumber: "LOT-DW-001",
    cost: 420.00,
  },
  {
    supplierName: "Flavors Supplier",
    itemName: "Pineapple Flavoring",
    quantity: 20,
    unit: "Bottles",
    date: new Date("2024-12-08T10:00:00"),
    type: "Usage",
    batchNumber: "JB-2024-012",
    lotNumber: "LOT-PA-002",
    cost: 180.00,
  },
  {
    supplierName: "Flavors Supplier",
    itemName: "Dawa Flavoring",
    quantity: 15,
    unit: "Bottles",
    date: new Date("2024-12-08T10:00:00"),
    type: "Usage",
    batchNumber: "JB-2024-012",
    lotNumber: "LOT-DW-002",
    cost: 140.00,
  },
  {
    supplierName: "Containers Supplier",
    itemName: "Glass Bottles 500ml",
    quantity: 2000,
    unit: "Units",
    date: new Date("2024-12-13T09:00:00"),
    type: "Restock",
    batchNumber: "PB-2024-001",
    lotNumber: "LOT-GB-001",
    cost: 1200.00,
  },
  {
    supplierName: "Containers Supplier",
    itemName: "Glass Bottles 1L",
    quantity: 1500,
    unit: "Units",
    date: new Date("2024-12-13T09:00:00"),
    type: "Restock",
    batchNumber: "PB-2024-002",
    lotNumber: "LOT-GB-002",
    cost: 1350.00,
  },
  {
    supplierName: "Containers Supplier",
    itemName: "Glass Bottles 500ml",
    quantity: 500,
    unit: "Units",
    date: new Date("2024-12-06T11:00:00"),
    type: "Usage",
    batchNumber: "JB-2024-010",
    lotNumber: "LOT-GB-003",
    cost: 300.00,
  },
  {
    supplierName: "Branding Papers Supplier",
    itemName: "Label Papers",
    quantity: 5000,
    unit: "Sheets",
    date: new Date("2024-12-12T08:00:00"),
    type: "Restock",
    batchNumber: "BM-2024-001",
    lotNumber: "LOT-LP-001",
    cost: 350.00,
  },
  {
    supplierName: "Branding Papers Supplier",
    itemName: "Label Papers",
    quantity: 2000,
    unit: "Sheets",
    date: new Date("2024-12-07T10:00:00"),
    type: "Usage",
    batchNumber: "JB-2024-011",
    lotNumber: "LOT-LP-002",
    cost: 140.00,
  },
  {
    supplierName: "Branding Papers Supplier",
    itemName: "Branding Stickers",
    quantity: 3000,
    unit: "Units",
    date: new Date("2024-12-12T08:00:00"),
    type: "Restock",
    batchNumber: "BM-2024-002",
    lotNumber: "LOT-BS-001",
    cost: 450.00,
  },
]

async function seedSupplierHistory() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_supplierHistory')
    
    // Check for existing history
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing history entries.`)
      console.log('   Adding new history entries...')
    }
    
    // First, clear existing history to avoid duplicates
    console.log('   Clearing existing supplier history...')
    await collection.deleteMany({})
    
    // Insert history
    let insertedCount = 0
    
    for (const history of historyData) {
      await collection.insertOne(history)
      insertedCount++
      console.log(`   ✅ Added: ${history.itemName} for ${history.supplierName} (${history.type})`)
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   - New history entries added: ${insertedCount}`)
    console.log(`   - Total history entries in database: ${await collection.countDocuments({})}`)
    
  } catch (error) {
    console.error('❌ Error seeding supplier history:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedSupplierHistory()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })

