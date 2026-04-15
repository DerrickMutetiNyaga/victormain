import 'dotenv/config'
import { MongoClient } from 'mongodb'
import {
  batches,
  rawMaterials,
  distributors,
  deliveryNotes,
  materialUsageLogs,
  qcResults,
  packagingOutputs,
  finishedGoods,
  stockMovements,
  productionOutputs,
  packagingSessions,
} from '../lib/jaba-data'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

async function seedDatabase() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    // Use specific database name for Jaba data
    const db = client.db('infusion_jaba')
    console.log('Using database: infusion_jaba')

    // Clear existing collections (optional - comment out if you want to keep existing data)
    // Using 'jaba_' prefix to separate from /bar data
    console.log('Clearing existing Jaba collections...')
    await db.collection('jaba_batches').deleteMany({})
    await db.collection('jaba_rawMaterials').deleteMany({})
    await db.collection('jaba_distributors').deleteMany({})
    await db.collection('jaba_deliveryNotes').deleteMany({})
    await db.collection('jaba_materialUsageLogs').deleteMany({})
    await db.collection('jaba_qcResults').deleteMany({})
    await db.collection('jaba_packagingOutputs').deleteMany({})
    await db.collection('jaba_finishedGoods').deleteMany({})
    await db.collection('jaba_stockMovements').deleteMany({})
    await db.collection('jaba_productionOutputs').deleteMany({})
    await db.collection('jaba_packagingSessions').deleteMany({})
    await db.collection('jaba_flavors').deleteMany({})

    // Convert Date objects to proper format
    const convertDates = (obj: any): any => {
      if (obj === null || obj === undefined) return obj
      if (obj instanceof Date) return obj
      if (Array.isArray(obj)) return obj.map(convertDates)
      if (typeof obj === 'object') {
        const converted: any = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertDates(value)
        }
        return converted
      }
      return obj
    }

    // Seed batches
    console.log('Seeding batches...')
    const batchesData = batches.map(convertDates)
    if (batchesData.length > 0) {
      await db.collection('jaba_batches').insertMany(batchesData)
      console.log(`✓ Inserted ${batchesData.length} batches`)
    }

    // Seed raw materials
    console.log('Seeding raw materials...')
    const rawMaterialsData = rawMaterials.map(convertDates)
    if (rawMaterialsData.length > 0) {
      await db.collection('jaba_rawMaterials').insertMany(rawMaterialsData)
      console.log(`✓ Inserted ${rawMaterialsData.length} raw materials`)
    }

    // Seed distributors
    console.log('Seeding distributors...')
    const distributorsData = distributors.map(convertDates)
    if (distributorsData.length > 0) {
      await db.collection('jaba_distributors').insertMany(distributorsData)
      console.log(`✓ Inserted ${distributorsData.length} distributors`)
    }

    // Seed delivery notes
    console.log('Seeding delivery notes...')
    const deliveryNotesData = deliveryNotes.map(convertDates)
    if (deliveryNotesData.length > 0) {
      await db.collection('jaba_deliveryNotes').insertMany(deliveryNotesData)
      console.log(`✓ Inserted ${deliveryNotesData.length} delivery notes`)
    }

    // Seed material usage logs
    console.log('Seeding material usage logs...')
    const materialUsageLogsData = materialUsageLogs.map(convertDates)
    if (materialUsageLogsData.length > 0) {
      await db.collection('jaba_materialUsageLogs').insertMany(materialUsageLogsData)
      console.log(`✓ Inserted ${materialUsageLogsData.length} material usage logs`)
    }

    // Seed QC results
    console.log('Seeding QC results...')
    const qcResultsData = qcResults.map(convertDates)
    if (qcResultsData.length > 0) {
      await db.collection('jaba_qcResults').insertMany(qcResultsData)
      console.log(`✓ Inserted ${qcResultsData.length} QC results`)
    }

    // Seed packaging outputs
    console.log('Seeding packaging outputs...')
    const packagingOutputsData = packagingOutputs.map(convertDates)
    if (packagingOutputsData.length > 0) {
      await db.collection('jaba_packagingOutputs').insertMany(packagingOutputsData)
      console.log(`✓ Inserted ${packagingOutputsData.length} packaging outputs`)
    }

    // Seed finished goods
    console.log('Seeding finished goods...')
    const finishedGoodsData = finishedGoods.map(convertDates)
    if (finishedGoodsData.length > 0) {
      await db.collection('jaba_finishedGoods').insertMany(finishedGoodsData)
      console.log(`✓ Inserted ${finishedGoodsData.length} finished goods`)
    }

    // Seed stock movements
    console.log('Seeding stock movements...')
    const stockMovementsData = stockMovements.map(convertDates)
    if (stockMovementsData.length > 0) {
      await db.collection('jaba_stockMovements').insertMany(stockMovementsData)
      console.log(`✓ Inserted ${stockMovementsData.length} stock movements`)
    }

    // Seed production outputs
    console.log('Seeding production outputs...')
    const productionOutputsData = productionOutputs.map(convertDates)
    if (productionOutputsData.length > 0) {
      await db.collection('jaba_productionOutputs').insertMany(productionOutputsData)
      console.log(`✓ Inserted ${productionOutputsData.length} production outputs`)
    }

    // Seed packaging sessions
    console.log('Seeding packaging sessions...')
    const packagingSessionsData = packagingSessions.map(convertDates)
    if (packagingSessionsData.length > 0) {
      await db.collection('jaba_packagingSessions').insertMany(packagingSessionsData)
      console.log(`✓ Inserted ${packagingSessionsData.length} packaging sessions`)
    }

    // Seed flavors
    console.log('Seeding flavors...')
    const flavors = ['dawa', 'pineapple', 'berry', 'hibiscus']
    const flavorsData = flavors.map(name => ({
      name,
      createdAt: new Date(),
    }))
    if (flavorsData.length > 0) {
      await db.collection('jaba_flavors').insertMany(flavorsData)
      console.log(`✓ Inserted ${flavorsData.length} flavors`)
    }

    console.log('\n✅ Database seeding completed successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  } finally {
    await client.close()
    console.log('MongoDB connection closed')
  }
}

seedDatabase()
  .then(() => {
    console.log('Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

