import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { validateStockForItems, deductStockAtomic, restoreStockAtomic } from '@/lib/inventory-ops'

/**
 * STK Push Callback Handler
 * Called by M-Pesa when customer completes or cancels payment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')

    // Handle STK Push callback - M-Pesa sends different formats
    let callback: any = null
    let checkoutRequestID: string | null = null
    let resultCode: number | null = null
    let resultDesc: string | null = null

    // Check for different callback formats
    if (body.Body?.stkCallback) {
      callback = body.Body.stkCallback
      checkoutRequestID = callback.CheckoutRequestID
      resultCode = callback.ResultCode
      resultDesc = callback.ResultDesc
    } else if (body.stkCallback) {
      callback = body.stkCallback
      checkoutRequestID = callback.CheckoutRequestID
      resultCode = callback.ResultCode
      resultDesc = callback.ResultDesc
    } else if (body.CheckoutRequestID) {
      // Direct format
      checkoutRequestID = body.CheckoutRequestID
      resultCode = body.ResultCode
      resultDesc = body.ResultDesc
      callback = body
    }

    if (checkoutRequestID && resultCode !== null) {

      // Find transaction by checkout request ID
      const transaction = await db.collection('mpesa_transactions').findOne({
        checkout_request_id: checkoutRequestID,
      })

      if (transaction) {
        let status = 'FAILED'
        let mpesaReceiptNumber = null

        if (resultCode === 0) {
          // Payment successful
          status = 'COMPLETED'
          // Extract receipt number from callback metadata - handle multiple formats
          let callbackMetadata: any[] = []
          
          // Try different callback structures
          if (callback?.CallbackMetadata?.Item) {
            callbackMetadata = Array.isArray(callback.CallbackMetadata.Item) 
              ? callback.CallbackMetadata.Item 
              : [callback.CallbackMetadata.Item]
          } else if (body.Body?.stkCallback?.CallbackMetadata?.Item) {
            callbackMetadata = Array.isArray(body.Body.stkCallback.CallbackMetadata.Item)
              ? body.Body.stkCallback.CallbackMetadata.Item
              : [body.Body.stkCallback.CallbackMetadata.Item]
          } else if (body.stkCallback?.CallbackMetadata?.Item) {
            callbackMetadata = Array.isArray(body.stkCallback.CallbackMetadata.Item)
              ? body.stkCallback.CallbackMetadata.Item
              : [body.stkCallback.CallbackMetadata.Item]
          }
          
          // Find receipt number in metadata
          const receiptItem = callbackMetadata.find((item: any) => 
            item.Name === 'MpesaReceiptNumber' || 
            item.name === 'MpesaReceiptNumber' ||
            item.Name === 'MpesaReceiptNumber' ||
            item.Key === 'MpesaReceiptNumber'
          )
          
          mpesaReceiptNumber = receiptItem?.Value || receiptItem?.value || receiptItem?.ItemValue || null
          
          // Log for debugging
          if (!mpesaReceiptNumber) {
            console.warn('[M-Pesa Callback] Receipt number not found in callback:', JSON.stringify(body, null, 2))
          } else {
            console.log(`[M-Pesa Callback] Extracted receipt number: ${mpesaReceiptNumber}`)
          }

          // Update transaction
          await db.collection('mpesa_transactions').updateOne(
            { checkout_request_id: checkoutRequestID },
            {
              $set: {
                status,
                response_code: resultCode.toString(),
                result_desc: resultDesc || 'Payment successful',
                mpesa_receipt_number: mpesaReceiptNumber,
                raw_response: body,
                updatedAt: new Date(),
              },
            }
          )

          // Update order/invoice if account reference matches
          if (transaction.account_reference) {
            const orderId = transaction.account_reference
            const order = await db.collection('orders').findOne({ id: orderId })
            const items = (order?.items || []).filter((i: any) => i.productId && i.quantity > 0)

            if (items.length > 0) {
              const validation = await validateStockForItems(db, items)
              if (!validation.ok) {
                console.error('[M-Pesa Callback] Stock validation failed - order not completed:', validation.error)
              } else {
                const userId = order?.cashier || 'System'
                const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
                let deductOk = true
                for (const item of items) {
                  const qty = Number(item.quantity)
                  const res = await deductStockAtomic(db, item.productId, qty, orderId, userId, item.name)
                  if (!res.success) {
                    console.error('[M-Pesa Callback] Stock deduction failed - rolling back:', res.error)
                    for (const d of deducted) {
                      await restoreStockAtomic(db, d.productId, d.quantity, orderId, userId, d.name || 'Unknown', 'order_cancelled')
                    }
                    deductOk = false
                    break
                  }
                  deducted.push({ productId: item.productId, quantity: qty, name: item.name })
                }
                if (deductOk) {
                  await db.collection('orders').updateOne(
                    { id: orderId },
                    {
                      $set: {
                        paymentStatus: 'PAID',
                        paymentMethod: 'mpesa',
                        mpesaReceiptNumber: mpesaReceiptNumber || transaction.transaction_id || null,
                        status: 'completed',
                        updatedAt: new Date(),
                      },
                    }
                  )
                  console.log(`[M-Pesa Callback] Order ${orderId} completed with receipt ${mpesaReceiptNumber}`)
                }
              }
            } else {
              await db.collection('orders').updateOne(
                { id: orderId },
                {
                  $set: {
                    paymentStatus: 'PAID',
                    paymentMethod: 'mpesa',
                    mpesaReceiptNumber: mpesaReceiptNumber || transaction.transaction_id || null,
                    status: 'completed',
                    updatedAt: new Date(),
                  },
                }
              )
              console.log(`[M-Pesa Callback] Order ${orderId} updated with receipt ${mpesaReceiptNumber}`)
            }
          }
        } else {
          // Payment failed or cancelled
          status = resultCode === 1032 ? 'CANCELLED' : 'FAILED'
          await db.collection('mpesa_transactions').updateOne(
            { checkout_request_id: checkoutRequestID },
            {
              $set: {
                status,
                response_code: resultCode.toString(),
                result_desc: resultDesc || 'Payment failed',
                raw_response: body,
                updatedAt: new Date(),
              },
            }
          )
        }
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error: any) {
    console.error('[M-Pesa Callback] Error:', error)
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Error processing callback' }, { status: 500 })
  }
}

