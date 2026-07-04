"use client"

import { useSession } from "next-auth/react"
import { useMemo, useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import {
  hasCathaPermission,
  normalizePermissions,
  CathaModuleKey,
  CATHA_AUTH_ME_REFRESH_EVENT,
} from "@/lib/catha-permissions-model"
import { useRefetchOnVisibility } from "@/hooks/use-refetch-on-visibility"

export interface PagePermissions {
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

type MeUser = {
  role?: string
  permissions?: unknown
}

/**
 * Permission flags from **database** via `/api/catha/auth/me`.
 * Refetches on route change, tab focus, bfcache restore, and User Management saves.
 */
export function useCathaPermissions(module: CathaModuleKey): PagePermissions {
  const { data: session, status: sessionStatus } = useSession()
  const pathname = usePathname()
  const [me, setMe] = useState<MeUser | null | undefined>(undefined)

  const loadMe = useCallback(() => {
    if (sessionStatus === "loading" || !session?.user) return
    fetch("/api/catha/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; user?: MeUser }) => {
        if (data?.ok && data?.user) setMe(data.user)
        else setMe(null)
      })
      .catch(() => setMe(null))
  }, [session?.user, sessionStatus])

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (!session?.user) {
      setMe(null)
      return
    }
    loadMe()
  }, [sessionStatus, session?.user, pathname, loadMe])

  useEffect(() => {
    const onRefresh = () => loadMe()
    if (typeof window !== "undefined") {
      window.addEventListener(CATHA_AUTH_ME_REFRESH_EVENT, onRefresh)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(CATHA_AUTH_ME_REFRESH_EVENT, onRefresh)
      }
    }
  }, [loadMe])

  useRefetchOnVisibility(
    sessionStatus !== "loading" && Boolean(session?.user),
    loadMe
  )

  return useMemo(() => {
    if (sessionStatus === "loading" || me === undefined) {
      return { canView: false, canAdd: false, canEdit: false, canDelete: false }
    }
    if (!me) {
      return { canView: false, canAdd: false, canEdit: false, canDelete: false }
    }
    const role = (me.role ?? "").toUpperCase()
    const perms = normalizePermissions(me.permissions)

    if (role === "SUPER_ADMIN") {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true }
    }

    return {
      canView: hasCathaPermission(perms, module, "view"),
      canAdd: hasCathaPermission(perms, module, "add"),
      canEdit: hasCathaPermission(perms, module, "edit"),
      canDelete: hasCathaPermission(perms, module, "delete"),
    }
  }, [me, sessionStatus, module])
}
