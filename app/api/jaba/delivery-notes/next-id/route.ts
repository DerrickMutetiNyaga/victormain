import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET next sequential delivery note ID (DN-001, DN-002, etc.)
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Find all delivery notes and extract the highest number
    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    let nextNumber = 1

    if (deliveryNotes.length > 0) {
      // Extract numbers from existing note IDs
      // Only consider IDs in the new format (DN-001 to DN-999) - ignore old 6-digit random IDs
      const numbers = deliveryNotes
        .map((note: any) => {
          if (!note.noteId) return 0
          // Match DN- followed by digits
          const match = note.noteId.match(/^DN-(\d+)$/i)
          if (match) {
            const num = parseInt(match[1], 10)
            // Only use numbers in the range 1-999 (3-digit format)
            // This ignores old random 6-digit IDs like DN-994465
            if (num > 0 && num <= 999) {
              return num
            }
          }
          return 0
        })
        .filter((num: number) => num > 0)

      if (numbers.length > 0) {
        // Find the highest number and increment
        const maxNumber = Math.max(...numbers)
        nextNumber = maxNumber + 1
        // Ensure we don't exceed 999
        if (nextNumber > 999) {
          nextNumber = 999
        }
      } else {
        // If no valid sequential IDs found (all are old format), start fresh from 1
        nextNumber = 1
      }
    }

    // Format as DN-001, DN-002, etc. (3 digits minimum)
    const nextId = `DN-${String(nextNumber).padStart(3, '0')}`

    return NextResponse.json({
      success: true,
      nextId,
      nextNumber,
    })
  } catch (error: any) {
    console.error('[Delivery Notes API] ❌ Error getting next ID:', error)
    return NextResponse.json(
      {
        error: 'Failed to get next delivery note ID',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

