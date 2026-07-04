import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET delivery history for a specific distributor
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const distributorName = searchParams.get('distributor')

    if (!distributorName) {
      return NextResponse.json(
        { error: 'Distributor name is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const history = await db.collection('jaba_distributorHistory')
      .find({ distributorName: distributorName })
      .sort({ date: -1, _id: -1 }) // Latest first
      .limit(1000) // Limit to prevent large queries
      .toArray()

    // Convert MongoDB IDs and dates
    const formattedHistory = history.map(item => ({
      ...item,
      id: item._id.toString(),
      _id: item._id.toString(),
      date: item.date instanceof Date 
        ? item.date.toISOString() 
        : item.date,
      timeOut: item.timeOut instanceof Date 
        ? item.timeOut.toISOString() 
        : item.timeOut,
      timeDelivered: item.timeDelivered instanceof Date 
        ? item.timeDelivered.toISOString() 
        : item.timeDelivered,
    }))

    return NextResponse.json({ history: formattedHistory })
  } catch (error: any) {
    console.error('[Distributor History API] Error fetching history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch distributor history',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

