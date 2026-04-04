import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface PagePermission {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export interface UserPermissions {
  [pageId: string]: PagePermission
}

export interface JabaUser {
  _id?: ObjectId
  name: string
  email: string
  image?: string
  provider: 'google'
  providerId: string
  role?: 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
  status?: 'active' | 'inactive'
  /** Whether the user is approved (admin and super_admin are always approved) */
  approved?: boolean
  permissions?: UserPermissions
  /** Route-based permissions as array of route strings (e.g., ["/jaba/dashboard", "/jaba/orders"]) */
  routePermissions?: string[]
  createdAt: Date
  lastLogin?: Date
}

// Use specific database name for Jaba users
const DB_NAME = 'infusion_jaba'

export async function getUserByEmail(email: string): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[User Model] Fetching user from database: ${DB_NAME}, collection: jaba_users`)
    const user = await db.collection<JabaUser>('jaba_users').findOne({ email })
    if (user) {
      console.log(`[User Model] User found: ${user.email}`)
    } else {
      console.log(`[User Model] No user found with email: ${email}`)
    }
    return user
  } catch (error) {
    console.error('[User Model] Error fetching user:', error)
    return null
  }
}

export async function getUserByProviderId(providerId: string): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[User Model] Fetching user by providerId from database: ${DB_NAME}, collection: jaba_users`)
    const user = await db.collection<JabaUser>('jaba_users').findOne({ providerId })
    return user
  } catch (error) {
    console.error('[User Model] Error fetching user by providerId:', error)
    return null
  }
}

export async function createUser(userData: Omit<JabaUser, '_id' | 'createdAt'>): Promise<JabaUser> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[User Model] Creating user in database: ${DB_NAME}, collection: jaba_users`)
    const newUser: JabaUser = {
      ...userData,
      role: userData.role ?? 'pending',
      status: userData.status || 'active',
      approved: userData.approved ?? (userData.role === 'cashier_admin' || userData.role === 'manager_admin' || userData.role === 'super_admin'),
      routePermissions: userData.routePermissions ?? [],
      createdAt: new Date(),
    }
    const result = await db.collection<JabaUser>('jaba_users').insertOne(newUser)
    console.log(`[User Model] User created successfully: ${newUser.email} with ID: ${result.insertedId}`)
    return { ...newUser, _id: result.insertedId }
  } catch (error) {
    console.error('[User Model] Error creating user:', error)
    throw error
  }
}

export async function updateUserLastLogin(email: string): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[User Model] Updating last login for: ${email}`)
    const result = await db.collection<JabaUser>('jaba_users').updateOne(
      { email },
      { $set: { lastLogin: new Date() } }
    )
    console.log(`[User Model] Last login updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`)
  } catch (error) {
    console.error('[User Model] Error updating last login:', error)
    throw error
  }
}

export async function getAllUsers(): Promise<JabaUser[]> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const users = await db.collection<JabaUser>('jaba_users').find({}).sort({ createdAt: -1 }).toArray()
    return users
  } catch (error) {
    console.error('[User Model] Error fetching all users:', error)
    throw error
  }
}

export async function getUserById(userId: string): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const user = await db.collection<JabaUser>('jaba_users').findOne({ _id: new ObjectId(userId) })
    return user
  } catch (error) {
    console.error('[User Model] Error fetching user by ID:', error)
    return null
  }
}

export async function updateUserRole(userId: string, role: 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const update: Partial<JabaUser> = { role }
    // When promoting from pending to admin, set approved: true
    if (role === 'cashier_admin' || role === 'manager_admin' || role === 'super_admin') {
      update.approved = true
    }
    const result = await db.collection<JabaUser>('jaba_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: update },
      { returnDocument: 'after' }
    )
    return result || null
  } catch (error) {
    console.error('[User Model] Error updating user role:', error)
    throw error
  }
}

export async function updateUserPermissions(userId: string, permissions: UserPermissions): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const result = await db.collection<JabaUser>('jaba_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { permissions } },
      { returnDocument: 'after' }
    )
    return result || null
  } catch (error) {
    console.error('[User Model] Error updating user permissions:', error)
    throw error
  }
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive'): Promise<JabaUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const result = await db.collection<JabaUser>('jaba_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { status } },
      { returnDocument: 'after' }
    )
    return result || null
  } catch (error) {
    console.error('[User Model] Error updating user status:', error)
    throw error
  }
}

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const result = await db.collection<JabaUser>('jaba_users').deleteOne({ _id: new ObjectId(userId) })
    return result.deletedCount === 1
  } catch (error) {
    console.error('[User Model] Error deleting user:', error)
    throw error
  }
}

