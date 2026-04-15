import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { NextRequest } from 'next/server'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

export const runtime = 'nodejs'

// GET all bar expenses
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'expenses', 'view')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const method = searchParams.get('method')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query: any = { type: 'bar' } // Only get bar expenses

    if (category && category !== 'all') {
      query.category = category
    }

    if (method && method !== 'all') {
      query.method = method
    }

    if (startDate || endDate) {
      query.date = {}
      if (startDate) {
        query.date.$gte = new Date(startDate)
      }
      if (endDate) {
        query.date.$lte = new Date(endDate)
      }
    }

    const expenses = await db.collection('bar_expenses')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      expenses: expenses.map((e: any) => ({
        ...e,
        _id: e._id.toString(),
        id: e._id.toString(),
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
      })),
    })
  } catch (error: any) {
    console.error('[Bar Expenses API] ❌ Error fetching expenses:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch expenses',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new bar expense
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'expenses', 'add')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const {
      date,
      category,
      vendor,
      amount,
      method,
      description,
      receipt,
      userId,
      userName,
    } = body

    // Validate required fields
    if (!date || !category || !vendor || amount === undefined || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: date, category, vendor, amount, and method are required' },
        { status: 400 }
      )
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    console.log('[Bar Expenses API] Creating expense:', category, vendor)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Prepare expense document
    const expenseData = {
      type: 'bar',
      date: new Date(date),
      category: category.trim(),
      vendor: vendor.trim(),
      amount: Number(amount),
      method: method, // 'cash' | 'bank' | 'mpesa' | 'card'
      description: description?.trim() || '',
      receipt: receipt || '',
      userId: userId || '',
      user: userName || 'System',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert expense
    const result = await db.collection('bar_expenses').insertOne(expenseData)
    
    console.log(`[Bar Expenses API] ✅ Expense created successfully: ${category} (ID: ${result.insertedId})`)

    return NextResponse.json({
      success: true,
      expense: {
        ...expenseData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Bar Expenses API] ❌ Error creating expense:', error)
    return NextResponse.json(
      {
        error: 'Failed to create expense',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update existing bar expense
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'expenses', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const {
      id,
      date,
      category,
      vendor,
      amount,
      method,
      description,
      receipt,
    } = body

    // Validate required fields
    if (!id || !date || !category || !vendor || amount === undefined || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: id, date, category, vendor, amount, and method are required' },
        { status: 400 }
      )
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    console.log('[Bar Expenses API] Updating expense:', category, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if expense exists
    const existing = await db.collection('bar_expenses').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData = {
      date: new Date(date),
      category: category.trim(),
      vendor: vendor.trim(),
      amount: Number(amount),
      method: method,
      description: description?.trim() || '',
      receipt: receipt || existing.receipt || '',
      updatedAt: new Date(),
    }

    // Update expense
    await db.collection('bar_expenses').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Bar Expenses API] ✅ Expense updated successfully: ${category} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      expense: {
        ...updateData,
        _id: id,
        id: id,
        createdAt: existing.createdAt,
        user: existing.user,
        userId: existing.userId,
      },
    })
  } catch (error: any) {
    console.error('[Bar Expenses API] ❌ Error updating expense:', error)
    return NextResponse.json(
      {
        error: 'Failed to update expense',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE bar expense
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'expenses', 'delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      )
    }

    console.log('[Bar Expenses API] Deleting expense ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if expense exists
    const existing = await db.collection('bar_expenses').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Delete expense
    await db.collection('bar_expenses').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Bar Expenses API] ✅ Expense deleted successfully: ${existing.category} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
    })
  } catch (error: any) {
    console.error('[Bar Expenses API] ❌ Error deleting expense:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete expense',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

