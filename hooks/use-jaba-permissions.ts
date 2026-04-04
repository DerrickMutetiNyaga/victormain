"use client"

import { useSession } from "next-auth/react"
import { useMemo } from "react"

export interface UserPermissions {
  [pageId: string]: {
    view: boolean
    add: boolean
    edit: boolean
    delete: boolean
  }
}

export interface PagePermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Returns permission flags for the current user for a given page in Jaba.
 * Super_admin gets all true; cashier_admin and manager_admin use their permissions object; others get all false.
 */
export function useJabaPermissions(pageId: string): PagePermissions {
  const { data: session, status } = useSession()
  return useMemo(() => {
    if (status === "loading" || !session?.user) {
      return { canView: false, canCreate: false, canEdit: false, canDelete: false }
    }
    const role = session.user.role
    const permissions = (session.user as { permissions?: UserPermissions })?.permissions
    
    if (role === "super_admin") {
      return { canView: true, canCreate: true, canEdit: true, canDelete: true }
    }
    
    // Check permissions for cashier_admin and manager_admin
    if (role === "cashier_admin" || role === "manager_admin") {
      if (!permissions || !permissions[pageId]) {
        return { canView: false, canCreate: false, canEdit: false, canDelete: false }
      }
      const pagePerms = permissions[pageId]
      return {
        canView: pagePerms.view === true,
        canCreate: pagePerms.add === true,
        canEdit: pagePerms.edit === true,
        canDelete: pagePerms.delete === true,
      }
    }
    
    // For other roles (pending, etc.), no access
    return { canView: false, canCreate: false, canEdit: false, canDelete: false }
  }, [session?.user, status, pageId])
}

