import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getUserByEmail, getUserByProviderId, createUser, updateUserLastLogin } from '@/lib/models/user'
import { buildRoutePermissionsFromUserPermissions } from '@/lib/jaba-permissions'

// Validate environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('[Jaba Auth] Missing Google OAuth credentials. Please check your .env file.')
}

// CRITICAL: Require separate secret for Jaba in production
// Do NOT fall back to NEXTAUTH_SECRET in production to prevent secret sharing
const isProduction = process.env.NODE_ENV === 'production'
const JABA_SECRET = process.env.AUTH_SECRET_JABA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)

if (!JABA_SECRET) {
  if (isProduction) {
    throw new Error('[Jaba Auth] ❌ CRITICAL: AUTH_SECRET_JABA must be set in production. Do not use NEXTAUTH_SECRET fallback.')
  } else {
    console.error('[Jaba Auth] ⚠️ WARNING: AUTH_SECRET_JABA is not set. Using NEXTAUTH_SECRET fallback (dev only).')
    if (!process.env.NEXTAUTH_SECRET) {
      throw new Error('[Jaba Auth] ❌ NEXTAUTH_SECRET is also not set. Authentication will not work.')
    }
  }
} else {
  console.log(`[Jaba Auth] ✅ Secret configured (length: ${JABA_SECRET.length})`)
}

// Validate and normalize NEXTAUTH_URL (remove trailing slash if present)
let NEXTAUTH_URL = process.env.NEXTAUTH_URL
if (NEXTAUTH_URL) {
  NEXTAUTH_URL = NEXTAUTH_URL.replace(/\/$/, '')
  console.log(`[Jaba Auth] NEXTAUTH_URL set to: ${NEXTAUTH_URL}`)
}

