import { getCathaSession } from '@/lib/catha-auth'
import { redirect } from 'next/navigation'
import { CathaDisabledClient } from './catha-disabled-client'

export default async function CathaDisabledPage() {
  const session = await getCathaSession()
  if (!session?.user?.email) redirect('/catha/login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <CathaDisabledClient />
    </div>
  )
}
