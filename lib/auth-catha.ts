/**
 * Catha V2 - NextAuth config for /catha (Google only).
 * Uses catha_users collection. Dedicated cookie. No Jaba/bar_users.
 */
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { NextResponse } from 'next/server'
import {
  getCathaUserByEmail,
  createCathaUser,
  updateCathaUserLastLogin,
  ensureCathaUserIndexes,
  type CathaUserRole,
  type CathaUserStatus,
} from '@/lib/models/catha-user'
import {
  CathaPermissions,
  CathaModuleKey,
  CathaPermissionAction,
  normalizePermissions,
  hasCathaPermission,
} from '@/lib/catha-permissions-model'
import { verifyCashierPin } from '@/lib/catha-pin'

const isProduction = process.env.NODE_ENV === 'production'
const CATHA_SECRET = process.env.AUTH_SECRET_CATHA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)
let NEXTAUTH_URL = process.env.NEXTAUTH_URL
if (NEXTAUTH_URL) NEXTAUTH_URL = NEXTAUTH_URL.replace(/\/$/, '')

if (!CATHA_SECRET) {
  if (isProduction) throw new Error('[Catha Auth] AUTH_SECRET_CATHA required in production')
  if (!process.env.NEXTAUTH_SECRET) throw new Error('[Catha Auth] NEXTAUTH_SECRET required')
}

const SUPER_ADMIN_EMAIL = process.env.CATHA_SUPER_ADMIN_EMAIL?.trim()

function normalizeCathaRole(role: string | undefined): CathaUserRole {
  const r = (role ?? '').trim().toUpperCase()
  if (r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'SUPER-ADMIN') return 'SUPER_ADMIN'
  if (r === 'ADMIN' || r === 'MANAGER_ADMIN' || r === 'MANAGER') return 'ADMIN'
  if (r === 'CASHIER' || r === 'CASHIER_ADMIN') return 'CASHIER'
  if (r === 'PENDING' || r === 'USER') return 'PENDING'
  return 'PENDING'
}

function normalizeCathaStatus(status: string | undefined): CathaUserStatus {
  const s = (status ?? '').trim().toUpperCase()
  if (s === 'ACTIVE') return 'ACTIVE'
  if (s === 'DISABLED' || s === 'SUSPENDED') return 'DISABLED'
  if (s === 'PENDING') return 'PENDING'
  if ((status ?? '').trim().toLowerCase() === 'active') return 'ACTIVE'
  if ((status ?? '').trim().toLowerCase() === 'disabled') return 'DISABLED'
  return 'PENDING'
}

// Run once per process so email unique index exists (idempotent)
let cathaIndexesPromise: Promise<void> | null = null
function ensureCathaIndexesOnce(): Promise<void> {
  if (!cathaIndexesPromise) {
    cathaIndexesPromise = ensureCathaUserIndexes().catch((e: any) => {
      console.warn('[Catha Auth] Index ensure failed (non-fatal):', e?.message)
    })
  }
  return cathaIndexesPromise
}

