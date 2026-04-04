import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export interface BarLayout {
  _id?: string
  barTop?: {
    shape: 'straight' | 'curved' | 'l-shaped' | 'u-shaped' | 'custom'
    position: { x: number; y: number }
    size: { width: number; height: number }
    rotation?: number
    color?: string
    imageUrl?: string
  }
  floorPlan?: {
    width: number
    height: number
    imageUrl?: string
    scale?: number
  }
  createdAt?: Date
  updatedAt?: Date
}

export async function GET() {
  const { allowed, response } = await requireCathaPermission('operations.tables', 'view')
  if (!allowed && response) return response
  try {
    const db = await getDatabase('infusion_jaba')
    const layout = await db.collection<BarLayout>('bar_layout').findOne({})
    
    if (!layout) {
      // Return default layout
      return NextResponse.json({
        success: true,
        layout: {
          barTop: null,
          floorPlan: {
            width: 2000,
            height: 1500,
            scale: 1,
          },
        },
      })
    }
    
    return NextResponse.json({
      success: true,
      layout: {
        barTop: layout.barTop || null,
        floorPlan: layout.floorPlan || {
          width: 2000,
          height: 1500,
          scale: 1,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching bar layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bar layout', message: error.message },
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
    
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (body.barTop !== undefined) updateData.barTop = body.barTop
    if (body.floorPlan !== undefined) updateData.floorPlan = body.floorPlan
    
    // Upsert the layout (create if doesn't exist, update if exists)
    const result = await db.collection<BarLayout>('bar_layout').findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    )
    
    return NextResponse.json({ success: true, layout: result })
  } catch (error: any) {
    console.error('Error updating bar layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update bar layout', message: error.message },
      { status: 500 }
    )
  }
}

