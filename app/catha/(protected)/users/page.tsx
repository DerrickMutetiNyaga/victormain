import { requireSuperAdmin } from '@/lib/catha-auth'
import { getAllCathaUsers } from '@/lib/models/catha-user'
import { Header } from '@/components/layout/header'
import { CathaUsersClient } from './catha-users-client'

export default async function CathaUsersPage() {
  await requireSuperAdmin()
  const users = await getAllCathaUsers()
  const formatted = users.map((u) => ({
    id: u._id?.toString(),
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: u.role,
    status: u.status,
    permissions: u.permissions ?? [],
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
    lastLogin: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin.toISOString() : String(u.lastLogin)) : null,
  }))
  return (
    <>
      <Header title="User Management" />
      <div className="p-4 md:p-6">
        <CathaUsersClient initialUsers={formatted} />
      </div>
    </>
  )
}
