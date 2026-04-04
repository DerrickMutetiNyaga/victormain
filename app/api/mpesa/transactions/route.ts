import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { normalizeMpesaStatus } from '@/lib/mpesa-status'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const db = await getDatabase('infusion_jaba')

    // Build query filters
    const query: any = {}

    const status = searchParams.get('status')
    if (status && status !== 'all') {
      query.status = status.toUpperCase()
    }

    const type = searchParams.get('type')
    if (type && type !== 'all') {
      query.transaction_type = type.toUpperCase()
    }

    const phone = searchParams.get('phone')
    if (phone) {
      query.phone_number = { $regex: phone, $options: 'i' }
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) {
        query.createdAt.$gte = new Date(startDate)
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate)
      }
    }

    const search = searchParams.get('search')
    if (search) {
      query.$or = [
        { checkout_request_id: { $regex: search, $options: 'i' } },
        { merchant_request_id: { $regex: search, $options: 'i' } },
        { transaction_id: { $regex: search, $options: 'i' } },
        { account_reference: { $regex: search, $options: 'i' } },
        { phone_number: { $regex: search, $options: 'i' } },
      ]
    }
    const exactAmount = searchParams.get('exactAmount')
    if (exactAmount != null && exactAmount !== '') {
      const parsed = Number(exactAmount)
      if (!Number.isNaN(parsed)) {
        query.amount = parsed
      }
    }

    const recentLimitRaw = searchParams.get('recentLimit')
    const recentLimit = recentLimitRaw != null && recentLimitRaw !== '' ? Math.min(parseInt(recentLimitRaw, 10) || 0, 200) : 0

    const linkableOnlyRaw = searchParams.get('linkableOnly')
    const linkableOnly =
      linkableOnlyRaw === '1' ||
      linkableOnlyRaw === 'true' ||
      linkableOnlyRaw === 'yes'

    // Only COMPLETED transactions can be linked to an order as a valid payment.
    // Apply whenever linkableOnly is requested (covers both recentLimit and exactAmount modes)
    // so cancelled and failed transactions never appear in the link picker.
    // Also apply for plain recent-limit browsing (no exactAmount) to keep the list clean.
    if (linkableOnly || (recentLimit > 0 && !searchParams.get('exactAmount'))) {
      query.status = 'COMPLETED'
    }

    // Oversample when filtering to linkable-only so we still return enough rows after dropping reserved txs
    let findLimit = recentLimit > 0 ? recentLimit : 1000
    if (linkableOnly && recentLimit > 0) {
      findLimit = Math.min(500, Math.max(recentLimit * 8, recentLimit + 60))
    }

    // Get transactions
    const transactions = await db
      .collection('mpesa_transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(findLimit)
      .toArray()

    // Resolve linked order status for each transaction (used by lightweight link flow in Orders)
    const accountRefs = Array.from(
      new Set(
        transactions
          .map((tx: any) => (typeof tx.account_reference === 'string' ? tx.account_reference.trim() : ''))
          .filter(Boolean)
      )
    )
    const transactionIds = transactions.map((tx: any) => tx._id?.toString()).filter(Boolean)
    const linkedOrders = await db
      .collection('orders')
      .find({
        $or: [
          { id: { $in: accountRefs } },
          { mpesaTransactionId: { $in: transactionIds } },
          { 'linkedPayments.transactionId': { $in: transactionIds } },
        ],
      })
      .project({ id: 1, mpesaTransactionId: 1, linkedPayments: 1, paymentMethod: 1, paymentStatus: 1 })
      .toArray()
    const orderByMpesaTxId = new Map<string, any>()
    const orderById = new Map<string, any>()
    for (const o of linkedOrders) {
      if (o?.id) orderById.set(String(o.id), o)
      if (o?.mpesaTransactionId) orderByMpesaTxId.set(String(o.mpesaTransactionId), o)
      for (const p of o.linkedPayments || []) {
        const tid = p?.transactionId != null ? String(p.transactionId) : ''
        if (tid) orderByMpesaTxId.set(tid, o)
      }
    }

    // Format transactions
    const formattedTransactions = transactions.map((tx: any) => ({
      ...(function () {
        const txId = tx._id?.toString()
        const orderFromTxId = txId ? orderByMpesaTxId.get(txId) : null
        const docLinked = tx.linked_order_id != null && String(tx.linked_order_id).trim() !== ''
        const paymentLinkedOrderId =
          (orderFromTxId?.id != null ? String(orderFromTxId.id) : null) ||
          (docLinked ? String(tx.linked_order_id).trim() : null) ||
          null
        /** Reserved = already attached to an order (DB); not merely account_reference match (STK may still need linking). */
        const reservedByPayment = Boolean(paymentLinkedOrderId)

        const refOrder = tx.account_reference ? orderById.get(String(tx.account_reference).trim()) : null
        const linkedOrderId = paymentLinkedOrderId || refOrder?.id || null

        return {
          linked: Boolean(linkedOrderId),
          linkedOrderId,
          reservedByPayment,
          mpesaRef: tx.mpesa_receipt_number || tx.transaction_id || tx.checkout_request_id || null,
        }
      })(),
      id: tx._id.toString(),
      transactionType: tx.transaction_type,
      transactionId: tx.transaction_id,
      checkoutRequestId: tx.checkout_request_id,
      merchantRequestId: tx.merchant_request_id,
      amount: tx.amount,
      phoneNumber: tx.phone_number,
      accountReference: tx.account_reference,
      status: normalizeMpesaStatus(tx.status),
      responseCode: tx.response_code,
      resultDesc: tx.result_desc,
      mpesaReceiptNumber: tx.mpesa_receipt_number,
      rawResponse: tx.raw_response,
      createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
      updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt,
    }))

    let out = formattedTransactions
    if (linkableOnly) {
      out = out.filter((t: any) => !t.reservedByPayment)
      if (recentLimit > 0) {
        out = out.slice(0, recentLimit)
      }
    }

    return NextResponse.json({
      success: true,
      transactions: out,
      count: out.length,
      linkableOnly: linkableOnly || undefined,
    })
  } catch (error: any) {
    console.error('[M-Pesa Transactions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions', message: error.message },
      { status: 500 }
    )
  }
}

