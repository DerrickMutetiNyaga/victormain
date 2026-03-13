import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export interface Table {
  _id?: string
  id: number
  name?: string
  status: 'available' | 'occupied' | 'reserved'
  guests?: number
  waiter?: string | null
  orderTotal?: number
  capacity?: number
  location?: string
  imageUrl?: string
  // Layout properties
  shape?: 'circle' | 'square' | 'rectangle' | 'oval' | 'hexagon' | 'octagon'
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  createdAt?: Date
  updatedAt?: Date
}

export async function GET() {
  const { allowed, response } = await requireCathaPermission('operations.tables', 'view')
  if (!allowed && response) return response
  try {
    const db = await getDatabase('infusion_jaba')
    const tables = await db.collection<Table>('bar_tables').find({}).sort({ id: 1 }).toArray()
    
    // Convert MongoDB _id to string and ensure proper date handling
    const formattedTables = tables.map((table: any) => ({
      id: table.id,
      name: table.name || `Table ${table.id}`,
      status: table.status || 'available',
      guests: table.guests || 0,
      waiter: table.waiter || null,
      orderTotal: table.orderTotal || 0,
      capacity: table.capacity || 4,
      location: table.location || null,
      imageUrl: table.imageUrl || null,
      shape: table.shape || 'circle',
      position: table.position || null,
      size: table.size || null,
      rotation: table.rotation || 0,
      createdAt: table.createdAt instanceof Date ? table.createdAt : (table.createdAt ? new Date(table.createdAt) : new Date()),
      updatedAt: table.updatedAt instanceof Date ? table.updatedAt : (table.updatedAt ? new Date(table.updatedAt) : new Date()),
    }))
    
    return NextResponse.json({ success: true, tables: formattedTables })
  } catch (error: any) {
    console.error('Error fetching tables:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tables', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('operations.tables', 'create')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    // Get the highest table ID to assign the next number
    const existingTables = await db.collection<Table>('bar_tables').find({}).sort({ id: -1 }).limit(1).toArray()
    const nextId = existingTables.length > 0 ? existingTables[0].id + 1 : 1
    
    const table: Table = {
      id: body.id || nextId,
      name: body.name || `Table ${body.id || nextId}`,
      status: body.status || 'available',
      guests: body.guests || 0,
      waiter: body.waiter || null,
      orderTotal: body.orderTotal || 0,
      capacity: body.capacity || 4,
      location: body.location || null,
      imageUrl: body.imageUrl || null,
      shape: body.shape || 'circle',
      position: body.position || null,
      size: body.size || null,
      rotation: body.rotation || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    // Check if table ID already exists
    const existing = await db.collection<Table>('bar_tables').findOne({ id: table.id })
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Table ${table.id} already exists` },
        { status: 400 }
      )
    }
    
    await db.collection<Table>('bar_tables').insertOne(table)
    
    return NextResponse.json({ success: true, table }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating table:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create table', message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const { allowed, response } = await requireCathaPermission('operations.tables', 'edit')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Table ID is required' },
        { status: 400 }
      )
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.status !== undefined) updateData.status = body.status
    if (body.capacity !== undefined) updateData.capacity = body.capacity
    if (body.location !== undefined) updateData.location = body.location
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl
    if (body.guests !== undefined) updateData.guests = body.guests
    if (body.waiter !== undefined) updateData.waiter = body.waiter
    if (body.orderTotal !== undefined) updateData.orderTotal = body.orderTotal
    if (body.shape !== undefined) updateData.shape = body.shape
    if (body.position !== undefined) updateData.position = body.position
    if (body.size !== undefined) updateData.size = body.size
    if (body.rotation !== undefined) updateData.rotation = body.rotation
    
    const result = await db.collection<Table>('bar_tables').findOneAndUpdate(
      { id: body.id },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Table not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, table: result })
  } catch (error: any) {
    console.error('Error updating table:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update table', message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const { allowed, response } = await requireCathaPermission('operations.tables', 'delete')
  if (!allowed && response) return response
  try {
    const { searchParams } = new URL(request.url)
    const tableId = parseInt(searchParams.get('id') || '0')
    
    if (!tableId) {
      return NextResponse.json(
        { success: false, error: 'Table ID is required' },
        { status: 400 }
      )
    }
    
    const db = await getDatabase('infusion_jaba')
    const result = await db.collection<Table>('bar_tables').deleteOne({ id: tableId })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Table not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, message: 'Table deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting table:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete table', message: error.message },
      { status: 500 }
    )
  }
}

