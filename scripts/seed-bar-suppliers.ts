import 'dotenv/config'
import clientPromise from '../lib/mongodb'

const sampleSuppliers = [
  {
    type: 'bar',
    name: 'Premium Spirits Distributors',
    category: 'Spirits',
    contact: 'John Kamau',
    email: 'john@premiumspirits.co.ke',
    phone: '+254 712 345 678',
    address: '123 Industrial Area, Nairobi, Kenya',
    balance: 12500.00,
    notes: 'Main supplier for premium whiskey and vodka. Payment terms: Net 30 days.',
    status: 'active',
    lastDelivery: new Date('2025-01-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'bar',
    name: 'East African Beverages Ltd',
    category: 'Beer & Soft Drinks',
    contact: 'Sarah Wanjiku',
    email: 'sarah@eabeverages.co.ke',
    phone: '+254 723 456 789',
    address: '456 Mombasa Road, Nairobi, Kenya',
    balance: 8750.00,
    notes: 'Local distributor for beer brands. Weekly deliveries available.',
    status: 'active',
    lastDelivery: new Date('2025-01-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'bar',
    name: 'Wine & Champagne Importers',
    category: 'Wine & Champagne',
    contact: 'Michael Ochieng',
    email: 'michael@wineimports.co.ke',
    phone: '+254 734 567 890',
    address: '789 Westlands, Nairobi, Kenya',
    balance: 28400.00,
    notes: 'Specializes in imported wines and champagne. Minimum order: Ksh 50,000.',
    status: 'active',
    lastDelivery: new Date('2025-01-18'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

async function seedBarSuppliers() {
  try {
    console.log('🌱 Starting to seed bar suppliers...')
    console.log('📡 Connecting to MongoDB...')

    const client = await clientPromise
    console.log('✅ Connected to MongoDB')

    const db = client.db('infusion_jaba')
    const collection = db.collection('bar_suppliers')

    // Clear existing bar suppliers
    console.log('🧹 Clearing existing bar suppliers...')
    const deleteResult = await collection.deleteMany({ type: 'bar' })
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing bar suppliers`)

    // Insert sample suppliers
    console.log('📦 Inserting sample suppliers...')
    const insertResult = await collection.insertMany(sampleSuppliers)
    console.log(`✅ Successfully inserted ${insertResult.insertedCount} suppliers`)

    // Display inserted suppliers
    console.log('\n📋 Inserted Suppliers:')
    sampleSuppliers.forEach((supplier, index) => {
      console.log(`  ${index + 1}. ${supplier.name} - ${supplier.category}`)
    })

    console.log('\n✨ Seeding completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding bar suppliers:', error)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  seedBarSuppliers()
    .then(() => {
      console.log('✅ Seed script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Seed script failed:', error)
      process.exit(1)
    })
}

export { seedBarSuppliers }

