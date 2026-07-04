'use client'

export function CathaDisabledClient() {
  const signOutUrl = '/api/auth/catha/signout?callbackUrl=' + encodeURIComponent('/catha/login')

  return (
    <div className="w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-center space-y-4">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account disabled</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your account has been disabled. Contact an administrator if you believe this is an error.
      </p>
      <a
        href={signOutUrl}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-center block"
      >
        Sign out
      </a>
    </div>
  )
}
