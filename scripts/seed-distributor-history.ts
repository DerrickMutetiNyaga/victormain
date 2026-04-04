import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

// Sample history for Premium Liquor Distributors
const historyData = [
  {
    distributorName: "Premium Liquor Distributors",
    noteId: "DN-2024-001",
    batchNumber: "JB-2024-015",
    date: new Date("2024-12-15T10:00:00"),
    items: [
      { size: "500ml", quantity: 120 },
      { size: "1L", quantity: 80 },
    ],
    status: "Delivered",
    vehicle: "Truck-001",
    driver: "John Smith",
    deliveryLocation: "123 Distribution Ave, New York, NY 10001",
    timeOut: new Date("2024-12-15T08:00:00"),
    timeDelivered: new Date("2024-12-15T14:30:00"),
  },
  {
    distributorName: "Premium Liquor Distributors",
    noteId: "DN-2024-002",
    batchNumber: "JB-2024-012",
    date: new Date("2024-12-10T09:00:00"),
    items: [
      { size: "500ml", quantity: 100 },
      { size: "2L", quantity: 50 },
    ],
    status: "Delivered",
    vehicle: "Truck-001",
    driver: "John Smith",
    deliveryLocation: "123 Distribution Ave, New York, NY 10001",
    timeOut: new Date("2024-12-10T07:30:00"),
    timeDelivered: new Date("2024-12-10T13:15:00"),
  },
  {
    distributorName: "Premium Liquor Distributors",
    noteId: "DN-2024-003",
    batchNumber: "JB-2024-008",
    date: new Date("2024-12-05T11:00:00"),
    items: [
      { size: "1L", quantity: 150 },
    ],
    status: "Delivered",
    vehicle: "Truck-002",
    driver: "Mike Johnson",
    deliveryLocation: "123 Distribution Ave, New York, NY 10001",
    timeOut: new Date("2024-12-05T09:00:00"),
    timeDelivered: new Date("2024-12-05T15:00:00"),
  },
  {
    distributorName: "Regional Beverage Network",
    noteId: "DN-2024-004",
    batchNumber: "JB-2024-014",
    date: new Date("2024-12-12T08:00:00"),
    items: [
      { size: "500ml", quantity: 200 },
      { size: "1L", quantity: 100 },
      { size: "2L", quantity: 60 },
    ],
    status: "Delivered",
    vehicle: "Van-005",
    driver: "Sarah Williams",
    deliveryLocation: "456 Network Blvd, Los Angeles, CA 90001",
    timeOut: new Date("2024-12-12T06:00:00"),
    timeDelivered: new Date("2024-12-12T16:45:00"),
  },
  {
    distributorName: "Regional Beverage Network",
    noteId: "DN-2024-005",
    batchNumber: "JB-2024-010",
    date: new Date("2024-12-01T09:30:00"),
    items: [
      { size: "500ml", quantity: 180 },
      { size: "1L", quantity: 90 },
    ],
    status: "Delivered",
    vehicle: "Van-005",
    driver: "Sarah Williams",
    deliveryLocation: "456 Network Blvd, Los Angeles, CA 90001",
    timeOut: new Date("2024-12-01T07:30:00"),
    timeDelivered: new Date("2024-12-01T14:20:00"),
  },
  {
    distributorName: "Retail Branch - Downtown",
    noteId: "DN-2024-006",
    batchNumber: "JB-2024-016",
    date: new Date("2024-12-16T07:00:00"),
    items: [
      { size: "500ml", quantity: 50 },
      { size: "1L", quantity: 30 },
    ],
    status: "Delivered",
    vehicle: "Car-010",
    driver: "James Wilson",
    deliveryLocation: "369 Main Street, Chicago, IL 60601",
    timeOut: new Date("2024-12-16T06:00:00"),
    timeDelivered: new Date("2024-12-16T08:30:00"),
  },
  {
    distributorName: "Retail Branch - Downtown",
    noteId: "DN-2024-007",
    batchNumber: "JB-2024-013",
    date: new Date("2024-12-11T07:00:00"),
    items: [
      { size: "500ml", quantity: 45 },
      { size: "1L", quantity: 25 },
    ],
    status: "Delivered",
    vehicle: "Car-010",
    driver: "James Wilson",
    deliveryLocation: "369 Main Street, Chicago, IL 60601",
    timeOut: new Date("2024-12-11T06:00:00"),
    timeDelivered: new Date("2024-12-11T08:15:00"),
  },
  {
    distributorName: "Retail Branch - Uptown",
    noteId: "DN-2024-008",
    batchNumber: "JB-2024-011",
    date: new Date("2024-12-08T08:00:00"),
    items: [
      { size: "500ml", quantity: 40 },
      { size: "1L", quantity: 20 },
    ],
    status: "Delivered",
    vehicle: "Car-011",
    driver: "Emily Taylor",
    deliveryLocation: "741 Commerce Blvd, Boston, MA 02101",
    timeOut: new Date("2024-12-08T07:00:00"),
    timeDelivered: new Date("2024-12-08T09:00:00"),
  },
]

async function seedDistributorHistory() {
  const client = new MongoClient(MONGODB_URI!)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('infusion_jaba')
    const collection = db.collection('jaba_distributorHistory')
    
    // Check for existing history
    const existing = await collection.find({}).toArray()
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing history entries.`)
      console.log('   Adding new history entries...')
    }
    
    // Insert history (skip duplicates by noteId)
    let insertedCount = 0
    let skippedCount = 0
    
    for (const history of historyData) {
      const existing = await collection.findOne({ 
        noteId: history.noteId
      })
      
      if (!existing) {
        await collection.insertOne(history)
        insertedCount++
        console.log(`   ✅ Added: ${history.noteId} for ${history.distributorName}`)
      } else {
        skippedCount++
        console.log(`   ⏭️  Skipped (already exists): ${history.noteId}`)
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   - New history entries added: ${insertedCount}`)
    console.log(`   - Skipped (duplicates): ${skippedCount}`)
    console.log(`   - Total history entries in database: ${await collection.countDocuments({})}`)
    
  } catch (error) {
    console.error('❌ Error seeding distributor history:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedDistributorHistory()
  .then(() => {
    console.log('✨ Seed completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error)
    process.exit(1)
  })

