import 'dotenv/config'
import clientPromise from '../lib/mongodb'

async function backfillProductVisibility() {
  const client = await clientPromise
  const db = client.db('infusion_jaba')

  const result = await db.collection('bar_inventory').updateMany(
    { type: 'bar', isVisible: { $exists: false } },
    { $set: { isVisible: true, updatedAt: new Date() } },
  )

  console.log(`Matched ${result.matchedCount} products`)
  console.log(`Updated ${result.modifiedCount} products`)
}

backfillProductVisibility()
  .then(() => {
    console.log('Done backfilling product visibility.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
