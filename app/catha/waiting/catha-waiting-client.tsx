'use client'

import { useRouter } from 'next/navigation'

export function CathaWaitingClient({ email }: { email: string }) {
  const router = useRouter()
  const signOutUrl = '/api/auth/catha/signout?callbackUrl=' + encodeURIComponent('/catha/login')

  return (
    <div className="w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-center space-y-4">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account pending approval</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your account is under review. You’ll be able to access Catha once an administrator approves you.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{email}</p>
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="w-full rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
        >
          Refresh status
        </button>
        <a
          href={signOutUrl}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-center block"
        >
          Sign out
        </a>
      </div>
    </div>
  )
}
