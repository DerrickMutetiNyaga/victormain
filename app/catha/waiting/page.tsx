import { redirect } from 'next/navigation'
import { getCathaSession } from '@/lib/catha-auth'
import { CathaWaitingClient } from './catha-waiting-client'

export default async function CathaWaitingPage() {
  const session = await getCathaSession()
  if (!session?.user?.email) redirect('/catha/login')
  const status = (session.user as { status?: string }).status ?? 'PENDING'
  if (status.toUpperCase() !== 'PENDING') redirect('/catha')

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <CathaWaitingClient email={session.user.email} />
    </div>
  )
}
