import type { Db } from 'mongodb'
import { CATHA_ORDERS_MAIN_LIST_EXCLUSION } from '@/lib/catha-orders-list-filter'
import { MANUAL_MPESA_VERIFICATIONS } from '@/lib/catha-manual-mpesa-verification'
import { roundMoney } from '@/lib/catha-mpesa-order-allocations'

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000

export type FinanceMpesaBucket = {
  count: number
  amount: number
}

export type FinanceDashboardSnapshot = {
  date: string
  periodStart: string
  periodEnd: string
  orders: {
    total: number
    paid: number
    pending: number
    partiallyPaid: number
  }
  mpesa: {
    automatic: FinanceMpesaBucket
    manual: FinanceMpesaBucket
    linkedExisting: FinanceMpesaBucket
  }
  pendingApproval: number
  rejectedToday: number
  recoveredRevenue: number
  outstandingBalance: number
}

/** Calendar day bounds in Africa/Nairobi (UTC+3). */
export function nairobiDayBounds(dateStr?: string): {
  start: Date
  end: Date
  dateLabel: string
} {
  let y: number
  let m: number
  let d: number

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-').map(Number)
    y = parts[0]!
    m = parts[1]! - 1
    d = parts[2]!
  } else {
    const nairobiNow = new Date(Date.now() + NAIROBI_OFFSET_MS)
    y = nairobiNow.getUTCFullYear()
    m = nairobiNow.getUTCMonth()
    d = nairobiNow.getUTCDate()
  }

  const startUtcMs = Date.UTC(y, m, d) - NAIROBI_OFFSET_MS
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000
  const label = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    dateLabel: label,
  }
}

function emptyBucket(): FinanceMpesaBucket {
  return { count: 0, amount: 0 }
}

export async function computeFinanceDashboard(
  db: Db,
  dateStr?: string
): Promise<FinanceDashboardSnapshot> {
  const { start, end, dateLabel } = nairobiDayBounds(dateStr)

  const orderMatch = {
    $and: [
      CATHA_ORDERS_MAIN_LIST_EXCLUSION,
      { timestamp: { $gte: start, $lt: end } },
      { status: { $nin: ['cancelled', 'voided'] } },
    ],
  }

  const orderAgg = await db
    .collection('orders')
    .aggregate<{
      total: number
      paid: number
      partiallyPaid: number
      outstandingBalance: number
    }>([
      { $match: orderMatch },
      {
        $project: {
          paymentStatus: 1,
          status: 1,
          balanceDue: { $toDouble: { $ifNull: ['$balanceDue', 0] } },
          paidFlag: {
            $cond: [
              {
                $or: [
                  { $in: ['$paymentStatus', ['PAID', 'OVERPAID', 'COMPLETED']] },
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
          partialFlag: {
            $cond: [{ $eq: ['$paymentStatus', 'PARTIALLY_PAID'] }, 1, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          paid: { $sum: '$paidFlag' },
          partiallyPaid: { $sum: '$partialFlag' },
          outstandingBalance: {
            $sum: {
              $cond: [{ $gt: ['$balanceDue', 0] }, '$balanceDue', 0],
            },
          },
        },
      },
    ])
    .toArray()

  const orderRow = orderAgg[0]
  const total = Number(orderRow?.total) || 0
  const paid = Number(orderRow?.paid) || 0
  const partiallyPaid = Number(orderRow?.partiallyPaid) || 0
  const pending = Math.max(0, total - paid - partiallyPaid)
  const outstandingBalance = roundMoney(Number(orderRow?.outstandingBalance) || 0)

  const mpesaBuckets = {
    automatic: emptyBucket(),
    manual: emptyBucket(),
    linkedExisting: emptyBucket(),
  }

  const linkAgg = await db
    .collection('orders')
    .aggregate<{ _id: string; count: number; amount: number }>([
      { $unwind: '$linkedPayments' },
      {
        $match: {
          'linkedPayments.method': 'mpesa',
          'linkedPayments.linkedAt': { $gte: start, $lt: end },
        },
      },
      {
        $addFields: {
          linkSourceNorm: {
            $toLower: { $ifNull: ['$linkedPayments.linkSource', 'staff_link'] },
          },
          linkAmount: { $toDouble: { $ifNull: ['$linkedPayments.amount', 0] } },
        },
      },
      {
        $group: {
          _id: '$linkSourceNorm',
          count: { $sum: 1 },
          amount: { $sum: '$linkAmount' },
        },
      },
    ])
    .toArray()

  for (const row of linkAgg) {
    const key = String(row._id || 'staff_link')
    const bucket =
      key === 'automatic'
        ? mpesaBuckets.automatic
        : key === 'manual'
          ? mpesaBuckets.manual
          : mpesaBuckets.linkedExisting
    bucket.count += Number(row.count) || 0
    bucket.amount = roundMoney(bucket.amount + (Number(row.amount) || 0))
  }

  const [pendingApproval, rejectedToday, recoveredAgg] = await Promise.all([
    db.collection(MANUAL_MPESA_VERIFICATIONS).countDocuments({ status: 'PENDING' }),
    db.collection(MANUAL_MPESA_VERIFICATIONS).countDocuments({
      status: 'REJECTED',
      reviewedAt: { $gte: start, $lt: end },
    }),
    db
      .collection(MANUAL_MPESA_VERIFICATIONS)
      .aggregate<{ total: number }>([
        {
          $match: {
            status: 'APPROVED',
            reviewedAt: { $gte: start, $lt: end },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
      ])
      .toArray(),
  ])

  const recoveredRevenue = roundMoney(Number(recoveredAgg[0]?.total) || mpesaBuckets.manual.amount)

  return {
    date: dateLabel,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    orders: {
      total,
      paid,
      pending,
      partiallyPaid,
    },
    mpesa: mpesaBuckets,
    pendingApproval,
    rejectedToday,
    recoveredRevenue,
    outstandingBalance,
  }
}

export function financeDashboardToCsv(snapshot: FinanceDashboardSnapshot): string {
  const lines = [
    'Catha Finance Dashboard',
    `Date,${snapshot.date}`,
    '',
    'Orders',
    `Total,${snapshot.orders.total}`,
    `Paid,${snapshot.orders.paid}`,
    `Pending,${snapshot.orders.pending}`,
    `Partially Paid,${snapshot.orders.partiallyPaid}`,
    `Outstanding Balance,${snapshot.outstandingBalance.toFixed(2)}`,
    '',
    'M-Pesa (linked today)',
    `Automatic Count,${snapshot.mpesa.automatic.count}`,
    `Automatic Amount,${snapshot.mpesa.automatic.amount.toFixed(2)}`,
    `Manual Count,${snapshot.mpesa.manual.count}`,
    `Manual Amount,${snapshot.mpesa.manual.amount.toFixed(2)}`,
    `Linked Existing Count,${snapshot.mpesa.linkedExisting.count}`,
    `Linked Existing Amount,${snapshot.mpesa.linkedExisting.amount.toFixed(2)}`,
    '',
    'Recovery',
    `Pending Approval,${snapshot.pendingApproval}`,
    `Rejected Today,${snapshot.rejectedToday}`,
    `Recovered Revenue,${snapshot.recoveredRevenue.toFixed(2)}`,
  ]
  return lines.join('\n')
}
