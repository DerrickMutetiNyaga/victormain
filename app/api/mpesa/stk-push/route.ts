import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { initiateSTKPush, type MpesaConfig } from '@/lib/mpesa'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phoneNumber, amount, accountReference, transactionDesc } = body

    if (!phoneNumber || !amount || !accountReference) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: phoneNumber, amount, accountReference' },
        { status: 400 }
      )
    }

    // Get M-Pesa settings
    const db = await getDatabase('infusion_jaba')
    const settings = await db.collection('catha_settings').findOne({})

    if (!settings?.mpesa?.enabled) {
      return NextResponse.json(
        { success: false, error: 'M-Pesa gateway is not enabled' },
        { status: 400 }
      )
    }

    const mpesaConfig: MpesaConfig = {
      consumerKey: settings.mpesa.consumerKey,
      consumerSecret: settings.mpesa.consumerSecret,
      passkey: settings.mpesa.passkey,
      shortcode: settings.mpesa.shortcode,
      environment: settings.mpesa.environment,
      callbackUrl: settings.mpesa.callbackUrl,
    }

    // Initiate STK Push
    const stkResponse = await initiateSTKPush(mpesaConfig, {
      phoneNumber,
      amount: Number(amount),
      accountReference,
      transactionDesc: transactionDesc || 'Payment',
    })

    // Store transaction in database
    const transaction = {
      transaction_type: 'STK',
      checkout_request_id: stkResponse.CheckoutRequestID,
      merchant_request_id: stkResponse.MerchantRequestID,
      amount: Number(amount),
      phone_number: phoneNumber,
      account_reference: accountReference,
      status: 'PENDING',
      response_code: stkResponse.ResponseCode,
      result_desc: stkResponse.ResponseDescription,
      raw_response: stkResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.collection('mpesa_transactions').insertOne(transaction)

    return NextResponse.json({
      success: true,
      data: {
        checkoutRequestID: stkResponse.CheckoutRequestID,
        merchantRequestID: stkResponse.MerchantRequestID,
        customerMessage: stkResponse.CustomerMessage,
      },
    })
  } catch (error: any) {
    console.error('[M-Pesa STK Push] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to initiate STK Push' },
      { status: 500 }
    )
  }
}

