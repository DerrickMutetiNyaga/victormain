export interface ShiftOrderStats {
  ordersServed: number
  cashSales: number
  mpesaSales: number
  totalRevenue: number
  refunds: number
  discounts: number
}

export function calculateShiftOrderStatsFromRows(rows: Array<Record<string, any>>): ShiftOrderStats {
  let cashSales = 0
  let mpesaSales = 0
  let totalRevenue = 0
  let refunds = 0
  let discounts = 0
  let ordersServed = 0

  for (const row of rows) {
    const status = String(row.status ?? '').toLowerCase()
    if (['void', 'voided', 'cancelled', 'canceled'].includes(status)) continue
    ordersServed += 1

    const total = Number(row.total ?? 0)
    totalRevenue += total

    const paymentLines = Array.isArray(row.paymentLines) ? row.paymentLines : []
    if (paymentLines.length > 0) {
      for (const line of paymentLines) {
        const lineAmount = Number(line?.amount ?? 0)
        const lineMethod = String(line?.method ?? line?.paymentMethod ?? '').toLowerCase()
        if (lineMethod === 'mpesa') mpesaSales += lineAmount
        else cashSales += lineAmount
      }
    } else {
      const method = String(row.paymentMethod ?? '').toLowerCase()
      if (method === 'mpesa') mpesaSales += total
      else cashSales += total
    }

    const refundTotal = Number(row.refundTotal ?? row.refundAmount ?? 0)
    const discountTotal = Number(row.discountTotal ?? 0)
    const discountPercent = Number(row.discountPercent ?? 0)
    const normalizedPercentDiscount = discountPercent > 0 ? (total * discountPercent) / 100 : 0
    refunds += Math.max(0, refundTotal)
    discounts += Math.max(discountTotal, normalizedPercentDiscount)
  }

  return { ordersServed, cashSales, mpesaSales, totalRevenue, refunds, discounts }
}
