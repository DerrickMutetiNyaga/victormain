import { NextResponse } from 'next/server'
import { updateDistributorRequest, deleteDistributorRequest } from '@/lib/models/distributor-request'
import { requireCathaPermission } from '@/lib/auth-catha'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { allowed, response } = await requireCathaPermission('management.distributorRequests', 'edit')
  if (!allowed && response) return response
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (['pending', 'approved', 'rejected'].includes(body.status)) {
      updates.status = body.status
      if (body.status === 'approved' || body.status === 'rejected') {
        updates.reviewedAt = new Date()
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid updates' }, { status: 400 })
    }
    const req = await updateDistributorRequest(id, updates)
    if (!req) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      request: {
        ...req,
        submittedAt: req.submittedAt?.toISOString?.() ?? req.submittedAt,
        reviewedAt: req.reviewedAt?.toISOString?.() ?? req.reviewedAt,
      },
    })
  } catch (error) {
    console.error('[catha/distributor-requests] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { allowed, response } = await requireCathaPermission('management.distributorRequests', 'delete')
  if (!allowed && response) return response
  try {
    const { id } = await params
    const ok = await deleteDistributorRequest(id)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[catha/distributor-requests] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete request' }, { status: 500 })
  }
}
