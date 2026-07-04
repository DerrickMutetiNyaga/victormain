import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// POST endpoint for WiFi barcode scanners to send scan data
// Requires auth: 'pos' view (used by POS for barcode scanning)
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'view')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const { barcode, scannerId, timestamp } = body

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Barcode is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Store the scan in a temporary collection for the frontend to poll
    // This allows WiFi scanners to send data that the POS can pick up
    const scanData = {
      barcode: barcode.trim(),
      scannerId: scannerId || 'wifi-scanner',
      timestamp: timestamp || new Date(),
      processed: false,
      createdAt: new Date(),
    }

    // Store in a collection for polling (expires after 30 seconds)
    await db.collection('barcode_scans').insertOne(scanData)

    // Also set expiration index (create if not exists)
    try {
      await db.collection('barcode_scans').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 30 }
      )
    } catch (error) {
      // Index might already exist, that's okay
    }

    return NextResponse.json({
      success: true,
      message: 'Barcode scan received',
      barcode: barcode.trim(),
    })
  } catch (error: any) {
    console.error('[Barcode Scan API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process barcode scan',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET endpoint to poll for new barcode scans (for WiFi scanners)
// The POS page will poll this endpoint to get new scans. Requires 'pos' view.
export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('sales.posSales', 'view')
  if (!allowed && response) return response
  try {
    const { searchParams } = new URL(request.url)
    const lastCheck = searchParams.get('lastCheck') // Timestamp of last check
    const scannerId = searchParams.get('scannerId') || 'wifi-scanner'

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Build query to get unprocessed scans since last check
    const query: any = {
      processed: false,
      scannerId: scannerId,
    }

    if (lastCheck) {
      query.createdAt = { $gt: new Date(lastCheck) }
    }

    // Get unprocessed scans
    const scans = await db
      .collection('barcode_scans')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(10) // Limit to prevent too many scans at once
      .toArray()

    // Mark scans as processed
    if (scans.length > 0) {
      const scanIds = scans.map((s: any) => s._id)
      await db.collection('barcode_scans').updateMany(
        { _id: { $in: scanIds } },
        { $set: { processed: true } }
      )
    }

    return NextResponse.json({
      success: true,
      scans: scans.map((scan: any) => ({
        barcode: scan.barcode,
        scannerId: scan.scannerId,
        timestamp: scan.timestamp || scan.createdAt,
      })),
      count: scans.length,
    })
  } catch (error: any) {
    console.error('[Barcode Scan API] Error fetching scans:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch barcode scans',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

