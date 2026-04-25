import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'
import { requireActiveShiftForSessionUser } from '@/lib/catha-shift-service'
import { queueCathaAuditLog } from '@/lib/catha-audit-log'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const shiftGuard = await requireActiveShiftForSessionUser(session.user, {
    allowSuperAdmin: true,
    allowedStatuses: ['ACTIVE'],
  })
  if (!shiftGuard.ok) {
    queueCathaAuditLog({
      type: 'SECURITY',
      action: 'RESTOCK_INVENTORY',
      status: 'DENIED',
      reason: 'denied_no_active_shift',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      endpoint: '/api/catha/inventory/restock',
      payloadSummary: { message: shiftGuard.error },
    })
    console.warn('[security-shift] REJECTED', JSON.stringify({
      route: '/api/catha/inventory/restock',
      action: 'POST',
      reason: 'denied_no_active_shift',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      message: shiftGuard.error,
      ts: new Date().toISOString(),
    }))
    return NextResponse.json({ error: shiftGuard.error }, { status: shiftGuard.status })
  }

  try {
    const body = await request.json()
    const productId = String(body?.productId || '').trim()
    const quantity = Number(body?.quantity || 0)
    const note = String(body?.note || '').trim()

    if (!productId || !/^[a-fA-F0-9]{24}$/.test(productId)) {
      return NextResponse.json({ error: 'Valid productId is required' }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const oid = new ObjectId(productId)
    const inventory = db.collection('bar_inventory')
    const movements = db.collection('bar_stock_movements')

    const product = await inventory.findOne({ _id: oid, type: 'bar', deleted: { $ne: true } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const previousStock = Number(product.stock || 0)
    const newStock = previousStock + quantity

    await inventory.updateOne(
      { _id: oid },
      {
        $set: {
          stock: newStock,
          status: newStock > 0 ? 'active' : 'out_of_stock',
          updatedAt: new Date(),
        },
      },
    )

    const userName =
      String((session.user as any).name || '').trim() ||
      String((session.user as any).email || '').trim() ||
      'Unknown User'
    const userId = String((session.user as any).id || (session.user as any)._id || '').trim()
    const reference = `RESTOCK-${Date.now()}`

    await movements.insertOne({
      type: 'bar',
      productId,
      productName: String(product.name || ''),
      movementType: 'inflow',
      reason: 'restock',
      quantity,
      previousStock,
      newStock,
      supplier: '',
      reference,
      notes: note,
      userId,
      user: userName,
      date: new Date(),
      createdAt: new Date(),
      timestamp: new Date(),
      source: 'quick-restock',
    })

    queueCathaAuditLog({
      type: 'FINANCIAL',
      action: 'RESTOCK_INVENTORY',
      status: 'SUCCESS',
      userId: (session.user as any)?.userId ?? session.user.email ?? null,
      role,
      shiftId: shiftGuard.shift?._id?.toString?.() ?? null,
      endpoint: '/api/catha/inventory/restock',
      payloadSummary: { productId, quantity, previousStock, newStock },
    })

    return NextResponse.json({
      success: true,
      productId,
      previousStock,
      addedQuantity: quantity,
      newStock,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to restock product',
        details: error?.message || String(error),
      },
      { status: 500 },
    )
  }
}
