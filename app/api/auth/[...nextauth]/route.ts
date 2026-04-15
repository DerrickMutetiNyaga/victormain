import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getUserByEmail, getUserByProviderId, createUser, updateUserLastLogin } from '@/lib/models/user'
import { getBarUserByEmail, getBarUserByProviderId, createBarUser, updateBarUserLastLogin } from '@/lib/models/bar-user'
import { cookies, headers } from 'next/headers'

// Validate environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Missing Google OAuth credentials. Please check your .env file.')
}

// Validate and normalize NEXTAUTH_URL (remove trailing slash if present)
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/$/, '')
  console.log(`[NextAuth] NEXTAUTH_URL set to: ${process.env.NEXTAUTH_URL}`)
}

if (!process.env.NEXTAUTH_SECRET) {
  console.error('⚠️ WARNING: NEXTAUTH_SECRET is not set. Authentication may not work correctly.')
} else {
  console.log(`[NextAuth] NEXTAUTH_SECRET is set (length: ${process.env.NEXTAUTH_SECRET.length})`)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  basePath: '/api/auth',
  // CRITICAL: Explicitly set session strategy to JWT for middleware compatibility
  // getToken() in middleware ONLY works with JWT sessions, not database sessions
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // CRITICAL: Each app MUST use its own cookie name to prevent collisions
  // Catha → catha.session-token
  // Jaba → jaba.session-token
  // Default to jaba - will be overridden dynamically based on auth_context during sign-in
  cookies: {
    sessionToken: {
      name: (() => {
        const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
        const prefix = isProduction ? '__Secure-' : ''
        // Default to jaba - actual cookie name set dynamically in signIn callback
        return `${prefix}jaba.session-token`
      })(),
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://'),
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
          console.error('[NextAuth] ❌ No email provided by Google')
          return false
        }

        console.log(`[NextAuth] 🔐 Processing sign in for: ${user.email}`)

        try {
          // Auth context: which app is signing in. Catha = bar_users only, Jaba = jaba_users only (fully separate collections).
          let isCathaContext = false
          
          // Method 1: Try to read from cookie (most reliable)
          try {
            const cookieStore = await cookies()
            const authContext = cookieStore.get('auth_context')
            if (authContext?.value === 'bar') {
              isCathaContext = true
              console.log('[NextAuth] 🍺 Catha (bar) context from cookie – using bar_users only')
            } else if (authContext?.value === 'jaba') {
              isCathaContext = false
              console.log('[NextAuth] 🏭 Jaba context from cookie – using jaba_users only')
            }
          } catch (cookieError) {
            console.log('[NextAuth] ⚠️ Could not read auth_context cookie, trying alternative methods')
          }
          
          // Method 2: If cookie not available, check if user exists in bar_users (they're signing in from /catha)
          // This is a fallback for when cookies don't persist through OAuth redirect
          if (!isCathaContext) {
            try {
              const barUser = await getBarUserByEmail(user.email)
              if (barUser) {
                // User exists in bar_users, likely signing in from Catha
                // But we need to be careful - they might also exist in jaba_users
                const jabaUser = await getUserByEmail(user.email)
                if (!jabaUser || (barUser && jabaUser && barUser._id && jabaUser._id && barUser._id.toString() !== jabaUser._id.toString())) {
                  // User only exists in bar_users, or exists in both but they're different users
                  // Check the referer or callback URL if available
                  try {
                    const headersList = await headers()
                    const referer = headersList.get('referer') || ''
                    if (referer.includes('/catha/') || referer.includes('/catha?')) {
                      isCathaContext = true
                      console.log('[NextAuth] 🍺 Catha (bar) context from referer – using bar_users only')
                    }
                  } catch (headerError) {
                    // If we can't determine from referer, default based on which collection they exist in
                    // If they exist in both, prefer bar_users (Catha) as it's more restrictive
                    if (barUser && !jabaUser) {
                      isCathaContext = true
                      console.log('[NextAuth] 🍺 Catha (bar) context – user only exists in bar_users')
                    }
                  }
                }
              }
            } catch (dbError) {
              console.log('[NextAuth] ⚠️ Could not check user collections:', dbError)
            }
          }
          
          if (!isCathaContext) {
            console.log('[NextAuth] 🏭 Jaba context – using jaba_users only')
          }

          if (isCathaContext) {
            // ─── Catha only: bar_users collection ───
            const barUser = await getBarUserByEmail(user.email)
            if (barUser) {
              console.log(`[NextAuth] ✅ Catha user exists (bar_users): ${barUser.email}`)
              try {
                await updateBarUserLastLogin(user.email)
                if (!barUser.providerId) {
                  const client = await (await import('@/lib/mongodb')).default
                  await client.db('infusion_jaba').collection('bar_users').updateOne(
                    { email: user.email },
                    { $set: { providerId: account.providerAccountId, provider: 'google' } }
                  )
                }
              } catch (e: any) {
                console.error('[NextAuth] ⚠️ Bar user update failed:', e.message)
              }
              ;(account as any).userCollection = 'bar'
              return true
            }
            console.log(`[NextAuth] 📝 New Catha user (bar_users): ${user.email}`)
            try {
              const barUser = await createBarUser({
                name: user.name || 'User',
                email: user.email,
                image: user.image || undefined,
                role: 'pending' as 'pending' | 'admin' | 'super_admin',
                status: 'active',
                permissions: [],
                provider: 'google',
                providerId: account.providerAccountId,
              })
              console.log(`[NextAuth] ✅ Bar user created for Catha: ${barUser.email} (role: pending)`)
              await updateBarUserLastLogin(user.email)
              ;(account as any).userCollection = 'bar'
              return true
            } catch (createError: any) {
              console.error('[NextAuth] ❌ Failed to create bar user:', createError.message)
              return false
            }
          }

          // ─── Jaba only: jaba_users collection ───
          const jabaUser = await getUserByEmail(user.email)
          if (jabaUser) {
            console.log(`[NextAuth] ✅ Jaba user exists (jaba_users): ${jabaUser.email}`)
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
              console.error('[NextAuth] ⚠️ Jaba user update failed:', e.message)
            }
            ;(account as any).userCollection = 'jaba'
            return true
          } else {
            // User doesn't exist - create in appropriate collection based on auth context
            const shouldCreateBarUser = isCathaContext
            console.log(`[NextAuth] 📝 User not found, creating new ${shouldCreateBarUser ? 'bar' : 'jaba'} user: ${user.email}`)
            
            try {
              if (shouldCreateBarUser) {
                const barUser = await createBarUser({
                  name: user.name || 'User',
                  email: user.email,
                  image: user.image || undefined,
                  provider: 'google',
                  providerId: account.providerAccountId,
                })
                console.log(`[NextAuth] ✅ New bar user created successfully: ${barUser.email} (ID: ${barUser._id})`)
                const verifyUser = await getBarUserByEmail(user.email)
                if (!verifyUser) {
                  throw new Error('Bar user creation succeeded but user not found in database')
                }
                ;(account as any).userCollection = 'bar'
              } else {
                const dbUser = await createUser({
                  name: user.name || 'User',
                  email: user.email,
                  image: user.image || undefined,
                  provider: 'google',
                  providerId: account.providerAccountId,
                })
                console.log(`[NextAuth] ✅ New jaba user created successfully: ${dbUser.email} (ID: ${dbUser._id})`)
                const verifyUser = await getUserByEmail(user.email)
                if (!verifyUser) {
                  throw new Error('Jaba user creation succeeded but user not found in database')
                }
                ;(account as any).userCollection = 'jaba'
              }
              console.log(`[NextAuth] ✅ User verified in database`)
              return true
            } catch (createError: any) {
              console.error('[NextAuth] ❌ CRITICAL: Failed to create user in database')
              console.error('[NextAuth] ❌ Error:', createError.message)
              console.error('[NextAuth] ❌ Sign-in BLOCKED until MongoDB connection is fixed')
              return false
            }
          }
        } catch (error: any) {
          console.error('[NextAuth] ❌ CRITICAL: MongoDB connection failed')
          console.error('[NextAuth] ❌ Error:', error.message)
          console.error('[NextAuth] ❌ Sign-in BLOCKED - MongoDB must be working')
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (!session.user?.email) {
        console.error('[NextAuth Session] ❌ No email in session')
        return session
      }

      // Always fetch fresh data from database - never trust cached token values
      let userCollection = (token as any).userCollection
      
      // If userCollection is not in token, determine it ONLY from auth_context cookie
      if (!userCollection) {
        try {
          const cookieStore = await cookies()
          const authContext = cookieStore.get('auth_context')
          userCollection = authContext?.value === 'bar' ? 'bar' : 'jaba'
        } catch {
          userCollection = 'jaba'
        }
      }
      
      ;(session.user as any).userCollection = userCollection

      // Always fetch fresh user data from database
      try {
        if (userCollection === 'bar') {
          const barUser = await getBarUserByEmail(session.user.email)
          if (barUser) {
            session.user.id = barUser._id?.toString()
            // Normalize role - ensure it's one of the valid values
            const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
              ? barUser.role 
              : 'pending'
            session.user.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
            session.user.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
            
            // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
            if (normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin') {
              session.user.approved = true
            } else {
              session.user.approved = barUser.approved ?? false
            }
            
            // SUPER ADMIN: Give access to ALL routes (bypass permission checks)
            if (normalizedRole === 'super_admin') {
              const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
              session.user.routePermissions = Object.values(PERMISSION_PAGE_ROUTES) as string[]
              console.log(`[NextAuth Session] ✅ Super admin - granted access to ALL ${session.user.routePermissions.length} routes`)
            } else if ((barUser.role === 'cashier_admin' || barUser.role === 'manager_admin') && Array.isArray(barUser.permissions)) {
              session.user.permissions = barUser.permissions
              // Include route permissions if available
              if (Array.isArray(barUser.routePermissions)) {
                session.user.routePermissions = barUser.routePermissions
              } else {
                // Convert PagePermissionEntry[] to route strings
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                const routes: string[] = []
                barUser.permissions.forEach((perm) => {
                  if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
                    routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
                  }
                })
                session.user.routePermissions = routes
              }
            } else if (Array.isArray(barUser.routePermissions)) {
              session.user.routePermissions = barUser.routePermissions
            }
            
            console.log(`[NextAuth Session] Bar user - role: ${barUser.role}, normalizedRole: ${normalizedRole}, session.role: ${session.user.role}, session.approved: ${session.user.approved}, routePermissions: ${session.user.routePermissions?.length || 0}`)
          } else {
            console.error(`[NextAuth Session] ⚠️ Bar user not found for email: ${session.user.email}`)
          }
        } else {
          const dbUser = await getUserByEmail(session.user.email)
          if (dbUser) {
            session.user.id = dbUser._id?.toString()
            // Normalize role - ensure it's one of the valid values
            const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
              ? dbUser.role 
              : 'pending'
            session.user.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
            session.user.status = dbUser.status || 'active'
            
            // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
            if (normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin') {
              session.user.approved = true
            } else {
              session.user.approved = dbUser.approved ?? false
            }
            
            // SUPER ADMIN: Give access to ALL routes (bypass permission checks)
            // For super_admin, we don't need to set routePermissions - middleware checks role directly
            if (normalizedRole === 'super_admin') {
              // Super admin bypasses all permission checks in middleware
              session.user.routePermissions = []
              console.log(`[NextAuth Session] ✅ Jaba Super admin - will bypass all permission checks`)
            } else if (Array.isArray(dbUser.routePermissions)) {
              session.user.routePermissions = dbUser.routePermissions
            } else if (dbUser.permissions) {
              // Convert UserPermissions object to route strings
              // Define Jaba routes mapping
              const jabaRoutes: Record<string, string> = {
                'dashboard': '/jaba',
                'batches': '/jaba/batches',
                'batches-add': '/jaba/batches/add',
                'packaging': '/jaba/packaging-output',
                'packaging-add': '/jaba/packaging-output/add',
                'raw-materials': '/jaba/raw-materials',
                'raw-materials-add': '/jaba/raw-materials/add',
                'qc-checklist': '/jaba/qc/checklist',
                'qc-results': '/jaba/qc/results',
                'distribution': '/jaba/distribution',
                'distribution-create': '/jaba/distribution/create',
                'dispatch': '/jaba/distribution/dispatch',
                'suppliers': '/jaba/suppliers',
                'suppliers-add': '/jaba/suppliers/add',
                'distributors': '/jaba/distributors',
                'distributors-add': '/jaba/distributors/add',
                'storage-finished': '/jaba/storage/finished',
                'storage-movement': '/jaba/storage/movement',
                'reports-batches': '/jaba/reports/batches',
                'reports-production': '/jaba/reports/production',
                'reports-materials': '/jaba/reports/materials',
                'reports-distribution': '/jaba/reports/distribution',
                'settings': '/jaba/settings',
              }
              const routes: string[] = []
              Object.entries(dbUser.permissions).forEach(([pageId, perms]) => {
                if (perms.view && jabaRoutes[pageId]) {
                  routes.push(jabaRoutes[pageId])
                }
              })
              session.user.routePermissions = routes
            }
            
            console.log(`[NextAuth Session] Jaba user - role: ${dbUser.role}, normalizedRole: ${normalizedRole}, session.role: ${session.user.role}, session.approved: ${session.user.approved}, routePermissions: ${session.user.routePermissions?.length || 0}`)
          } else {
            console.error(`[NextAuth Session] ⚠️ Jaba user not found for email: ${session.user.email}`)
          }
        }
      } catch (error: any) {
        console.error('[NextAuth Session] ❌ Error fetching user data:', error.message)
        // Don't fail the session, but log the error
      }
      
      return session
    },
    async jwt({ token, user, account, trigger }) {
      console.log(`[NextAuth JWT] Called - trigger: ${trigger}, user: ${user?.email || 'none'}, account: ${account?.provider || 'none'}`)
      
      // On sign in, user and account are available
      if (user && account?.provider === 'google') {
        token.id = user.id
        // Store email in token for later use
        if (user.email) {
          (token as any).email = user.email
        }
        
        // Get userCollection from account (set in signIn callback)
        let userCollection = (account as any).userCollection
        
        // If not set, determine ONLY from auth_context cookie
        if (!userCollection) {
          try {
            const cookieStore = await cookies()
            const authContext = cookieStore.get('auth_context')
            userCollection = authContext?.value === 'bar' ? 'bar' : 'jaba'
            console.log(`[NextAuth JWT] Determined userCollection from cookie: ${userCollection}`)
          } catch (error) {
            console.error(`[NextAuth JWT] Error reading cookie:`, error)
            userCollection = 'jaba'
          }
        }
        
        ;(token as any).userCollection = userCollection
        console.log(`[NextAuth JWT] userCollection set to: ${userCollection}`)
        
        // Fetch fresh user data from database - use email as primary method (more reliable)
        if (userCollection === 'bar' && user.email) {
          try {
            // Try email first (most reliable), then fallback to providerId
            let barUser = await getBarUserByEmail(user.email)
            if (!barUser && account.providerAccountId) {
              console.log(`[NextAuth JWT] User not found by email, trying providerId: ${account.providerAccountId}`)
              barUser = await getBarUserByProviderId(account.providerAccountId)
            }
            
            if (barUser) {
              const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
                ? barUser.role 
                : 'pending'
              token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
              token.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
              // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
              token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (barUser.approved ?? false)
              
              // SUPER ADMIN: Give access to ALL routes (bypass permission checks)
              if (normalizedRole === 'super_admin') {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                token.routePermissions = Object.values(PERMISSION_PAGE_ROUTES) as string[]
                console.log(`[NextAuth JWT] ✅ Super admin - granted access to ALL ${token.routePermissions.length} routes`)
              } else if ((barUser.role === 'cashier_admin' || barUser.role === 'manager_admin') && Array.isArray(barUser.permissions)) {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                const routes: string[] = []
                barUser.permissions.forEach((perm) => {
                  if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
                    routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
                  }
                })
                token.routePermissions = routes
              } else if (Array.isArray(barUser.routePermissions)) {
                token.routePermissions = barUser.routePermissions
              }
              
              console.log(`[NextAuth JWT] ✅ Bar user data SET - email: ${user.email}, role: ${barUser.role}, normalizedRole: ${normalizedRole}, approved: ${barUser.approved}, token.approved: ${token.approved}, token.role: ${token.role}, routePermissions: ${token.routePermissions?.length || 0}`)
            } else {
              console.error(`[NextAuth JWT] ❌ Bar user not found for email: ${user.email}, providerId: ${account.providerAccountId}`)
              // Set default values if user not found
              token.role = 'pending'
              token.approved = false
              console.log(`[NextAuth JWT] ⚠️ Set default role: pending, approved: false`)
            }
          } catch (error: any) {
            console.error(`[NextAuth JWT] ❌ ERROR fetching bar user:`, error.message)
            // Set default values on error
            token.role = 'pending'
            token.approved = false
          }
        } else if (user.email) {
          // Try email first (most reliable), then fallback to providerId
          let dbUser = await getUserByEmail(user.email)
          if (!dbUser && account.providerAccountId) {
            dbUser = await getUserByProviderId(account.providerAccountId)
          }
          
          if (dbUser) {
            // Normalize role - ensure it's one of the valid values
            const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
              ? dbUser.role 
              : 'pending'
            token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
            token.status = dbUser.status || 'active'
            // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
            token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (dbUser.approved ?? false)
            
            // SUPER ADMIN: Don't need routePermissions - middleware checks role directly
            if (normalizedRole === 'super_admin') {
              token.routePermissions = []
              console.log(`[NextAuth JWT] ✅ Jaba Super admin - will bypass all permission checks`)
            } else if (Array.isArray(dbUser.routePermissions)) {
              token.routePermissions = dbUser.routePermissions
            }
            
            console.log(`[NextAuth JWT] Jaba user data - email: ${user.email}, role: ${dbUser.role}, normalizedRole: ${normalizedRole}, approved: ${dbUser.approved}, token.approved: ${token.approved}, token.role: ${token.role}`)
          }
        }
      }
      
      // On session update (trigger === 'update'), ALWAYS refresh from database
      if (trigger === 'update') {
        const userCollection = (token as any).userCollection
        const email = (token as any).email || (user as any)?.email || (account as any)?.email
        
        console.log(`[NextAuth JWT Update] Trigger: update, email: ${email}, userCollection: ${userCollection}`)
        
        if (email && userCollection) {
          try {
            if (userCollection === 'bar') {
              const barUser = await getBarUserByEmail(email)
            if (barUser) {
              const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
                ? barUser.role 
                : 'pending'
              token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
              token.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
              // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
              token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (barUser.approved ?? false)
              
              // SUPER ADMIN: Give access to ALL routes (bypass permission checks)
              if (normalizedRole === 'super_admin') {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                token.routePermissions = Object.values(PERMISSION_PAGE_ROUTES) as string[]
                console.log(`[NextAuth JWT Update] ✅ Super admin - granted access to ALL ${token.routePermissions.length} routes`)
              } else if ((barUser.role === 'cashier_admin' || barUser.role === 'manager_admin') && Array.isArray(barUser.permissions)) {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                const routes: string[] = []
                barUser.permissions.forEach((perm) => {
                  if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
                    routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
                  }
                })
                token.routePermissions = routes
              } else if (Array.isArray(barUser.routePermissions)) {
                token.routePermissions = barUser.routePermissions
              }
              
              console.log(`[NextAuth JWT Update] Bar user refreshed - role: ${barUser.role}, normalizedRole: ${normalizedRole}, approved: ${barUser.approved}, token.role: ${token.role}, token.approved: ${token.approved}, routePermissions: ${token.routePermissions?.length || 0}`)
            } else {
              console.error(`[NextAuth JWT Update] ❌ Bar user not found for email: ${email}`)
            }
            } else {
              const dbUser = await getUserByEmail(email)
              if (dbUser) {
                // Normalize role - ensure it's one of the valid values
                const normalizedRole = (dbUser.role === 'super_admin' || dbUser.role === 'cashier_admin' || dbUser.role === 'manager_admin' || dbUser.role === 'pending') 
                  ? dbUser.role 
                  : 'pending'
                token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
                token.status = dbUser.status || 'active'
                // CRITICAL: super_admin, cashier_admin, and manager_admin are ALWAYS approved
                token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (dbUser.approved ?? false)
                
                // SUPER ADMIN: Don't need routePermissions - middleware checks role directly
                if (normalizedRole === 'super_admin') {
                  token.routePermissions = []
                } else if (Array.isArray(dbUser.routePermissions)) {
                  token.routePermissions = dbUser.routePermissions
                }
              }
            }
          } catch (error: any) {
            console.error('[NextAuth JWT Update] ❌ Error refreshing token:', error.message)
          }
        }
      }
      
      // CRITICAL SAFETY CHECK: Ensure role is ALWAYS set before returning token
      // This prevents undefined role issues in middleware
      if (!token.role && (token as any).email) {
        console.error(`[NextAuth JWT] ❌ CRITICAL: token.role is undefined after all logic for ${(token as any).email}`)
        console.error(`[NextAuth JWT] Token state:`, { 
          id: token.id, 
          email: (token as any).email, 
          userCollection: (token as any).userCollection,
          trigger 
        })
        // Try to fetch one more time as last resort
        try {
          const email = (token as any).email
          const userCollection = (token as any).userCollection
          if (email && userCollection === 'bar') {
            const barUser = await getBarUserByEmail(email)
            if (barUser) {
              const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'admin' || barUser.role === 'pending') 
                ? barUser.role 
                : 'pending'
              token.role = (normalizedRole === 'super_admin' || normalizedRole === 'admin' ? normalizedRole : 'pending') as 'pending' | 'admin' | 'super_admin'
              token.approved = normalizedRole === 'super_admin' || normalizedRole === 'admin' || (barUser.approved ?? false)
              console.log(`[NextAuth JWT] 🔧 Last resort fix: Set token.role to ${token.role}`)
            }
          }
        } catch (error: any) {
          console.error(`[NextAuth JWT] ❌ Last resort fetch failed:`, error.message)
        }
        
        // If still no role, set to pending
        if (!token.role) {
          token.role = 'pending'
          token.approved = false
          console.log(`[NextAuth JWT] ⚠️ Final fallback: Set token.role to pending`)
        }
      }
      
      console.log(`[NextAuth JWT] ✅ Returning token - role: ${token.role}, approved: ${token.approved}, userCollection: ${(token as any).userCollection}`)
      return token
    },
  },
  pages: {
    signIn: '/jaba/login',
    error: '/jaba/login',
  },
  session: {
    strategy: 'jwt',
  },
})

export const { GET, POST } = handlers

// Force Node.js runtime (not Edge) to support MongoDB and crypto
export const runtime = 'nodejs'

