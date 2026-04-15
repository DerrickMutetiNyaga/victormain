import { NextResponse } from 'next/server'
import { formatReceiptAsESCPOS, prepareReceiptData } from '@/lib/receipt-printer'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

/**
 * POST endpoint for WiFi receipt printers. Requires pos.view
 * Receives receipt data and returns ESC/POS formatted data
 * or sends directly to printer IP if configured
 */
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'view')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const {
      items,
      transactionId,
      table,
      cashier,
      waiter,
      paymentMethod,
      subtotal,
      vat,
      total,
      printerIp,
      printerPort = 9100, // Default port for raw printing
    } = body

    if (!items || !transactionId || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Prepare receipt data
    const receiptData = prepareReceiptData(
      items,
      transactionId,
      table || null,
      cashier,
      waiter,
      paymentMethod,
      subtotal || 0,
      vat || 0,
      total || 0
    )

    // Format as ESC/POS
    const escposData = formatReceiptAsESCPOS(receiptData)

    // If printer IP is provided, send directly to printer
    if (printerIp) {
      try {
        // Convert Uint8Array to Buffer for Node.js
        const buffer = Buffer.from(escposData)
        
        // Send to printer via raw socket (port 9100 is common for network printers)
        const net = await import('net')
        const socket = new net.Socket()
        
        await new Promise<void>((resolve, reject) => {
          socket.connect(printerPort, printerIp, () => {
            socket.write(buffer, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
          
          socket.on('error', reject)
          socket.setTimeout(5000, () => {
            socket.destroy()
            reject(new Error('Connection timeout'))
          })
        })
        
        socket.end()
        
        return NextResponse.json({
          success: true,
          message: 'Receipt sent to printer',
          printerIp,
          transactionId,
        })
      } catch (printError: any) {
        console.error('[Print Receipt API] Printer connection error:', printError)
        // Fall through to return ESC/POS data
      }
    }

    // Return ESC/POS data as base64 for client to send
    const base64Data = Buffer.from(escposData).toString('base64')
    
    return NextResponse.json({
      success: true,
      message: 'Receipt data formatted',
      escposData: base64Data,
      transactionId,
      format: 'escpos',
    })
  } catch (error: any) {
    console.error('[Print Receipt API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process receipt print request',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check printer status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const printerIp = searchParams.get('ip')
    const printerPort = parseInt(searchParams.get('port') || '9100')

    if (!printerIp) {
      return NextResponse.json({
        success: false,
        error: 'Printer IP is required',
      }, { status: 400 })
    }

    // Test connection to printer
    const net = await import('net')
    const socket = new net.Socket()
    
    const isConnected = await new Promise<boolean>((resolve) => {
      socket.setTimeout(3000)
      
      socket.connect(printerPort, printerIp, () => {
        socket.end()
        resolve(true)
      })
      
      socket.on('error', () => {
        resolve(false)
      })
      
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
    })

    return NextResponse.json({
      success: true,
      connected: isConnected,
      printerIp,
      printerPort,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check printer status',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

