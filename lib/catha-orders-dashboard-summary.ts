import type { Db } from 'mongodb'

export type OrdersDashboardSummary = {
  totalOrders: number
  totalItems: number
  paidOrders: number
  partiallyPaidOrders: number
  notPaidOrders: number
}

/**
 * Whole-database aggregates for orders dashboard cards (not affected by list search/pagination).
 */
export async function computeOrdersDashboardSummary(db: Db): Promise<OrdersDashboardSummary> {
  const agg = await db
    .collection('orders')
    .aggregate([
      {
        $project: {
          paymentStatus: 1,
          status: 1,
          itemQty: {
            $reduce: {
              input: { $ifNull: ['$items', []] },
              initialValue: 0,
              in: { $add: ['$$value', { $toDouble: { $ifNull: ['$$this.quantity', 0] } }] },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$itemQty' },
          partiallyPaidOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'PARTIALLY_PAID'] }, 1, 0] },
          },
          paidOrders: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$paymentStatus', 'PAID'] },
                    { $eq: ['$paymentStatus', 'OVERPAID'] },
                    { $eq: ['$paymentStatus', 'COMPLETED'] },
                    {
                      $and: [
                        { $eq: ['$status', 'completed'] },
                        { $ne: ['$paymentStatus', 'PARTIALLY_PAID'] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()

  const row = agg[0] as
    | {
        totalOrders: number
        totalItems: number
        paidOrders: number
        partiallyPaidOrders: number
      }
    | undefined

  if (!row) {
    return {
      totalOrders: 0,
      totalItems: 0,
      paidOrders: 0,
      partiallyPaidOrders: 0,
      notPaidOrders: 0,
    }
  }

  const totalOrders = Number(row.totalOrders) || 0
  const paidOrders = Number(row.paidOrders) || 0
  const partiallyPaidOrders = Number(row.partiallyPaidOrders) || 0
  const notPaidOrders = Math.max(0, totalOrders - paidOrders - partiallyPaidOrders)

  return {
    totalOrders,
    totalItems: Math.round(Number(row.totalItems) || 0),
    paidOrders,
    partiallyPaidOrders,
    notPaidOrders,
  }
}
