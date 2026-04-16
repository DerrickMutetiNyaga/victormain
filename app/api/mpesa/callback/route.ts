import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { validateStockForItems, deductStockAtomic, restoreStockAtomic } from '@/lib/inventory-ops'
import { filterInventoryStockLineItems } from '@/lib/catha-order-inventory-lines'
import { ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION } from '@/lib/ecommerce-checkout-session-constants'
import {
  createPaidEcommerceOrderFromCheckoutSession,
  ensureEcommerceCheckoutOrderIndexes,
  type EcommerceCheckoutSessionDoc,
} from '@/lib/ecommerce-order-from-session'
import { logEcommerceRecoveryCritical, releaseHoldAndUpdateSessionStatus } from '@/lib/ecommerce-stock-reservation'
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

          const txnFinalize = await db.collection('mpesa_transactions').updateOne(
            { checkout_request_id: checkoutRequestID, status: { $ne: 'COMPLETED' } },
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

          if (txnFinalize.matchedCount === 0) {
            console.log(
              '[M-Pesa Callback] Duplicate success callback — txn already COMPLETED; running fulfillment idempotently:',
              checkoutRequestID
            )
          }

          // Fulfill existing POS/ecommerce order OR create ecommerce order from checkout session (server snapshot).
          if (transaction.account_reference) {
            const orderId = transaction.account_reference
            const order = await db.collection('orders').findOne({ id: orderId })

            if (order) {
              const txnAmount = Number(transaction.amount ?? 0)
              const orderTotal = Number(order.total ?? 0)
              const ecommerceAmountMismatch =
                Boolean(order) &&
                order.type === 'ecommerce' &&
                Number.isFinite(txnAmount) &&
                Number.isFinite(orderTotal) &&
                Math.abs(txnAmount - orderTotal) > 0.02
              if (ecommerceAmountMismatch) {
                console.error('[M-Pesa Callback] Amount mismatch — refusing to mark order paid', {
                  orderId,
                  txnAmount,
                  orderTotal,
                })
              }
              const items =
                order && !ecommerceAmountMismatch && !order.stockDeducted
                  ? filterInventoryStockLineItems(order.items)
                  : []

              if (!ecommerceAmountMismatch && order && items.length > 0) {
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
                    const ordRes = await db.collection('orders').updateOne(
                      { id: orderId, status: { $ne: 'completed' } },
                      {
                        $set: {
                          paymentStatus: 'PAID',
                          paymentMethod: 'mpesa',
                          mpesaReceiptNumber: mpesaReceiptNumber || transaction.transaction_id || null,
                          status: 'completed',
                          stockDeducted: true,
                          stockDeductedAt: new Date(),
                          updatedAt: new Date(),
                        },
                      }
                    )
                    if (ordRes.matchedCount === 0) {
                      console.log('[M-Pesa Callback] Duplicate callback ignored — order already finalized:', orderId)
                    } else {
                      console.log('[M-Pesa Callback] Payment finalized on existing order only', {
                        orderId,
                        checkoutRequestID,
                        mpesaReceiptNumber,
                      })
                    }
                  }
                }
              } else if (!ecommerceAmountMismatch && order) {
                if (order.stockDeducted) {
                  console.log(`[M-Pesa Callback] Stock already deducted for order ${orderId} — skipping deduction`)
                }
                const ordRes = await db.collection('orders').updateOne(
                  { id: orderId, status: { $ne: 'completed' } },
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
                if (ordRes.matchedCount === 0) {
                  console.log('[M-Pesa Callback] Duplicate callback ignored — order already finalized:', orderId)
                } else {
                  console.log('[M-Pesa Callback] Payment finalized on existing order only', {
                    orderId,
                    checkoutRequestID,
                    mpesaReceiptNumber,
                  })
                }
              }
            } else {
              const checkoutSession = await db
                .collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION)
                .findOne({ id: orderId })
              if (checkoutSession) {
                await ensureEcommerceCheckoutOrderIndexes(db)
                const checkoutSessionFresh = (await db
                  .collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION)
                  .findOne({ id: orderId })) as EcommerceCheckoutSessionDoc | null
                const created = await createPaidEcommerceOrderFromCheckoutSession(
                  db,
                  (checkoutSessionFresh ?? checkoutSession) as EcommerceCheckoutSessionDoc,
                  {
                    mpesaReceiptNumber,
                    checkoutRequestId: checkoutRequestID!,
                    txnAmount: Number(transaction.amount ?? 0),
                  }
                )
                if (!created.ok) {
                  console.error('[M-Pesa Callback] Ecommerce checkout session fulfillment failed', {
                    sessionId: checkoutSession.id,
                    reason: created.reason,
                    detail: created.detail,
                  })
                  if (
                    created.reason === 'missing_reservation' ||
                    created.reason === 'order_insert_failed' ||
                    created.reason === 'amount_mismatch'
                  ) {
                    logEcommerceRecoveryCritical({
                      event: 'checkout_fulfillment_failed_after_mpesa_success',
                      sessionId: checkoutSession.id,
                      reason: created.reason,
                      detail: created.detail,
                      checkoutRequestId,
                    })
                  }
                  await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).updateOne(
                    { id: checkoutSession.id },
                    {
                      $set: {
                        fulfillmentError: created.reason,
                        fulfillmentDetail: created.detail ?? null,
                        updatedAt: new Date(),
                      },
                    }
                  )
                } else {
                  console.log('[M-Pesa Callback] Ecommerce order created from checkout session', {
                    sessionId: checkoutSession.id,
                    orderId: created.orderId,
                    duplicate: created.duplicate,
                  })
                }
              }
            }
          }
        } else {
          // Payment failed or cancelled
          status = resultCode === 1032 ? 'CANCELLED' : 'FAILED'
          const failUpdate = await db.collection('mpesa_transactions').updateOne(
            { checkout_request_id: checkoutRequestID, status: 'PENDING' },
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
          if (failUpdate.matchedCount === 0) {
            console.log('[M-Pesa Callback] Duplicate fail/cancel callback ignored:', checkoutRequestID)
          }
          const ar = transaction.account_reference
          if (typeof ar === 'string' && ar.startsWith('ECS')) {
            const sessDoc = await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).findOne({ id: ar })
            if (sessDoc && sessDoc.status === 'pending_payment') {
              const nextStatus = resultCode === 1032 ? 'abandoned' : 'failed'
              await releaseHoldAndUpdateSessionStatus(db, sessDoc as any, nextStatus)
              await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).updateOne(
                { id: ar },
                { $set: { mpesaFailureCode: resultCode, updatedAt: new Date() } }
              )
              console.log('[ecommerce-checkout] session_marked_failed_or_abandoned', {
                sessionId: ar,
                resultCode,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error: any) {
    console.error('[M-Pesa Callback] Error:', error)
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Error processing callback' }, { status: 500 })
  }
}

