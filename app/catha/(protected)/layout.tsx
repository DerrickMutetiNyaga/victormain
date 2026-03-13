import { requireCathaAuth } from '@/lib/catha-auth'

export default async function CathaProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCathaAuth()
  return <>{children}</>
}
