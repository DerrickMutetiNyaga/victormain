import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { PagePermissionEntry } from '@/lib/permissions'

export type BarUserRole = 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
export type BarUserStatus = 'active' | 'disabled'

export type BarUserPermissions = PagePermissionEntry[] | Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>

export interface BarUser {
  _id?: ObjectId
  name: string
  email: string
  image?: string
  provider?: 'google'
  providerId?: string
  /** Optional username (e.g. for display); defaults from email if not set */
  username?: string
  phone?: string
  role?: BarUserRole
  status?: BarUserStatus
  /** Whether the user is approved (admin and super_admin are always approved) */
  approved?: boolean
  /** Canonical permissions Record or legacy PagePermissionEntry[] */
  permissions?: BarUserPermissions
  /** Route-based permissions as array of route strings (e.g., ["/catha/dashboard", "/catha/orders"]) */
  routePermissions?: string[]
  /** Cashier PIN (bcrypt hash). Only for role CASHIER. */
  cashierPinHash?: string | null
  /** When PIN was set */
  cashierPinSetAt?: Date | null
  /** Failed PIN attempts */
  cashierPinFailedAttempts?: number
  /** Lock until (after 5 failures) */
  cashierPinLockedUntil?: Date | null
  /** Unique code for cashier selector (e.g. CSH-0007). Only for role CASHIER. */
  cashierCode?: string | null
  createdAt: Date
  lastLogin?: Date
}

// Use specific database name for Bar users
const DB_NAME = 'infusion_jaba' // Same database, different collection

export async function getBarUserByEmail(email: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Fetching user from database: ${DB_NAME}, collection: bar_users`)
    const user = await db.collection<BarUser>('bar_users').findOne({ email })
    if (user) {
      console.log(`[Bar User Model] User found: ${user.email}`)
    } else {
      console.log(`[Bar User Model] No user found with email: ${email}`)
    }
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user:', error)
    return null
  }
}

export async function getBarUserByProviderId(providerId: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Fetching user by providerId from database: ${DB_NAME}, collection: bar_users`)
    const user = await db.collection<BarUser>('bar_users').findOne({ providerId })
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user by providerId:', error)
    return null
  }
}

export async function createBarUser(userData: Omit<BarUser, '_id' | 'createdAt'>): Promise<BarUser> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Creating user in database: ${DB_NAME}, collection: bar_users`)
    const newUser: BarUser = {
      ...userData,
      role: userData.role ?? 'pending',
      status: userData.status ?? 'active',
      approved: userData.approved ?? (userData.role === 'cashier_admin' || userData.role === 'manager_admin' || userData.role === 'super_admin'),
      permissions: userData.permissions ?? [],
      routePermissions: userData.routePermissions ?? [],
      createdAt: new Date(),
    }
    const result = await db.collection<BarUser>('bar_users').insertOne(newUser)
    console.log(`[Bar User Model] User created successfully: ${newUser.email} with ID: ${result.insertedId}`)
    return { ...newUser, _id: result.insertedId }
  } catch (error) {
    console.error('[Bar User Model] Error creating user:', error)
    throw error
  }
}

export async function updateBarUserLastLogin(email: string): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Updating last login for: ${email}`)
    const result = await db.collection<BarUser>('bar_users').updateOne(
      { email },
      { $set: { lastLogin: new Date() } }
    )
    console.log(`[Bar User Model] Last login updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`)
  } catch (error) {
    console.error('[Bar User Model] Error updating last login:', error)
    throw error
  }
}

export async function getAllBarUsers(): Promise<BarUser[]> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const users = await db.collection<BarUser>('bar_users').find({}).sort({ createdAt: -1 }).toArray()
    return users
  } catch (error) {
    console.error('[Bar User Model] Error fetching all users:', error)
    throw error
  }
}

export async function getBarUserById(userId: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const user = await db.collection<BarUser>('bar_users').findOne({ _id: new ObjectId(userId) })
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user by ID:', error)
    return null
  }
}

export async function updateBarUser(
  userId: string,
  updates: Partial<Pick<BarUser, 'name' | 'email' | 'username' | 'phone' | 'role' | 'status' | 'approved' | 'permissions' | 'routePermissions'>>
): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const set: Record<string, unknown> = {}
    if (updates.name !== undefined) set.name = updates.name
    if (updates.email !== undefined) set.email = updates.email
    if (updates.username !== undefined) set.username = updates.username
    if (updates.phone !== undefined) set.phone = updates.phone
    if (updates.role !== undefined) {
      set.role = updates.role
      // Auto-set approved based on role
      if (updates.approved === undefined) {
        set.approved = updates.role === 'cashier_admin' || updates.role === 'manager_admin' || updates.role === 'super_admin'
      }
      // Clear PIN fields when role changes away from CASHIER
      if (updates.role !== 'cashier_admin') {
        set.cashierPinHash = null
        set.cashierPinSetAt = null
        set.cashierPinFailedAttempts = 0
        set.cashierPinLockedUntil = null
      }
    }
    if (updates.status !== undefined) set.status = updates.status
    if (updates.approved !== undefined) set.approved = updates.approved
    if (updates.permissions !== undefined) set.permissions = updates.permissions
    if (updates.routePermissions !== undefined) set.routePermissions = updates.routePermissions
    if (Object.keys(set).length === 0) return getBarUserById(userId)
    const result = await db.collection<BarUser>('bar_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: set },
      { returnDocument: 'after' }
    )
    return result ?? null
  } catch (error) {
    console.error('[Bar User Model] Error updating user:', error)
    throw error
  }
}

export async function updateBarUserPinFields(
  userId: string,
  pinFields: {
    cashierPinHash?: string | null
    cashierPinSetAt?: Date | null
    cashierPinFailedAttempts?: number
    cashierPinLockedUntil?: Date | null
    cashierCode?: string | null
  }
): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const set: Record<string, unknown> = {}
    if (pinFields.cashierPinHash !== undefined) set.cashierPinHash = pinFields.cashierPinHash
    if (pinFields.cashierPinSetAt !== undefined) set.cashierPinSetAt = pinFields.cashierPinSetAt
    if (pinFields.cashierPinFailedAttempts !== undefined) set.cashierPinFailedAttempts = pinFields.cashierPinFailedAttempts
    if (pinFields.cashierPinLockedUntil !== undefined) set.cashierPinLockedUntil = pinFields.cashierPinLockedUntil
    if (pinFields.cashierCode !== undefined) set.cashierCode = pinFields.cashierCode
    if (Object.keys(set).length === 0) return getBarUserById(userId)
    const result = await db.collection<BarUser>('bar_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: set },
      { returnDocument: 'after' }
    )
    return result ?? null
  } catch (error) {
    console.error('[Bar User Model] Error updating PIN fields:', error)
    throw error
  }
}

export async function getActiveCashiers(withPinOnly = true): Promise<BarUser[]> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const filter: Record<string, unknown> = {
      role: 'cashier_admin',
      status: 'active',
    }
    if (withPinOnly) {
      filter.cashierPinHash = { $exists: true, $ne: null, $ne: '' }
    }
    const users = await db.collection<BarUser>('bar_users').find(filter).sort({ name: 1 }).toArray()
    return users
  } catch (error) {
    console.error('[Bar User Model] Error fetching active cashiers:', error)
    throw error
  }
}

export async function deleteBarUser(userId: string): Promise<boolean> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const result = await db.collection<BarUser>('bar_users').deleteOne({ _id: new ObjectId(userId) })
    return result.deletedCount === 1
  } catch (error) {
    console.error('[Bar User Model] Error deleting user:', error)
    throw error
  }
}

