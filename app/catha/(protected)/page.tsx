import { getCathaSession } from '@/lib/catha-auth'
import BarDashboardContent from './dashboard-content'

export default async function CathaDashboardPage() {
  const session = await getCathaSession()
  const userName = session?.user?.name ?? session?.user?.email ?? 'User'
  return <BarDashboardContent userName={userName} />
}
