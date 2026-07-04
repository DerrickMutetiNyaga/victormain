import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env')
}

// Categories currently used in the bar inventory / dummy data
const barCategories = [
  { id: 'whiskey', name: 'Whiskey', icon: '🥃', color: '#D4A574' },
  { id: 'vodka', name: 'Vodka', icon: '🍸', color: '#E8E8E8' },
  { id: 'rum', name: 'Rum', icon: '🍹', color: '#C4956A' },
  { id: 'gin', name: 'Gin', icon: '🌿', color: '#A8D5BA' },
  { id: 'beer', name: 'Beer', icon: '🍺', color: '#F5C842' },
  { id: 'wine', name: 'Wine', icon: '🍷', color: '#722F37' },
  { id: 'cocktails', name: 'Cocktails', icon: '🍸', color: '#FF6B6B' },
  { id: 'soft-drinks', name: 'Soft Drinks', icon: '🥤', color: '#4ECDC4' },
  { id: 'jaba', name: 'Jaba', icon: '🌿', color: '#7CB342' },
]

// Size / volume options currently used in the inventory UI
const barVolumes = [
  '250ml',
  '330ml',
  '500ml',
  '750ml',
  '1L',
  '5L',
]

async function seedBarCategoriesAndVolumes() {
  const client = new MongoClient(MONGODB_URI!)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')

    const db = client.db('infusion_jaba')
    const categoriesCollection = db.collection('bar_categories')
    const volumesCollection = db.collection('bar_volumes')

    // Seed categories if collection is empty
    const existingCategoriesCount = await categoriesCollection.countDocuments({})
    if (existingCategoriesCount === 0) {
      const now = new Date()
      const docs = barCategories.map((cat) => ({
        code: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        createdAt: now,
        updatedAt: now,
      }))

      const result = await categoriesCollection.insertMany(docs)
      console.log(`✅ Seeded ${result.insertedCount} bar categories to bar_categories collection`)
    } else {
      console.log(`ℹ️  bar_categories already has ${existingCategoriesCount} documents. Skipping category seed.`)
    }

    // Seed volumes if collection is empty
    const existingVolumesCount = await volumesCollection.countDocuments({})
    if (existingVolumesCount === 0) {
      const now = new Date()
      const docs = barVolumes.map((value, index) => ({
        value,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      }))

      const result = await volumesCollection.insertMany(docs)
      console.log(`✅ Seeded ${result.insertedCount} volume options to bar_volumes collection`)
    } else {
      console.log(`ℹ️  bar_volumes already has ${existingVolumesCount} documents. Skipping volume seed.`)
    }

    console.log('\n✨ Seed completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding bar categories / volumes:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

seedBarCategoriesAndVolumes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

