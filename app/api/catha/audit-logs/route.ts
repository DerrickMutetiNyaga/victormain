import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { hasCathaPermission, normalizePermissions } from '@/lib/catha-permissions-model'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as any).role || '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'reports', 'view')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = String(searchParams.get('type') || '').trim().toUpperCase()
    const status = String(searchParams.get('status') || '').trim().toUpperCase()
    const userId = String(searchParams.get('userId') || '').trim()
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500)
    const skip = Math.max(Number(searchParams.get('skip') || 0), 0)

    const query: Record<string, unknown> = {}
    if (type === 'SECURITY' || type === 'FINANCIAL' || type === 'SYSTEM') query.type = type
    if (status === 'SUCCESS' || status === 'DENIED') query.status = status
    if (userId) query.userId = userId

    const client = await clientPromise
    const col = client.db('infusion_jaba').collection('audit_logs')
    const [total, rows] = await Promise.all([
      col.countDocuments(query),
      col.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    ])

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [totals24h, deniedByUser, deniedByDay] = await Promise.all([
      col
        .aggregate([
          { $match: { createdAt: { $gte: since24h } } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      col
        .aggregate([
          { $match: { createdAt: { $gte: since24h }, status: 'DENIED' } },
          {
            $group: {
              _id: '$userId',
              deniedCount: { $sum: 1 },
            },
          },
          { $sort: { deniedCount: -1 } },
          { $limit: 8 },
        ])
        .toArray(),
      col
        .aggregate([
          { $match: { createdAt: { $gte: since24h }, status: 'DENIED' } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Nairobi' },
              },
              deniedCount: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
    ])

    const denied24h = Number(totals24h.find((r: any) => r._id === 'DENIED')?.count || 0)
    const success24h = Number(totals24h.find((r: any) => r._id === 'SUCCESS')?.count || 0)
    const total24h = denied24h + success24h
    const deniedRate24h = total24h > 0 ? Number(((denied24h / total24h) * 100).toFixed(2)) : 0

    return NextResponse.json({
      ok: true,
      total,
      limit,
      skip,
      analytics: {
        window: '24h',
        denied24h,
        success24h,
        total24h,
        deniedRate24h,
        deniedByUser: deniedByUser.map((row: any) => ({
          userId: row._id || 'unknown',
          deniedCount: Number(row.deniedCount || 0),
        })),
        deniedByDay: deniedByDay.map((row: any) => ({
          day: String(row._id),
          deniedCount: Number(row.deniedCount || 0),
        })),
      },
      logs: rows.map((row: any) => ({
        id: row._id?.toString(),
        type: row.type || 'SYSTEM',
        action: row.action || '',
        status: row.status || 'SUCCESS',
        reason: row.reason || null,
        userId: row.userId || null,
        role: row.role || null,
        shiftId: row.shiftId || null,
        endpoint: row.endpoint || '',
        payloadSummary: row.payloadSummary || {},
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load audit logs', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
