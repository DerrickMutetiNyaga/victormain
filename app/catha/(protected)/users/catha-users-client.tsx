'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Save,
  UserPlus,
  Loader2,
  Clock,
  UserX,
  CheckCircle,
  X,
  Settings,
  ShoppingCart,
  Store,
  ChevronDown,
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardCheck,
  FileText,
  Truck,
  Warehouse,
  FileBarChart,
  UserCheck,
  KeyRound as KeyIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CathaPermissions,
  PermissionActions,
  ROLE_TEMPLATES,
  normalizePermissions,
  normalizePermissionActions,
} from '@/lib/catha-permissions-model'

type CathaUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'PENDING'
type CathaUserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED'

type CathaUser = {
  id?: string
  email: string
  name: string
  image: string | null
  role: CathaUserRole
  status: CathaUserStatus
  permissions: CathaPermissions
  createdAt: string
  lastLogin: string | null
  hasPin?: boolean
}

const ROLE_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
] as const

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
] as const

const ROLE_META: Record<
  Exclude<CathaUserRole, 'PENDING'>,
  {
    label: string
    description: string
    icon: typeof ShoppingCart
  }
> = {
  CASHIER: {
    label: 'Cashier',
    description: 'POS only access, minimal backoffice',
    icon: ShoppingCart,
  },
  ADMIN: {
    label: 'Admin',
    description: 'Manage daily operations, inventory, and reports',
    icon: Store,
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Full access including user management',
    icon: Shield,
  },
}

type UserRow = {
  id: string | undefined
  email: string
  name: string
  image: string | null
  role: string
  status: string
  permissions: CathaPermissions
  createdAt: string
  lastLogin: string | null
}