export const jabaAuth = NextAuth({
  trustHost: true,
  basePath: '/api/auth/jaba',
  secret: JABA_SECRET,
  // CRITICAL: Explicitly set session strategy to JWT for middleware compatibility
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // CRITICAL: Jaba uses its own cookie name to prevent conflicts with Catha
  cookies: {
    sessionToken: {
      name: (() => {
        const isProduction = process.env.NODE_ENV === 'production' || NEXTAUTH_URL?.startsWith('https://')
        const prefix = isProduction ? '__Secure-' : ''
        return `${prefix}jaba.session-token`
      })(),
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production' || NEXTAUTH_URL?.startsWith('https://'),
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      async profile(profile, tokens) {
        return {
          ...profile,
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        if (!user.email) {
          console.error('[Jaba Auth] ❌ No email provided by Google')
          return false
        }

        console.log(`[Jaba Auth] 🔐 Processing sign in for: ${user.email}`)

        try {
          // Jaba ONLY uses jaba_users collection
          const jabaUser = await getUserByEmail(user.email)
          if (jabaUser) {
            console.log(`[Jaba Auth] ✅ Jaba user exists (jaba_users): ${jabaUser.email}`)
            try {
              await updateUserLastLogin(user.email)
              if (!jabaUser.providerId) {
                const client = await (await import('@/lib/mongodb')).default
                await client.db('infusion_jaba').collection('jaba_users').updateOne(
                  { email: user.email },
                  { $set: { providerId: account.providerAccountId, provider: 'google' } }
                )
              }
            } catch (e: any) {
              console.error('[Jaba Auth] ⚠️ Jaba user update failed:', e.message)
            }
            ;(account as any).userCollection = 'jaba'
            return true
          }
          
          // New user - create in jaba_users
          console.log(`[Jaba Auth] 📝 New Jaba user (jaba_users): ${user.email}`)
          try {
            const dbUser = await createUser({
              name: user.name || 'User',
              email: user.email,
              image: user.image || undefined,
              provider: 'google',
              providerId: account.providerAccountId,
            })
            console.log(`[Jaba Auth] ✅ Jaba user created: ${dbUser.email} (role: pending)`)
            await updateUserLastLogin(user.email)
            ;(account as any).userCollection = 'jaba'
            return true
          } catch (createError: any) {
            console.error('[Jaba Auth] ❌ Failed to create jaba user:', createError.message)
            return false
          }
        } catch (error: any) {
          console.error('[Jaba Auth] ❌ CRITICAL: MongoDB connection failed')
          console.error('[Jaba Auth] ❌ Error:', error.message)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (!session.user?.email) {
        console.error('[Jaba Auth Session] ❌ No email in session')
        return session
      }

      // Always fetch fresh data from database
      try {
        const dbUser = await getUserByEmail(session.user.email)
        if (dbUser) {
          session.user.id = dbUser._id?.toString()
          const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
            ? dbUser.role 
            : 'pending'
          session.user.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
          session.user.status = dbUser.status || 'active'
          session.user.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (dbUser.approved ?? false)
          ;(session.user as any).userCollection = 'jaba'

          // Include permissions in session for client-side filtering
          if (dbUser.permissions) {
            ;(session.user as any).permissions = dbUser.permissions
          }

          // SUPER ADMIN: Don't need routePermissions - middleware checks role directly
          if (normalizedRole === 'super_admin') {
            session.user.routePermissions = []
            console.log(`[Jaba Auth Session] ✅ Super admin - will bypass all permission checks`)
          } else if (Array.isArray(dbUser.routePermissions) && dbUser.routePermissions.length > 0) {
            session.user.routePermissions = dbUser.routePermissions
          } else {
            session.user.routePermissions = buildRoutePermissionsFromUserPermissions(dbUser.permissions)
          }
          
          console.log(`[Jaba Auth Session] Jaba user - role: ${dbUser.role}, normalizedRole: ${normalizedRole}, session.role: ${session.user.role}, session.approved: ${session.user.approved}, routePermissions: ${session.user.routePermissions?.length || 0}`)
        } else {
          console.error(`[Jaba Auth Session] ⚠️ Jaba user not found for email: ${session.user.email}`)
          session.user.role = 'pending'
          session.user.approved = false
          ;(session.user as any).userCollection = 'jaba'
        }
      } catch (error: any) {
        console.error(`[Jaba Auth Session] ❌ ERROR fetching jaba user:`, error.message)
        session.user.role = 'pending'
        session.user.approved = false
        ;(session.user as any).userCollection = 'jaba'
      }

      return session
    },
    async jwt({ token, user, account, trigger }) {
      console.log(`[Jaba Auth JWT] Called - trigger: ${trigger}, user: ${user?.email || 'none'}, account: ${account?.provider || 'none'}`)
      
      // CRITICAL: Always force token.app to 'jaba' (this is the Jaba auth instance)
      // This ensures tokens are never "repaired" from the other app
      const previousApp = (token as any).app
      ;(token as any).app = 'jaba'
      if (previousApp && previousApp !== 'jaba') {
        console.log(`[Jaba Auth JWT] ⚠️ Token had app="${previousApp}", forcing to "jaba" (Jaba instance)`)
      }
      
      // ✅ SAFE TOKEN LOGGING: Log non-sensitive token fields to confirm token generation
      const isProduction = process.env.NODE_ENV === 'production'
      const tokenSnapshot = {
        id: (token as any)?.id?.substring(0, 8) + '...' || 'none',
        email: (token as any)?.email || 'none',
        app: (token as any)?.app || 'none',
        role: (token as any)?.role || 'none',
        approved: (token as any)?.approved ?? 'none',
        exp: (token as any)?.exp ? new Date((token as any).exp * 1000).toISOString() : 'none',
        userCollection: (token as any)?.userCollection || 'none',
      }
      console.log(`[Jaba Auth JWT] 📋 Token snapshot:`, JSON.stringify(tokenSnapshot, null, 2))
      
      // On sign in, user and account are available
      if (user && account?.provider === 'google') {
        token.id = user.id
        if (user.email) {
          (token as any).email = user.email
        }
        
        // App is already forced to 'jaba' above
        ;(token as any).userCollection = 'jaba'
        console.log(`[Jaba Auth JWT] app: jaba, userCollection: jaba`)
        
        // Fetch fresh user data from database
        if (user.email) {
          try {
            let dbUser = await getUserByEmail(user.email)
            if (!dbUser && account.providerAccountId) {
              dbUser = await getUserByProviderId(account.providerAccountId)
            }
            
            if (dbUser) {
              const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
                ? dbUser.role 
                : 'pending'
              token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
              token.status = dbUser.status || 'active'
              token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (dbUser.approved ?? false)
              
              // Include permissions in token for session
              if (dbUser.permissions) {
                ;(token as any).permissions = dbUser.permissions
              }

              // SUPER ADMIN: Don't need routePermissions - middleware checks role directly
              if (normalizedRole === 'super_admin') {
                ;(token as any).routePermissions = []
                console.log(`[Jaba Auth JWT] ✅ Super admin - will bypass all permission checks`)
              } else if (Array.isArray(dbUser.routePermissions) && dbUser.routePermissions.length > 0) {
                ;(token as any).routePermissions = dbUser.routePermissions
              } else {
                ;(token as any).routePermissions = buildRoutePermissionsFromUserPermissions(dbUser.permissions)
              }
              
              console.log(`[Jaba Auth JWT] ✅ Jaba user data SET - email: ${user.email}, role: ${dbUser.role}, normalizedRole: ${normalizedRole}, approved: ${dbUser.approved}, token.approved: ${token.approved}, token.role: ${token.role}, routePermissions: ${(token as any).routePermissions?.length || 0}`)
            } else {
              console.error(`[Jaba Auth JWT] ❌ Jaba user not found for email: ${user.email}`)
              token.role = 'pending'
              token.approved = false
            }
          } catch (error: any) {
            console.error(`[Jaba Auth JWT] ❌ ERROR fetching jaba user:`, error.message)
            token.role = 'pending'
            token.approved = false
          }
        }
      }
      
      // On token refresh, update user data
      if (trigger === 'update' && (token as any).email) {
        // App is already forced to 'jaba' at the start of this callback
        
        try {
          const dbUser = await getUserByEmail((token as any).email)
          if (dbUser) {
            const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
              ? dbUser.role 
              : 'pending'
            token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
            token.status = dbUser.status || 'active'
            token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (dbUser.approved ?? false)
            
            // Update permissions in token
            if (dbUser.permissions) {
              ;(token as any).permissions = dbUser.permissions
            }
            
            // Update routePermissions
            if (normalizedRole === 'super_admin') {
              ;(token as any).routePermissions = []
            } else if (Array.isArray(dbUser.routePermissions) && dbUser.routePermissions.length > 0) {
              ;(token as any).routePermissions = dbUser.routePermissions
            } else {
              ;(token as any).routePermissions = buildRoutePermissionsFromUserPermissions(dbUser.permissions)
            }
          }
        } catch (error: any) {
          console.error(`[Jaba Auth JWT] ❌ ERROR refreshing jaba user data:`, error.message)
        }
      }
      
      // App is already forced to 'jaba' at the start of this callback
      return token
    },
  },
  pages: {
    signIn: '/jaba/login',
    error: '/jaba/login',
  },
})

// Export auth function for use in API routes
export const { auth } = jabaAuth

