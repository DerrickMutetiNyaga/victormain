import { NextResponse } from 'next/server'
import { updateDistributorRequest, deleteDistributorRequest } from '@/lib/models/distributor-request'
import { requireJabaRolesFromDb } from '@/lib/api-jaba-permissions'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authz = await requireJabaRolesFromDb(['super_admin', 'manager_admin'])
    if ('response' in authz) return authz.response

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
    console.error('[jaba/distributor-requests] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authz = await requireJabaRolesFromDb(['super_admin', 'manager_admin'])
    if ('response' in authz) return authz.response

    const { id } = await params
    const ok = await deleteDistributorRequest(id)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[jaba/distributor-requests] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete request' }, { status: 500 })
  }
}
