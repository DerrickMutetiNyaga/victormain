import { redirect } from 'next/navigation'
import { requireCathaAuth } from '@/lib/catha-auth'
import { getFirstAllowedRoute } from '@/lib/catha-access'
import { normalizePermissions } from '@/lib/catha-permissions-model'

export default async function CathaEntryPage() {
  const session = await requireCathaAuth()
  const user = session.user as { role?: string; status?: string; permissions?: unknown }
  const permissions = normalizePermissions(user.permissions)
  const firstRoute = getFirstAllowedRoute({
    role: user.role,
    status: user.status,
    permissions,
  })
  redirect(firstRoute)
}

