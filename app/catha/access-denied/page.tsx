import Link from 'next/link'
import { getCathaSession } from '@/lib/catha-auth'
import { redirect } from 'next/navigation'
import { CathaAccessDeniedClient } from './catha-access-denied-client'

export default async function CathaAccessDeniedPage() {
  const session = await getCathaSession()
  if (!session?.user?.email) redirect('/catha/login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <CathaAccessDeniedClient />
    </div>
  )
}
