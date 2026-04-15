import type { Db } from 'mongodb'

let ensured = false

/**
 * Best-effort unique index on STK checkout_request_id (duplicate callbacks / double inserts).
 */
export async function ensureMpesaTransactionIndexes(db: Db): Promise<void> {
  if (ensured) return
  try {
    await db.collection('mpesa_transactions').createIndex(
      { checkout_request_id: 1 },
      {
        unique: true,
        name: 'uniq_mpesa_checkout_request_id',
        partialFilterExpression: {
          checkout_request_id: { $type: 'string', $gt: '' },
        },
      }
    )
    console.log('[M-Pesa DB] Index ensured: uniq_mpesa_checkout_request_id')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('already exists') && !msg.includes('same name')) {
      console.warn('[M-Pesa DB] Index ensure (checkout_request_id):', msg)
    }
  }
  ensured = true
}