export function CathaUsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<CathaUser[]>(
    initialUsers.map((u) => ({
      ...u,
      role: (u.role || 'PENDING').toUpperCase() as CathaUserRole,
      status: (u.status || 'PENDING').toUpperCase() as CathaUserStatus,
    }))
  )
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<CathaUser | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<CathaPermissions>({})
  const [selectedRoleTemplate, setSelectedRoleTemplate] = useState<'CASHIER' | 'ADMIN' | 'SUPER_ADMIN' | null>(null)
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingOperation, setUpdatingOperation] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [pinDialogUser, setPinDialogUser] = useState<CathaUser | null>(null)
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/catha/users')
        const data = await res.json()
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to fetch users')
        }
        const list: UserRow[] = data.users ?? data?.users ?? []
        setUsers(
          list.map((u) => ({
            ...u,
            role: (u.role || 'PENDING').toUpperCase() as CathaUserRole,
            status: (u.status || 'PENDING').toUpperCase() as CathaUserStatus,
            permissions: normalizePermissions(u.permissions),
            hasPin: !!(u as any).pinLookup,
          }))
        )
      } catch (e: any) {
        console.error('Error fetching Catha users:', e)
        toast.error(e?.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === 'PENDING'),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const baseUsers = activeTab === 'pending' ? pendingUsers : users
    const q = searchQuery.toLowerCase()
    return baseUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, pendingUsers, searchQuery, roleFilter, statusFilter, activeTab])

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: pendingUsers.length,
      admins: users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
      inactive: users.filter((u) => u.status === 'DISABLED').length,
    }),
    [users, pendingUsers]
  )

  const formatDate = (s: string | null | undefined) => {
    if (!s) return 'Never'
    try {
      const d = new Date(s)
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  const getRoleLabel = (role?: string) => {
    switch ((role || '').toUpperCase()) {
      case 'SUPER_ADMIN':
        return 'Super Admin'
      case 'ADMIN':
        return 'Admin'
      case 'CASHIER':
        return 'Cashier'
      case 'PENDING':
        return 'Pending'
      default:
        return role || 'User'
    }
  }

  const getRoleBadgeClass = (role?: string) => {
    switch ((role || '').toUpperCase()) {
      case 'SUPER_ADMIN':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
      case 'CASHIER':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusBadgeClass = (status?: string) =>
    (status || '').toUpperCase() === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-stone-200 text-stone-700 border-stone-400 dark:bg-stone-800 dark:text-stone-400'

  async function patchUser(email: string, updates: Partial<Pick<CathaUser, 'role' | 'status' | 'permissions'>>) {
    setUpdating(email)
    try {
      const res = await fetch('/api/catha/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...updates }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Update failed')
      }
      const updated = data.user as UserRow
      setUsers((prev) =>
        prev.map((u) =>
          u.email === email
            ? {
                ...u,
                role: (updated.role || u.role) as CathaUserRole,
                status: (updated.status || u.status) as CathaUserStatus,
                permissions: normalizePermissions(updated.permissions),
              }
            : u
        )
      )
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Update failed')
    } finally {
      setUpdating(null)
      setUpdatingOperation(null)
    }
  }

  const handleApproveUser = (user: CathaUser) => {
    setSelectedUser(user)
    setSelectedRoleTemplate(null)
    setShowAdvancedPermissions(false)
    setEditingPermissions(normalizePermissions(user.permissions))
    setIsApproveModalOpen(true)
  }

  const handleOpenPermissions = (user: CathaUser) => {
    if (user.role === 'PENDING') return
    setSelectedUser(user)
    // For SUPER_ADMIN, always show full template; for others, use stored permissions.
    const base =
      user.role === 'SUPER_ADMIN'
        ? normalizePermissions(ROLE_TEMPLATES.SUPER_ADMIN)
        : normalizePermissions(user.permissions)
    setEditingPermissions(base)
    setIsPermissionsModalOpen(true)
  }

  const handleRoleTemplateSelect = (template: 'CASHIER' | 'ADMIN' | 'SUPER_ADMIN') => {
    setSelectedRoleTemplate(template)
    setEditingPermissions(normalizePermissions(ROLE_TEMPLATES[template]))
  }

  const handleApproveAndSave = async () => {
    if (!selectedUser || !selectedRoleTemplate) return
    setUpdating(selectedUser.email)
    try {
      await patchUser(selectedUser.email, {
        role: selectedRoleTemplate,
        status: 'ACTIVE',
        permissions: editingPermissions,
      })
      toast.success('User approved successfully')
      setIsApproveModalOpen(false)
      setSelectedUser(null)
      setSelectedRoleTemplate(null)
    } catch (e) {
      // errors already toasted
    } finally {
      setUpdating(null)
    }
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return
    setUpdating(selectedUser.email)
    try {
      await patchUser(selectedUser.email, { permissions: editingPermissions })
      toast.success('Permissions updated successfully')
      setIsPermissionsModalOpen(false)
      setSelectedUser(null)
    } catch (e) {
      // already toasted
    } finally {
      setUpdating(null)
    }
  }

  const handleRoleChange = async (
    email: string,
    newRole: CathaUserRole
  ) => {
    const opKey = `${email}-role`
    if (updatingOperation === opKey) return
    setUpdatingOperation(opKey)
    const templatePermissions =
      newRole === 'PENDING' ? {} : normalizePermissions(ROLE_TEMPLATES[newRole as Exclude<CathaUserRole, 'PENDING'>])
    await patchUser(email, { role: newRole, permissions: templatePermissions })
    toast.success('Role updated successfully')
  }

  const handleStatusChange = async (email: string, newStatus: CathaUserStatus) => {
    const opKey = `${email}-status`
    if (updatingOperation === opKey) return
    setUpdatingOperation(opKey)
    await patchUser(email, { status: newStatus })
    toast.success('Status updated successfully')
  }

  const handleDeleteUser = async (user: CathaUser) => {
    if (!user.id) {
      toast.error('Missing user id')
      return
    }
    setUpdating(user.email)
    try {
      const res = await fetch(`/api/catha/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete user')
      }
      setUsers((prev) => prev.filter((u) => u.email !== user.email))
      toast.success('User deleted')
      setDeleteConfirmId(null)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to delete user')
    } finally {
      setUpdating(null)
    }
  }

  const openPinDialog = (user: CathaUser) => {
    setPinDialogUser(user)
    setPinValue('')
    setPinError(null)
  }

  const handlePinChange = (value: string) => {
    const numeric = value.replace(/\D/g, '').slice(0, 4)
    setPinValue(numeric)
    setPinError(null)
  }

  const submitPin = async (remove = false) => {
    if (!pinDialogUser?.id) {
      setPinError('Missing user id')
      return
    }
    if (!remove) {
      if (!/^\d{4}$/.test(pinValue)) {
        setPinError('PIN must be exactly 4 digits')
        return
      }
    }
    setPinSubmitting(true)
    try {
      const res = await fetch(`/api/catha/users/${pinDialogUser.id}/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: remove ? '' : pinValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        const msg: string = data?.error || (remove ? 'Failed to remove PIN' : 'Failed to set PIN')
        if (msg.includes('exactly 4 digits')) {
          setPinError('PIN must be exactly 4 digits')
        } else if (msg.includes('already in use')) {
          setPinError('This PIN is already in use')
        } else {
          setPinError(msg)
        }
        return
      }
      toast.success(remove ? 'PIN removed' : 'PIN updated')
      setUsers((prev) =>
        prev.map((u) =>
          u.email === pinDialogUser.email ? { ...u, hasPin: !remove } : u
        )
      )
      setPinDialogUser(null)
      setPinValue('')
      setPinError(null)
    } catch (e: any) {
      console.error(e)
      setPinError(remove ? 'Failed to remove PIN' : 'Failed to set PIN')
    } finally {
      setPinSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage Catha lounge staff access, roles, and permissions.
          </p>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage Catha user access and permissions
            </p>
          </div>
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl border-border bg-background"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden border-amber-300 dark:border-amber-700">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.pending}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.admins}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.inactive}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
                <UserX className="h-6 w-6 text-stone-600 dark:text-stone-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-4 px-4 md:px-6 border-b border-border/50">
            <div className="flex flex-col gap-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'all')} className="w-full">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="pending" className="gap-2">
                    <Clock className="h-4 w-4" />
                    Pending ({stats.pending})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="gap-2">
                    <Users className="h-4 w-4" />
                    All Users
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-border">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-border">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    onClick={() => {
                      setSearchQuery('')
                      setRoleFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="md:hidden p-4 space-y-6">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <UserCardMobile
                    key={user.email}
                    user={user}
                    onApprove={() => handleApproveUser(user)}
                    onPermissions={() => handleOpenPermissions(user)}
                    onToggleStatus={() =>
                      handleStatusChange(
                        user.email,
                        user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                      )
                    }
                    onDelete={() => setDeleteConfirmId(user.email)}
                    formatDate={formatDate}
                    getRoleLabel={getRoleLabel}
                    getRoleBadgeClass={getRoleBadgeClass}
                    getStatusBadgeClass={getStatusBadgeClass}
                  />
                ))
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No users found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.email}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-xl border-2 border-border/50 shrink-0">
                              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
                                {user.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {user.name || user.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user.email, value as CathaUserRole)
                            }
                            disabled={updating === user.email}
                          >
                            <SelectTrigger className="w-[150px] h-9 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-lg border text-xs font-medium gap-1 ${getStatusBadgeClass(
                              user.status
                            )}`}
                          >
                            {user.status === 'ACTIVE' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.lastLogin)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.status !== 'ACTIVE' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user.email, 'ACTIVE')}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Approve / Activate
                                </DropdownMenuItem>
                              )}
                              {user.status !== 'DISABLED' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user.email, 'DISABLED')}
                                >
                                  <UserX className="h-4 w-4 mr-2" />
                                  Disable
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenPermissions(user)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Edit permissions
                              </DropdownMenuItem>
                              {user.role === 'CASHIER' && (
                                <DropdownMenuItem onClick={() => openPinDialog(user)}>
                                  <KeyIcon className="h-4 w-4 mr-2" />
                                  {user.hasPin ? 'Update cashier PIN' : 'Set cashier PIN'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteConfirmId(user.email)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                Approve user
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setIsApproveModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedUser && (
              <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 rounded-xl shrink-0">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm md:text-base">
                      {selectedUser.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm md:text-base truncate">
                      {selectedUser.name}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <Shield className="h-4 w-4 inline mr-2" />
                Assign a role and permissions for this Catha user before activating their account.
              </p>
            </div>
            <div>
              <Label className="text-base font-semibold mb-3 block">Choose Role Template</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['CASHIER', 'ADMIN', 'SUPER_ADMIN'] as const).map((key) => {
                  const template = ROLE_META[key]
                  const Icon = template.icon
                  const isSelected = selectedRoleTemplate === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleRoleTemplateSelect(key)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? 'bg-primary/10' : 'bg-muted'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              isSelected ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">
                            {template.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        </div>
                        {isSelected && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedRoleTemplate && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Customize Permissions</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedPermissions(!showAdvancedPermissions)}
                    className="h-8 gap-2"
                  >
                    {showAdvancedPermissions ? 'Hide' : 'Show'} Permissions
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showAdvancedPermissions ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </div>
                {showAdvancedPermissions && (
                  <PermissionsList
                    permissions={editingPermissions}
                    setPermissions={setEditingPermissions}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setIsApproveModalOpen(false)}
              className="rounded-xl h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveAndSave}
              disabled={updating !== null || !selectedRoleTemplate}
              className="rounded-xl h-11 gap-2 w-full sm:w-auto"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve & Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 md:h-5 md:w-5" />
              <span className="truncate">Permissions — {selectedUser?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure Catha permissions for this user.
            </DialogDescription>
          </DialogHeader>
          <PermissionsList permissions={editingPermissions} setPermissions={setEditingPermissions} />
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setIsPermissionsModalOpen(false)}
              className="rounded-xl h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={updating !== null}
              className="rounded-xl h-11 gap-2 w-full sm:w-auto"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-xl h-11"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const u = users.find((x) => x.email === deleteConfirmId)
                if (u) handleDeleteUser(u)
              }}
              className="rounded-xl h-11"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pinDialogUser} onOpenChange={() => setPinDialogUser(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pinDialogUser?.hasPin ? 'Update cashier PIN' : 'Set cashier PIN'}
            </DialogTitle>
            <DialogDescription>
              PIN must be exactly 4 digits and unique for each Catha cashier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-medium">Cashier</Label>
              <p className="text-sm text-foreground">
                {pinDialogUser?.name}{' '}
                <span className="text-xs text-muted-foreground">({pinDialogUser?.email})</span>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">PIN</Label>
              <Input
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                autoComplete="one-time-code"
                className="h-11 text-center text-xl tracking-[0.35em] caret-transparent"
                value={pinValue}
                onChange={(e) => handlePinChange(e.target.value)}
              />
              {pinError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {pinError}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-4">
            {pinDialogUser?.hasPin && (
              <Button
                type="button"
                variant="outline"
                disabled={pinSubmitting}
                onClick={() => submitPin(true)}
                className="rounded-xl h-10"
              >
                Remove PIN
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPinDialogUser(null)}
                className="rounded-xl h-10"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pinSubmitting}
                onClick={() => submitPin(false)}
                className="rounded-xl h-10"
              >
                {pinSubmitting ? 'Saving…' : 'Save PIN'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function UserCardMobile({
  user,
  onApprove,
  onPermissions,
  onToggleStatus,
  onDelete,
  formatDate,
  getRoleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
}: {
  user: CathaUser
  onApprove: () => void
  onPermissions: () => void
  onToggleStatus: () => void
  onDelete: () => void
  formatDate: (s: string | null | undefined) => string
  getRoleLabel: (role?: string) => string
  getRoleBadgeClass: (role?: string) => string
  getStatusBadgeClass: (status?: string) => string
}) {
  const isPending = user.status === 'PENDING'

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 rounded-xl border-2 border-border/50 shrink-0">
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
        </div>
        <Badge
          className={`text-[10px] rounded-lg border shrink-0 ${getStatusBadgeClass(
            user.status
          )}`}
        >
          {user.status === 'ACTIVE' ? (
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 inline" />
          ) : (
            <XCircle className="h-2.5 w-2.5 mr-0.5 inline" />
          )}
          {user.status}
        </Badge>
      </div>
      <div className="border-t border-border/50 my-3" />
      <div className="mt-3">
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <div className="flex items-center justify-between mt-3">
        <Badge className={`text-[10px] rounded-lg border ${getRoleBadgeClass(user.role)}`}>
          {getRoleLabel(user.role)}
        </Badge>
        <p className="text-[10px] text-muted-foreground">
          Last: {formatDate(user.lastLogin)}
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        {isPending ? (
          <Button
            onClick={onApprove}
            size="sm"
            className="flex-1 rounded-xl h-9 gap-1.5 text-xs"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </Button>
        ) : (
          <Button
            onClick={onPermissions}
            variant="default"
            size="sm"
            className="flex-1 rounded-xl h-9 gap-1.5 text-xs"
          >
            <Shield className="h-3.5 w-3.5" />
            Manage Permissions
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleStatus}>
              {user.status === 'ACTIVE' ? (
                <UserX className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {user.status === 'ACTIVE' ? 'Disable' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

const PERMISSION_GROUPS: {
  name: string
  modules: (keyof CathaPermissions)[]
}[] = [
  { name: 'System', modules: ['dashboard', 'users', 'settings', 'reports'] },
  { name: 'Sales & POS', modules: ['pos', 'orders'] },
  { name: 'Operations', modules: ['tables', 'tableQrCodes'] },
  { name: 'Inventory', modules: ['inventory', 'suppliers', 'stockMovement'] },
  { name: 'Financial', modules: ['mpesa', 'expenses'] },
  { name: 'Management', modules: ['clients', 'distributorRequests'] },
]

const MODULE_LABELS: Record<keyof CathaPermissions, string> = {
  dashboard: 'Dashboard',
  users: 'User Management',
  pos: 'POS Sales',
  orders: 'Orders',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  stockMovement: 'Stock Movement',
  mpesa: 'M-Pesa Transactions',
  expenses: 'Expenses',
  clients: 'Clients',
  tables: 'Tables',
  tableQrCodes: 'Table QR Codes',
  distributorRequests: 'Distributor Requests',
  reports: 'Reports',
  settings: 'Settings',
}

function PermissionsList({
  permissions,
  setPermissions,
}: {
  permissions: CathaPermissions
  setPermissions: (p: CathaPermissions) => void
}) {
  const normalized = normalizePermissions(permissions)

  const updateModuleAction = (module: keyof CathaPermissions, action: keyof PermissionActions, checked: boolean) => {
    const current = normalized[module] ?? { view: false, add: false, edit: false, delete: false }
    const next: PermissionActions = { ...current, [action]: checked }
    const final = normalizePermissionActions(next)
    const updated: CathaPermissions = { ...normalized, [module]: final }
    setPermissions(updated)
  }

  const renderRow = (module: keyof CathaPermissions) => {
    const state: PermissionActions = normalized[module] ?? { view: false, add: false, edit: false, delete: false }
    const label = MODULE_LABELS[module]
    return (
      <div
        key={module}
        className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/20"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {(['view', 'add', 'edit', 'delete'] as const).map((action) => (
            <div key={action} className="flex items-center gap-1.5">
              <Checkbox
                checked={state[action]}
                disabled={action !== 'view' && !state.view}
                onCheckedChange={(c) => updateModuleAction(module, action, c === true)}
                className="h-5 w-5 rounded-md border-2 border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 shadow-sm"
              />
              <span className="text-[10px] text-muted-foreground uppercase w-10 text-right">
                {action}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Accordion type="multiple" className="w-full">
      {PERMISSION_GROUPS.map((group) => (
        <AccordionItem key={group.name} value={group.name} className="border-border">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            {group.name}
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-2">
            {group.modules.map((m) => renderRow(m))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