export const cathaAuth = NextAuth({
  trustHost: true,
  basePath: '/api/auth/catha',
  secret: CATHA_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: (() => {
        const prefix = isProduction || NEXTAUTH_URL?.startsWith('https://') ? '__Secure-' : ''
        return `${prefix}catha.session-token`
      })(),
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction || (NEXTAUTH_URL?.startsWith('https://') ?? false),
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: 'consent', access_type: 'offline', response_type: 'code' } },
    }),
    Credentials({
      id: 'catha-pin',
      name: 'Catha Cashier PIN',
      credentials: {
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials, req) {
        const pin = (credentials as any)?.pin as string | undefined
        if (!pin || !/^\d{4}$/.test(pin)) {
          return null
        }
        try {
          const ip =
            (req as any)?.headers?.get?.('x-forwarded-for') ||
            (req as any)?.ip ||
            ''
          const result = await verifyCashierPin(pin, typeof ip === 'string' ? ip : '')
          if (!result.ok) {
            return null
          }
          const { user } = result
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        } catch (e: any) {
          console.error('[Catha Auth] PIN authorize error:', e?.message)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false

      // Google OAuth: normal Catha user lifecycle
      if (account.provider === 'google') {
        if (!user.email) {
          console.error('[Catha Auth] No email from Google')
          return false
        }
        try {
          await ensureCathaIndexesOnce()
          let cu = await getCathaUserByEmail(user.email)
          if (cu) {
            await updateCathaUserLastLogin(user.email)
            return true
          }
          const role: CathaUserRole =
            SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL ? 'SUPER_ADMIN' : 'PENDING'
          const status: CathaUserStatus = role === 'SUPER_ADMIN' ? 'ACTIVE' : 'PENDING'
          await createCathaUser({
            email: user.email,
            name: user.name ?? 'User',
            image: user.image ?? undefined,
            role,
            status,
            permissions: [],
          })
          await updateCathaUserLastLogin(user.email)
          if (role === 'SUPER_ADMIN') {
            console.log('[Catha Auth] Super admin seeded:', user.email)
          }
          return true
        } catch (e: any) {
          console.error('[Catha Auth] signIn error:', e?.message)
          return false
        }
      }

      // Cashier PIN (credentials) – user is already a valid Catha cashier if authorize() returned them.
      if (account.provider === 'catha-pin') {
        if (!user?.email) {
          console.error('[Catha Auth] PIN sign-in missing email')
          return false
        }
        return true
      }

      // Any other unexpected provider: deny.
      console.error('[Catha Auth] Unknown provider:', account.provider)
      return false
    },
    async jwt({ token, user, account, trigger }) {
      ;(token as any).app = 'catha'
      ;(token as any).userCollection = 'catha'

      const normalizeStatusInline = (raw: unknown): CathaUserStatus => {
        const s = (String(raw ?? '')).trim().toUpperCase()
        if (s === 'ACTIVE') return 'ACTIVE'
        if (s === 'DISABLED' || s === 'SUSPENDED') return 'DISABLED'
        if (s === 'PENDING') return 'PENDING'
        return 'PENDING'
      }

      if (user && account?.provider && user.email) {
        ;(token as any).email = user.email
        const cu = await getCathaUserByEmail(user.email)
        if (cu) {
          const role = normalizeCathaRole(cu.role as unknown as string)
          const status = normalizeStatusInline(cu.status)
          const permissions: CathaPermissions = normalizePermissions(cu.permissions)
          ;(token as any).userId = cu._id?.toString()
          ;(token as any).role = role
          ;(token as any).status = status
          ;(token as any).permissions = permissions
        } else {
          ;(token as any).role = 'PENDING'
          ;(token as any).status = 'PENDING'
          ;(token as any).permissions = []
        }
      }

      if (trigger === 'update' && (token as any).email) {
        const cu = await getCathaUserByEmail((token as any).email)
        if (cu) {
          const role = normalizeCathaRole(cu.role as unknown as string)
          const status = normalizeStatusInline(cu.status)
          const permissions: CathaPermissions = normalizePermissions(cu.permissions)
          ;(token as any).userId = cu._id?.toString()
          ;(token as any).role = role
          ;(token as any).status = status
          ;(token as any).permissions = permissions
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userId = (token as any).userId
        ;(session.user as any).role = (token as any).role ?? 'PENDING'
        ;(session.user as any).status = (token as any).status ?? 'PENDING'
        ;(session.user as any).permissions = (token as any).permissions ?? {}
      }
      return session
    },
  },
  pages: {
    signIn: '/catha/login',
    error: '/catha/login',
  },
})

export const { auth } = cathaAuth
/** Map legacy permissionKey + action to Catha module + action. */
function mapLegacyToModuleAction(
  permissionKey: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): { module: CathaModuleKey; action: CathaPermissionAction } | null {
  const key = (permissionKey || '').trim()
  const normAction: CathaPermissionAction =
    action === 'create' ? 'add' : (action as CathaPermissionAction)

  switch (key) {
    case 'system.userManagement':
      return { module: 'users', action: normAction }
    case 'system.dashboard':
      return { module: 'dashboard', action: normAction }
    case 'system.settings':
      return { module: 'settings', action: normAction }
    case 'system.reports':
      return { module: 'reports', action: normAction }
    case 'sales.orders':
      return { module: 'orders', action: normAction }
    case 'sales.posSales':
      return { module: 'pos', action: normAction }
    case 'inventory.inventory':
      return { module: 'inventory', action: normAction }
    case 'inventory.suppliers':
      return { module: 'suppliers', action: normAction }
    case 'inventory.stockMovement':
      return { module: 'stockMovement', action: normAction }
    case 'financial.mpesaTransactions':
      return { module: 'mpesa', action: normAction }
    case 'financial.expenses':
      return { module: 'expenses', action: normAction }
    case 'management.clients':
      return { module: 'clients', action: normAction }
    case 'operations.tables':
      return { module: 'tables', action: normAction }
    case 'operations.tableQrCodes':
      return { module: 'tableQrCodes', action: normAction }
    case 'management.distributorRequests':
      return { module: 'distributorRequests', action: normAction }
    default:
      return null
  }
}

type LegacyAction = 'view' | 'create' | 'edit' | 'delete'
type LegacyPermissionInput = { permissionKey: string; action?: LegacyAction }

/**
 * Catha-only API helper (structured permissions) used by many /api/catha routes.
 * Returns { allowed, response } instead of redirecting.
 */
export async function requireCathaPermission(permissionKey: string, action: LegacyAction = 'view') {
  const session = await auth()
  if (!session?.user?.email) {
    return { allowed: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = ((session.user as any).role as string | undefined)?.toUpperCase() ?? 'PENDING'
  const status = ((session.user as any).status as string | undefined)?.toUpperCase() ?? 'PENDING'
  const permissions: CathaPermissions = normalizePermissions((session.user as any).permissions)

  if (status === 'PENDING') {
    return { allowed: false, response: NextResponse.json({ error: 'Account pending approval' }, { status: 403 }) }
  }
  if (status === 'DISABLED') {
    return { allowed: false, response: NextResponse.json({ error: 'Account disabled' }, { status: 403 }) }
  }
  if (role === 'SUPER_ADMIN') {
    return { allowed: true, response: null as null }
  }

  const mapping = mapLegacyToModuleAction(permissionKey, action)
  if (!mapping) {
    return { allowed: false, response: NextResponse.json({ error: 'Unknown permission key' }, { status: 403 }) }
  }

  const ok = hasCathaPermission(permissions, mapping.module, mapping.action)
  if (ok) return { allowed: true, response: null as null }

  return { allowed: false, response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
}

/** Allows unauthenticated callers; when authenticated, enforces at least one permission entry. */
export async function requireCathaPermissionOrPublic(entries: LegacyPermissionInput[]) {
  const session = await auth()
  if (!session?.user?.email) {
    return { allowed: true, response: null as null }
  }

  const role = ((session.user as any).role as string | undefined)?.toUpperCase() ?? 'PENDING'
  const status = ((session.user as any).status as string | undefined)?.toUpperCase() ?? 'PENDING'
  const permissions: CathaPermissions = normalizePermissions((session.user as any).permissions)

  if (status === 'PENDING' || status === 'DISABLED') {
    return { allowed: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (role === 'SUPER_ADMIN') {
    return { allowed: true, response: null as null }
  }

  const ok = entries.some((entry) => {
    const mapping = mapLegacyToModuleAction(entry.permissionKey, entry.action ?? 'view')
    return mapping ? hasCathaPermission(permissions, mapping.module, mapping.action) : false
  })

  if (ok) return { allowed: true, response: null as null }
  return { allowed: false, response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
}

/** Authenticated-only helper: requires at least one matching permission entry. */
export async function requireCathaPermissionAny(entries: LegacyPermissionInput[]) {
  const session = await auth()
  if (!session?.user?.email) {
    return { allowed: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = ((session.user as any).role as string | undefined)?.toUpperCase() ?? 'PENDING'
  const status = ((session.user as any).status as string | undefined)?.toUpperCase() ?? 'PENDING'
  const permissions: CathaPermissions = normalizePermissions((session.user as any).permissions)

  if (status === 'PENDING' || status === 'DISABLED') {
    return { allowed: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (role === 'SUPER_ADMIN') {
    return { allowed: true, response: null as null }
  }

  const ok = entries.some((entry) => {
    const mapping = mapLegacyToModuleAction(entry.permissionKey, entry.action ?? 'view')
    return mapping ? hasCathaPermission(permissions, mapping.module, mapping.action) : false
  })

  if (ok) return { allowed: true, response: null as null }
  return { allowed: false, response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
}

/** SUPER_ADMIN guard used in older API routes. */
export async function requireSuperAdminCatha() {
  const session = await auth()
  if (!session?.user?.email) {
    return { session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = ((session.user as any).role as string | undefined)?.toUpperCase() ?? 'PENDING'
  if (role !== 'SUPER_ADMIN') {
    return { session, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, response: null as null }
}
