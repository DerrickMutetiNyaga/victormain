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

    // Get transactions
    const transactions = await db
      .collection('mpesa_transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(1000)
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
        ],
      })
      .project({ id: 1, mpesaTransactionId: 1, paymentMethod: 1, paymentStatus: 1 })
      .toArray()
    const orderByMpesaTxId = new Map<string, any>()
    const orderById = new Map<string, any>()
    for (const o of linkedOrders) {
      if (o?.mpesaTransactionId) orderByMpesaTxId.set(String(o.mpesaTransactionId), o)
      if (o?.id) orderById.set(String(o.id), o)
    }

    // Format transactions
    const formattedTransactions = transactions.map((tx: any) => ({
      ...(function () {
        const txId = tx._id?.toString()
        const linkedOrder =
          (txId ? orderByMpesaTxId.get(txId) : null) ||
          (tx.account_reference ? orderById.get(String(tx.account_reference)) : null) ||
          null
        const linkedOrderId = linkedOrder?.id || tx.linked_order_id || null
        return {
          linked: Boolean(linkedOrderId),
          linkedOrderId,
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

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
    })
  } catch (error: any) {
    console.error('[M-Pesa Transactions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions', message: error.message },
      { status: 500 }
    )
  }
}

