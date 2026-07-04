import type { Db } from 'mongodb'

const INDEX_NAME = 'jaba_batches_batchNumber_unique'

/**
 * Ensures a unique partial index on non-empty string batchNumber.
 * Documents without batchNumber (legacy) are excluded from the index.
 */
export async function ensureJabaBatchNumberUniqueIndex(db: Db): Promise<void> {
  await db.collection('jaba_batches').createIndex(
    { batchNumber: 1 },
    {
      unique: true,
      name: INDEX_NAME,
      partialFilterExpression: {
        batchNumber: { $exists: true, $type: 'string', $gt: '' },
      },
    }
  )
}
