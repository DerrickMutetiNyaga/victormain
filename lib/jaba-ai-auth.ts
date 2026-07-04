import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'

/** Jaba session must be authenticated and role must be super_admin. */
export async function requireJabaSuperAdmin(): Promise<
  { ok: true; email: string; userId: string } | { response: NextResponse }
> {
  const session = await auth()
  const email = session?.user?.email?.trim()
  if (!email) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await getUserByEmail(email)
  if (!user || user.role !== 'super_admin') {
    return { response: NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 }) }
  }
  return {
    ok: true,
    email,
    userId: user._id?.toString() ?? session?.user?.id ?? '',
  }
}
