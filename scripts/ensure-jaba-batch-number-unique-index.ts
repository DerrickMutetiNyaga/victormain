/**
 * Creates the unique partial index on jaba_batches.batchNumber.
 *
 * Run once against your MongoDB (production/staging) before relying on API duplicate protection:
 *   npx tsx scripts/ensure-jaba-batch-number-unique-index.ts
 *
 * Requires MONGODB_URI in .env. Exits with error if duplicate batch numbers exist.
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { ensureJabaBatchNumberUniqueIndex } from '../lib/jaba-batch-number-index'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'infusion_jaba'

async function main() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI in environment.')
    process.exit(1)
  }

  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    const db = client.db(DB_NAME)

    const duplicates = await db
      .collection('jaba_batches')
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            batchNumber: { $exists: true, $type: 'string', $ne: '' },
          },
        },
        { $group: { _id: '$batchNumber', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray()

    if (duplicates.length > 0) {
      console.error(
        'Cannot create unique index: duplicate batchNumber values exist. Resolve these first:'
      )
      for (const d of duplicates) {
        console.error(`  - "${d._id}" (${d.count} documents)`)
      }
      process.exit(1)
    }

    await ensureJabaBatchNumberUniqueIndex(db)
    console.log('✅ Unique index on jaba_batches.batchNumber ensured (partial, non-empty strings).')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
