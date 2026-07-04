import { requireCathaNavAccessForRequestPath } from '@/lib/catha-auth'

export default async function CathaProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCathaNavAccessForRequestPath()
  return <>{children}</>
}
