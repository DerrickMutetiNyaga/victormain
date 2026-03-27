import { redirect } from 'next/navigation'
import { getCathaSession } from '@/lib/catha-auth'
import { CathaLoginForm } from './catha-login-form'

export default async function CathaLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const session = await getCathaSession()
  const params = await searchParams
  const callbackUrl = '/catha/entry'

  if (session?.user?.email) {
    const status = (session.user as { status?: string }).status ?? 'PENDING'
    const s = status.toUpperCase()
    if (s === 'PENDING') redirect('/catha/waiting')
    if (s === 'DISABLED') redirect('/catha/disabled')
    redirect('/catha/entry')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Catha Lounge</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign in to continue</p>
        </div>
        <CathaLoginForm callbackUrl={callbackUrl} error={params.error} />
      </div>
    </div>
  )
}
