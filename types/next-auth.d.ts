import "next-auth"
import "next-auth/jwt"
import type { PagePermissionEntry } from "@/lib/permissions"

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      email: string
      name?: string | null
      image?: string | null
      /** Catha/bar: pending | admin | super_admin. Jaba: pending | admin | super_admin | manager | user */
      role?: 'pending' | 'admin' | 'super_admin' | 'manager' | 'user'
      status?: 'active' | 'disabled'
      /** Whether the user is approved */
      approved?: boolean
      /** Loaded for admin users to filter sidebar; super_admin sees all */
      permissions?: PagePermissionEntry[]
      /** Route-based permissions as array of route strings */
      routePermissions?: string[]
      /** Which app this session is for: 'bar' = Catha, 'jaba' = Jaba */
      userCollection?: 'bar' | 'jaba'
    }
  }

  interface User {
    id?: string
    role?: 'pending' | 'admin' | 'super_admin' | 'manager' | 'user'
    status?: 'active' | 'disabled'
    approved?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: 'pending' | 'admin' | 'super_admin' | 'manager' | 'user'
    status?: 'active' | 'disabled'
    approved?: boolean
    routePermissions?: string[]
    userCollection?: 'bar' | 'jaba'
  }
}

