"use client"

import { useSession } from "next-auth/react"
import { useMemo } from "react"
import { hasCathaPermission, normalizePermissions, CathaModuleKey } from "@/lib/catha-permissions-model"

export interface PagePermissions {
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Returns permission flags for the current user for a given Catha module.
 * SUPER_ADMIN gets all true; others use structured CathaPermissions; others get all false.
 */
export function useCathaPermissions(module: CathaModuleKey): PagePermissions {
  const { data: session, status } = useSession()
  return useMemo(() => {
    if (status === "loading" || !session?.user) {
      return { canView: false, canAdd: false, canEdit: false, canDelete: false }
    }
    const user = session.user as any
    const role = (user.role ?? "").toUpperCase()
    const perms = normalizePermissions(user.permissions)

    if (role === "SUPER_ADMIN") {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true }
    }

    return {
      canView: hasCathaPermission(perms, module, "view"),
      canAdd: hasCathaPermission(perms, module, "add"),
      canEdit: hasCathaPermission(perms, module, "edit"),
      canDelete: hasCathaPermission(perms, module, "delete"),
    }
  }, [session?.user, status, module])
}
