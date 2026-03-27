import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

/**
 * C2B Validation URL
 * M-Pesa calls this to validate a transaction before processing
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')

    // Parse transaction details from validation request
    const transTime = body.TransTime
    let transactionDate: Date
    if (transTime && transTime.length === 14) {
      const year = parseInt(transTime.substring(0, 4))
      const month = parseInt(transTime.substring(4, 6)) - 1
      const day = parseInt(transTime.substring(6, 8))
      const hour = parseInt(transTime.substring(8, 10))
      const minute = parseInt(transTime.substring(10, 12))
      const second = parseInt(transTime.substring(12, 14))
      transactionDate = new Date(year, month, day, hour, minute, second)
    } else {
      transactionDate = new Date()
    }

    const customerName = [body.FirstName, body.MiddleName, body.LastName]
      .filter(name => name && name.trim())
      .join(' ')
      .trim() || null

    // Log validation request with all details
    await db.collection('mpesa_transactions').insertOne({
      transaction_type: 'C2B',
      transaction_id: body.TransID,
      transaction_type_detail: body.TransactionType || 'Pay Bill',
      trans_time: transTime,
      transaction_date: transactionDate,
      amount: parseFloat(body.TransAmount || '0'),
      phone_number: body.MSISDN || '',
      account_reference: body.BillRefNumber || body.InvoiceNumber || '',
      bill_ref_number: body.BillRefNumber || '',
      invoice_number: body.InvoiceNumber || '',
      business_short_code: body.BusinessShortCode || '',
      org_account_balance: parseFloat(body.OrgAccountBalance || '0'),
      third_party_trans_id: body.ThirdPartyTransID || '',
      customer_name: customerName,
      customer_first_name: body.FirstName || null,
      customer_middle_name: body.MiddleName || null,
      customer_last_name: body.LastName || null,
      status: 'VALIDATION',
      response_code: '0',
      result_desc: 'Validation received',
      raw_response: body,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Accept the transaction (ResultCode 0 = Accept, 1 = Reject)
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    })
  } catch (error: any) {
    console.error('[M-Pesa C2B Validation] Error:', error)
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: 'Error processing validation' },
      { status: 500 }
    )
  }
}

