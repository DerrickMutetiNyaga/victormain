import type { UserPermissions } from '@/lib/models/user'

/** Keys that must never be written via the permissions API (use dedicated admin routes). */
const RESERVED_TOP_LEVEL = new Set([
  'role',
  'approved',
  'status',
  'email',
  'name',
  'image',
  'provider',
  'providerId',
  'routePermissions',
  'permissions',
  '_id',
  'id',
  'createdAt',
  'lastLogin',
  'userCollection',
])

/**
 * Parses PATCH body for /api/jaba/users/[id]/permissions — page permissions only.
 * Rejects bodies that try to smuggle account-level fields.
 */
export function sanitizeJabaPermissionsPayload(body: unknown): { ok: true; permissions: UserPermissions } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid permissions body' }
  }
  const o = body as Record<string, unknown>
  for (const k of Object.keys(o)) {
    if (RESERVED_TOP_LEVEL.has(k)) {
      return { ok: false, error: 'Invalid field in permissions payload' }
    }
  }
  const out: UserPermissions = {}
  for (const [pageId, perms] of Object.entries(o)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(pageId) || pageId.length > 120) {
      return { ok: false, error: 'Invalid permission page id' }
    }
    if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
      return { ok: false, error: 'Invalid permission entry' }
    }
    const p = perms as Record<string, unknown>
    out[pageId] = {
      view: Boolean(p.view),
      add: Boolean(p.add),
      edit: Boolean(p.edit),
      delete: Boolean(p.delete),
    }
  }
  return { ok: true, permissions: out }
}
