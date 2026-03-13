import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { validateStockForItems, deductStockAtomic, restoreStockAtomic } from '@/lib/inventory-ops'

/**
 * C2B Confirmation URL
 * M-Pesa calls this to confirm a successful transaction
 * 
 * Expected payload format:
 * {
 *   "TransactionType": "Pay Bill",
 *   "TransID": "RKL51ZDR4F",
 *   "TransTime": "20231121121325",
 *   "TransAmount": "5.00",
 *   "BusinessShortCode": "600966",
 *   "BillRefNumber": "Sample Transaction",
 *   "InvoiceNumber": "",
 *   "OrgAccountBalance": "25.00",
 *   "ThirdPartyTransID": "",
 *   "MSISDN": "2547*****126",
 *   "FirstName": "NICHOLAS",
 *   "MiddleName": "",
 *   "LastName": ""
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    console.log('[M-Pesa C2B Confirmation] Received payload:', JSON.stringify(body, null, 2))

    // Parse all transaction details from the payload
    const transactionId = body.TransID
    const transactionType = body.TransactionType || 'Pay Bill'
    const transTime = body.TransTime // Format: YYYYMMDDHHmmss
    const amount = parseFloat(body.TransAmount || '0')
    const businessShortCode = body.BusinessShortCode
    const billRefNumber = body.BillRefNumber || ''
    const invoiceNumber = body.InvoiceNumber || ''
    const orgAccountBalance = parseFloat(body.OrgAccountBalance || '0')
    const thirdPartyTransID = body.ThirdPartyTransID || ''
    const phoneNumber = body.MSISDN || ''
    const firstName = body.FirstName || ''
    const middleName = body.MiddleName || ''
    const lastName = body.LastName || ''

    // Parse transaction time (format: YYYYMMDDHHmmss)
    let transactionDate: Date
    if (transTime && transTime.length === 14) {
      const year = parseInt(transTime.substring(0, 4))
      const month = parseInt(transTime.substring(4, 6)) - 1 // Month is 0-indexed
      const day = parseInt(transTime.substring(6, 8))
      const hour = parseInt(transTime.substring(8, 10))
      const minute = parseInt(transTime.substring(10, 12))
      const second = parseInt(transTime.substring(12, 14))
      transactionDate = new Date(year, month, day, hour, minute, second)
    } else {
      transactionDate = new Date()
    }

    // Build customer name
    const customerName = [firstName, middleName, lastName]
      .filter(name => name && name.trim())
      .join(' ')
      .trim() || null

    // Use BillRefNumber or InvoiceNumber as account reference
    const accountReference = billRefNumber || invoiceNumber || ''

    // Prepare complete transaction document
    const transaction = {
      transaction_type: 'C2B',
      transaction_id: transactionId,
      checkout_request_id: null, // C2B doesn't have checkout request ID
      merchant_request_id: null, // C2B doesn't have merchant request ID
      transaction_type_detail: transactionType, // Store the TransactionType from payload
      trans_time: transTime, // Store original TransTime string
      transaction_date: transactionDate, // Parsed date
      amount: amount,
      phone_number: phoneNumber,
      account_reference: accountReference,
      bill_ref_number: billRefNumber,
      invoice_number: invoiceNumber,
      business_short_code: businessShortCode,
      org_account_balance: orgAccountBalance,
      third_party_trans_id: thirdPartyTransID,
      customer_name: customerName,
      customer_first_name: firstName || null,
      customer_middle_name: middleName || null,
      customer_last_name: lastName || null,
      status: 'COMPLETED',
      response_code: '0',
      result_desc: 'Payment received via C2B',
      mpesa_receipt_number: transactionId, // Use TransID as receipt number
      raw_response: body, // Store complete raw payload
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Check if transaction already exists
    const existing = await db.collection('mpesa_transactions').findOne({
      transaction_id: transactionId,
    })

    if (existing) {
      // Update existing transaction
      await db.collection('mpesa_transactions').updateOne(
        { transaction_id: transactionId },
        {
          $set: {
            ...transaction,
            updatedAt: new Date(),
          },
        }
      )
      console.log(`[M-Pesa C2B Confirmation] Updated existing transaction: ${transactionId}`)
    } else {
      // Insert new transaction
      await db.collection('mpesa_transactions').insertOne(transaction)
      console.log(`[M-Pesa C2B Confirmation] Created new transaction: ${transactionId}`)
    }

    // Update order/invoice if account reference matches
    if (accountReference) {
      const orderQuery = {
        $or: [
          { id: accountReference },
          { accountReference: accountReference },
          { customerPhone: phoneNumber.replace(/\D/g, '') },
        ],
        status: { $ne: 'completed' },
      }
      const order = await db.collection('orders').findOne(orderQuery)
      const items = (order?.items || []).filter((i: any) => i.productId && i.quantity > 0)

      if (order && items.length > 0) {
        const validation = await validateStockForItems(db, items)
        if (!validation.ok) {
          console.error('[M-Pesa C2B Confirmation] Stock validation failed:', validation.error)
        } else {
          const userId = order.cashier || 'System'
          const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
          let deductOk = true
          for (const item of items) {
            const qty = Number(item.quantity)
            const pid = typeof item.productId === 'string' ? item.productId : item.productId?.toString?.() || ''
            const res = await deductStockAtomic(db, pid, qty, order.id || accountReference, userId, item.name)
            if (!res.success) {
              console.error('[M-Pesa C2B Confirmation] Stock deduction failed - rolling back:', res.error)
              for (const d of deducted) {
                await restoreStockAtomic(db, d.productId, d.quantity, order.id || accountReference, userId, d.name || 'Unknown', 'order_cancelled')
              }
              deductOk = false
              break
            }
            deducted.push({ productId: pid, quantity: qty, name: item.name })
          }
          if (deductOk) {
            await db.collection('orders').updateOne(
              { _id: order._id },
              {
                $set: {
                  paymentStatus: 'PAID',
                  paymentMethod: 'mpesa',
                  mpesaReceiptNumber: transactionId,
                  status: 'completed',
                  updatedAt: new Date(),
                },
              }
            )
            console.log(`[M-Pesa C2B Confirmation] Order ${order.id} completed with C2B payment`)
          }
        }
      } else if (order) {
        await db.collection('orders').updateOne(
          { _id: order._id },
          {
            $set: {
              paymentStatus: 'PAID',
              paymentMethod: 'mpesa',
              mpesaReceiptNumber: transactionId,
              status: 'completed',
              updatedAt: new Date(),
            },
          }
        )
        console.log(`[M-Pesa C2B Confirmation] Order ${order.id} updated (no inventory items)`)
      } else {
        console.log(`[M-Pesa C2B Confirmation] No order found with reference: ${accountReference}`)
      }
    } else {
      console.log('[M-Pesa C2B Confirmation] No account reference provided, skipping order update')
    }

    // Return success response to M-Pesa
    return NextResponse.json({ 
      ResultCode: 0, 
      ResultDesc: 'Accepted' 
    })
  } catch (error: any) {
    console.error('[M-Pesa C2B Confirmation] Error:', error)
    console.error('[M-Pesa C2B Confirmation] Error stack:', error.stack)
    
    // Still return success to M-Pesa to prevent retries, but log the error
    return NextResponse.json(
      { ResultCode: 0, ResultDesc: 'Accepted' }, // Return 0 to prevent M-Pesa from retrying
      { status: 200 }
    )
  }
}

