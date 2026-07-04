/**
 * Run: npx tsx scripts/test-catha-order-payments.ts
 * Manual regression checks for summarizeCathaOrderPayments (split pay / overpay).
 */
import { summarizeCathaOrderPayments, type LinkedMpesaPayment } from '../lib/catha-order-payments'

function row(
  id: string,
  amount: number,
  receipt = 'R1'
): LinkedMpesaPayment {
  return {
    method: 'mpesa',
    transactionId: id,
    receiptNumber: receipt,
    amount,
    phone: '254700000000',
    payerName: null,
    mpesaStatus: 'COMPLETED',
    transactionDate: new Date().toISOString(),
    linkedAt: new Date().toISOString(),
    linkedBy: 'test',
  }
}

let failed = 0
function expect(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else {
    console.log('ok:', name)
  }
}

const base = { total: 1000, linkedPayments: [] as LinkedMpesaPayment[], mpesaTransactionId: null as string | null }

// 1 payment exact
{
  const s = summarizeCathaOrderPayments({
    ...base,
    linkedPayments: [row('a', 1000, 'ABC')],
  })
  expect('1 pay exact → PAID', s.paymentStatus === 'PAID' && s.balanceDue === 0 && s.overpaymentAmount === 0)
}

// 2 payments partial then exact
{
  const s = summarizeCathaOrderPayments({
    ...base,
    linkedPayments: [row('a', 400), row('b', 600)],
  })
  expect('2 pay exact → PAID', s.paymentStatus === 'PAID' && s.totalLinkedPayments === 1000)
}

// 3 payments partial
{
  const s = summarizeCathaOrderPayments({
    ...base,
    linkedPayments: [row('a', 100), row('b', 200), row('c', 300)],
  })
  expect('3 pay partial', s.paymentStatus === 'PARTIALLY_PAID' && s.balanceDue === 400)
}

// partial single
{
  const s = summarizeCathaOrderPayments({
    ...base,
    linkedPayments: [row('a', 250)],
  })
  expect('partial', s.paymentStatus === 'PARTIALLY_PAID' && s.balanceDue === 750)
}

// overpayment
{
  const s = summarizeCathaOrderPayments({
    ...base,
    linkedPayments: [row('a', 600), row('b', 500)],
  })
  expect('overpay', s.paymentStatus === 'OVERPAID' && s.overpaymentAmount === 100 && s.balanceDue === 0)
}

// legacy single mpesa on order (no linkedPayments array)
{
  const s = summarizeCathaOrderPayments({
    total: 800,
    mpesaTransactionId: 'legacytx',
    mpesaReceiptNumber: 'LEG1',
    linkedPayments: [],
  })
  expect('legacy row', s.totalLinkedPayments === 800 && s.paymentStatus === 'PAID')
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed.')
