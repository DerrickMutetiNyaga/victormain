import { NextResponse } from 'next/server'
import { getAllCathaStaffUsers, createCathaStaffUser, seedDefaultCathaStaffUsers } from '@/lib/models/catha-staff-user'
import { requireSuperAdminApi } from '@/lib/catha-auth'

const DEFAULT_USERS = [
  {
    id: '1',
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    createdAt: new Date('2024-01-15'),
    lastLogin: new Date(),
    permissions: {
      dashboard: { view: true, edit: true, delete: true },
      pos: { view: true, edit: true, delete: true },
      inventory: { view: true, edit: true, delete: true },
      suppliers: { view: true, edit: true, delete: true },
      'stock-movement': { view: true, edit: true, delete: true },
      orders: { view: true, edit: true, delete: true },
      mpesa: { view: true, edit: true, delete: true },
      expenses: { view: true, edit: true, delete: true },
      clients: { view: true, edit: true, delete: true },
      users: { view: true, edit: true, delete: true },
      'distributor-requests': { view: true, edit: true, delete: true },
      reports: { view: true, edit: true, delete: true },
      settings: { view: true, edit: true, delete: true },
    },
  },
  {
    id: '2',
    name: 'Jane Doe',
    username: 'jane',
    email: 'jane@example.com',
    role: 'manager' as const,
    status: 'active' as const,
    createdAt: new Date('2024-02-20'),
    lastLogin: new Date(Date.now() - 86400000),
    permissions: {
      dashboard: { view: true, edit: false, delete: false },
      pos: { view: true, edit: true, delete: false },
      inventory: { view: true, edit: true, delete: false },
      suppliers: { view: true, edit: true, delete: false },
      'stock-movement': { view: true, edit: true, delete: false },
      orders: { view: true, edit: true, delete: false },
      mpesa: { view: true, edit: false, delete: false },
      expenses: { view: true, edit: true, delete: false },
      clients: { view: true, edit: true, delete: false },
      users: { view: true, edit: false, delete: false },
      'distributor-requests': { view: true, edit: true, delete: false },
      reports: { view: true, edit: false, delete: false },
      settings: { view: false, edit: false, delete: false },
    },
  },
  {
    id: '3',
    name: 'Kelvin Barista',
    username: 'kelvin',
    email: 'kelvin@example.com',
    role: 'waiter' as const,
    status: 'active' as const,
    createdAt: new Date('2024-03-10'),
    lastLogin: new Date(Date.now() - 172800000),
    permissions: {
      dashboard: { view: true, edit: false, delete: false },
      pos: { view: true, edit: true, delete: false },
      inventory: { view: false, edit: false, delete: false },
      suppliers: { view: false, edit: false, delete: false },
      'stock-movement': { view: false, edit: false, delete: false },
      orders: { view: true, edit: true, delete: false },
      mpesa: { view: false, edit: false, delete: false },
      expenses: { view: false, edit: false, delete: false },
      clients: { view: true, edit: false, delete: false },
      users: { view: false, edit: false, delete: false },
      'distributor-requests': { view: false, edit: false, delete: false },
      reports: { view: false, edit: false, delete: false },
      settings: { view: false, edit: false, delete: false },
    },
  },
]

export async function GET() {
  const [, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    await seedDefaultCathaStaffUsers(DEFAULT_USERS as any)
    const users = await getAllCathaStaffUsers()
    const formatted = users.map((u) => ({
      ...u,
      createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
      lastLogin: u.lastLogin?.toISOString?.() ?? u.lastLogin,
    }))
    return NextResponse.json({ success: true, users: formatted })
  } catch (error) {
    console.error('[catha/staff-users] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const [, err] = await requireSuperAdminApi()
  if (err) return err
  try {
    const body = await request.json()
    const { name, username, email, role, status, permissions } = body
    if (!name || !username || !email) {
      return NextResponse.json({ success: false, error: 'Name, username, and email are required' }, { status: 400 })
    }
    const id = Date.now().toString()
    const user = await createCathaStaffUser({
      id,
      name,
      username,
      email,
      role: role || 'waiter',
      status: status || 'active',
      permissions: permissions || {},
    })
    return NextResponse.json({
      success: true,
      user: {
        ...user,
        createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
        lastLogin: user.lastLogin?.toISOString?.() ?? user.lastLogin,
      },
    })
  } catch (error) {
    console.error('[catha/staff-users] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 })
  }
}
