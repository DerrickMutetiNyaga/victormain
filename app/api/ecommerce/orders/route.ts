import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { VAT_RATE } from '@/lib/ecommerce/pricing'

async function getSessionPhone(): Promise<string | null> {
  const session = await getShopSessionFromCookie()
  return session?.phone ?? null
}

export async function GET(request: Request) {
  try {
    const sessionPhone = await getSessionPhone()
    const { searchParams } = new URL(request.url)
    const paramPhone = searchParams.get('phone')
    const email = searchParams.get('email')

    // Prefer session phone (secure) - tracks user by number only, persists across pages
    const phone = sessionPhone || paramPhone

    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: 'Sign in required. Enter your phone number to view orders.' },
        { status: 401 }
      )
    }

    const db = await getDatabase('infusion_jaba')
    
    // Build query: ecommerce orders (or legacy without type) for this customer
    const typeFilter = { $or: [{ type: 'ecommerce' }, { type: { $exists: false } }] }
    let customerFilter: any

    if (phone && email) {
      const normalizedPhone = normalizeKenyaPhone(phone)
      const phones = [phone]
      if (normalizedPhone) {
        phones.push(normalizedPhone)
        if (normalizedPhone.startsWith('+')) phones.push(normalizedPhone.slice(1))
        if (normalizedPhone.startsWith('+254')) phones.push(`0${normalizedPhone.slice(4)}`)
      }
      customerFilter = {
        $or: [
          ...[...new Set(phones)].map(p => ({ customerPhone: p })),
          { customerEmail: email },
        ],
      }
    } else if (phone) {
      const normalizedPhone = normalizeKenyaPhone(phone)
      const phones = [phone]
      if (normalizedPhone) {
        phones.push(normalizedPhone)
        if (normalizedPhone.startsWith('+')) phones.push(normalizedPhone.slice(1))
        if (normalizedPhone.startsWith('+254')) phones.push(`0${normalizedPhone.slice(4)}`)
      }
      customerFilter = { $or: [...new Set(phones)].map(p => ({ customerPhone: p })) }
    } else {
      customerFilter = { customerEmail: email }
    }

    const query = { $and: [typeFilter, customerFilter] }
    
    const orders = await db.collection('orders')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray()
    
    // Format orders for response
    const formattedOrders = orders.map((order: any) => {
      const ts = order.timestamp ?? order.createdAt
      const createdAt = order.createdAt
        ? (order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt))
        : (order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp || Date.now()))
      return {
        id: order.id || order._id?.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        deliveryAddress: order.deliveryAddress,
        city: order.city,
        postalCode: order.postalCode,
        deliveryNotes: order.deliveryNotes,
        items: order.items || [],
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee || 0,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        mpesaReceiptNumber: order.mpesaReceiptNumber,
        status: order.status,
        timestamp: ts instanceof Date ? ts.toISOString() : (ts ? new Date(ts).toISOString() : new Date().toISOString()),
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString(),
      }
    })
    
    // Deduplicate by id (keep first occurrence - most recent due to sort)
    const seen = new Set<string>()
    const uniqueOrders = formattedOrders.filter((o) => {
      const id = o.id || ''
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    
    return NextResponse.json({ success: true, orders: uniqueOrders })
  } catch (error: any) {
    console.error('Error fetching e-commerce orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getShopSessionFromCookie()
    if (!session?.phone) {
      return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
    }

    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    const items = body.items || []
    const deliveryFee = typeof body.deliveryFee === 'number' ? body.deliveryFee : 0

    // Server-side total validation - never trust client totals
    const serverSubtotal = items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
    const serverVat = Math.round(serverSubtotal * VAT_RATE * 100) / 100
    const serverTotal = serverSubtotal + serverVat + deliveryFee

    const clientSubtotal = typeof body.subtotal === 'number' ? body.subtotal : 0
    const clientVat = typeof body.vat === 'number' ? body.vat : 0
    const clientTotal = typeof body.total === 'number' ? body.total : 0

    const tolerance = 0.01
    if (
      Math.abs(serverSubtotal - clientSubtotal) > tolerance ||
      Math.abs(serverVat - clientVat) > tolerance ||
      Math.abs(serverTotal - clientTotal) > tolerance
    ) {
      return NextResponse.json(
        { success: false, error: 'Order totals do not match. Please refresh and try again.' },
        { status: 400 }
      )
    }

    const order = {
      id: body.id || `ECO${Date.now().toString().slice(-8)}`,
      type: 'ecommerce',
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryAddress: body.deliveryAddress,
      city: body.city,
      postalCode: body.postalCode,
      deliveryNotes: body.deliveryNotes,
      items,
      subtotal: serverSubtotal,
      vat: serverVat,
      deliveryFee,
      total: serverTotal,
      paymentMethod: body.paymentMethod || 'mpesa',
      paymentStatus: body.paymentStatus || 'PENDING',
      mpesaReceiptNumber: body.mpesaReceiptNumber || null,
      status: body.status || 'pending',
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Duplicate detection: Check for similar ecommerce orders created within the last 5 seconds
    // This prevents duplicate orders from double-clicks or network retries
    const fiveSecondsAgo = new Date(Date.now() - 5000)
    
    // Create a fingerprint of items for comparison
    const itemsFingerprint = JSON.stringify(
      order.items
        .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
        .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
    )
    
    // Find recent orders with same customer phone, total, and type
    const recentOrders = await db.collection('orders').find({
      type: 'ecommerce',
      customerPhone: order.customerPhone,
      total: order.total,
      timestamp: { $gte: fiveSecondsAgo },
    }).toArray()

    // Check if any recent order has matching items
    for (const recentOrder of recentOrders) {
      const recentItemsFingerprint = JSON.stringify(
        (recentOrder.items || [])
          .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
          .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
      )
      
      if (recentItemsFingerprint === itemsFingerprint) {
        console.log('[Ecommerce Orders API] Duplicate order detected:', {
          existingId: recentOrder.id,
          newId: order.id,
          customerPhone: order.customerPhone,
          total: order.total,
        })
        // Return the existing order instead of creating a duplicate
        return NextResponse.json({ success: true, order: recentOrder }, { status: 200 })
      }
    }
    
    await db.collection('orders').insertOne(order)
    
    return NextResponse.json({ success: true, order }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating e-commerce order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order', message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    const { id, ...updateData } = body
    
    if (updateData.timestamp) {
      updateData.timestamp = new Date(updateData.timestamp)
    }
    
    updateData.updatedAt = new Date()
    
    const result = await db.collection('orders').updateOne(
      { id },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating e-commerce order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order', message: error.message },
      { status: 500 }
    )
  }
}

