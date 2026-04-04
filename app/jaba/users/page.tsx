"use client"

import { useState, useMemo, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
} from "lucide-react"
import { toast } from "sonner"
import { UserPermissions, PagePermission } from "@/lib/models/user"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JabaUser {
  _id: string
  name: string
  email: string
  image?: string
  role?: 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
  status?: 'active' | 'inactive'
  permissions?: UserPermissions
  approved?: boolean
  createdAt: string
  lastLogin?: string
}

// Define all available pages for permissions with icons and colors
const availablePages = [
  { id: 'dashboard', name: 'Dashboard', path: '/jaba', icon: LayoutDashboard, color: 'emerald' },
  { id: 'batches', name: 'Batches', path: '/jaba/batches', icon: Package, color: 'blue' },
  { id: 'batches-add', name: 'Add Batch', path: '/jaba/batches/add', icon: Package, color: 'blue' },
  { id: 'packaging', name: 'Packaging', path: '/jaba/packaging-output', icon: Boxes, color: 'purple' },
  { id: 'packaging-add', name: 'Create Session', path: '/jaba/packaging-output/add', icon: Boxes, color: 'purple' },
  { id: 'raw-materials', name: 'Raw Materials', path: '/jaba/raw-materials', icon: Package, color: 'orange' },
  { id: 'raw-materials-add', name: 'Add Material', path: '/jaba/raw-materials/add', icon: Package, color: 'orange' },
  { id: 'qc-checklist', name: 'QC Checklist', path: '/jaba/qc/checklist', icon: ClipboardCheck, color: 'green' },
  { id: 'qc-results', name: 'QC Results', path: '/jaba/qc/results', icon: ClipboardCheck, color: 'green' },
  { id: 'distribution', name: 'Distribution', path: '/jaba/distribution', icon: Truck, color: 'indigo' },
  { id: 'distribution-create', name: 'Create Delivery Note', path: '/jaba/distribution/create', icon: FileText, color: 'indigo' },
  { id: 'dispatch', name: 'Dispatch Records', path: '/jaba/distribution/dispatch', icon: Truck, color: 'indigo' },
  { id: 'suppliers', name: 'Suppliers', path: '/jaba/suppliers', icon: Users, color: 'teal' },
  { id: 'suppliers-add', name: 'Add Supplier', path: '/jaba/suppliers/add', icon: Users, color: 'teal' },
  { id: 'distributors', name: 'Distributors', path: '/jaba/distributors', icon: Truck, color: 'cyan' },
  { id: 'distributors-add', name: 'Add Distributor', path: '/jaba/distributors/add', icon: Truck, color: 'cyan' },
  { id: 'storage-finished', name: 'Finished Goods', path: '/jaba/storage/finished', icon: Warehouse, color: 'amber' },
  { id: 'storage-movement', name: 'Stock Movement', path: '/jaba/storage/movement', icon: Warehouse, color: 'amber' },
  { id: 'reports-batches', name: 'Batch Reports', path: '/jaba/reports/batches', icon: FileBarChart, color: 'rose' },
  { id: 'reports-production', name: 'Production Reports', path: '/jaba/reports/production', icon: FileBarChart, color: 'rose' },
  { id: 'reports-materials', name: 'Material Usage', path: '/jaba/reports/materials', icon: FileBarChart, color: 'rose' },
  { id: 'reports-distribution', name: 'Distribution Reports', path: '/jaba/reports/distribution', icon: FileBarChart, color: 'rose' },
  { id: 'settings', name: 'Settings', path: '/jaba/settings', icon: Settings, color: 'slate' },
] as const

const ROLE_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "cashier_admin", label: "Cashier Admin" },
  { value: "manager_admin", label: "Manager Admin" },
  { value: "super_admin", label: "Super Admin" },
] as const

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const

// Permission groups for accordion
const PERMISSION_GROUPS = {
  Production: ['batches', 'batches-add', 'packaging', 'packaging-add', 'raw-materials', 'raw-materials-add'],
  Quality: ['qc-checklist', 'qc-results'],
  Distribution: ['distribution', 'distribution-create', 'dispatch', 'suppliers', 'suppliers-add', 'distributors', 'distributors-add'],
  Storage: ['storage-finished', 'storage-movement'],
  Reports: ['reports-batches', 'reports-production', 'reports-materials', 'reports-distribution'],
  System: ['dashboard', 'settings'],
} as const

// Role template definitions
function getCashierAdminTemplate(): UserPermissions {
  const permissions: UserPermissions = {}
  // Cashier: view + add/edit on basic operations
  const cashierPages = ['dashboard', 'batches', 'batches-add', 'packaging', 'packaging-add']
  cashierPages.forEach((pageId) => {
    permissions[pageId] = {
      view: true,
      add: ['batches-add', 'packaging-add'].includes(pageId),
      edit: ['batches', 'packaging'].includes(pageId),
      delete: false,
    }
  })
  return permissions
}

function getManagerAdminTemplate(): UserPermissions {
  const permissions: UserPermissions = {}
  // Manager: view + add/edit on most, limited delete
  const noDelete = ['settings', 'dashboard']
  availablePages.forEach((page) => {
    permissions[page.id] = {
      view: true,
      add: true,
      edit: true,
      delete: !noDelete.includes(page.id),
    }
  })
  return permissions
}

function getSuperAdminTemplate(): UserPermissions {
  const permissions: UserPermissions = {}
  // Super Admin: all permissions
  availablePages.forEach((page) => {
    permissions[page.id] = {
      view: true,
      add: true,
      edit: true,
      delete: true,
    }
  })
  return permissions
}

const ROLE_TEMPLATES = {
  cashier_admin: {
    label: "Cashier Admin",
    description: "Basic operations, create batches, limited edits",
    icon: ShoppingCart,
    template: getCashierAdminTemplate,
  },
  manager_admin: {
    label: "Manager Admin",
    description: "Manage production, distribution, view reports, etc",
    icon: Store,
    template: getManagerAdminTemplate,
  },
  super_admin: {
    label: "Super Admin",
    description: "Complete access + manage users & permissions",
    icon: Shield,
    template: getSuperAdminTemplate,
  },
} as const

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<JabaUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending")
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<JabaUser | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions>({})
  const [selectedRoleTemplate, setSelectedRoleTemplate] = useState<"cashier_admin" | "manager_admin" | "super_admin" | null>(null)
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingOperation, setUpdatingOperation] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const currentUserEmail = session?.user?.email?.toLowerCase() ?? null

  useEffect(() => {
    if (session?.user) {
      if (session.user.role !== 'super_admin') {
        router.push('/jaba')
        return
      }
      fetchUsers()
    }
  }, [session, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/jaba/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.role === "pending" || !u.approved)
  }, [users])

  const filteredUsers = useMemo(() => {
    const baseUsers = activeTab === "pending" ? pendingUsers : users
    return baseUsers.filter((user) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, pendingUsers, searchQuery, roleFilter, statusFilter, activeTab])

  const stats = useMemo(() => {
    return {
      total: users.length,
      pending: pendingUsers.length,
      admins: users.filter((u) => u.role === "cashier_admin" || u.role === "manager_admin" || u.role === "super_admin").length,
      inactive: users.filter((u) => u.status === "inactive").length,
    }
  }, [users, pendingUsers])

  const filteredStats = useMemo(() => {
    return {
      total: filteredUsers.length,
      pending: filteredUsers.filter((u) => u.role === "pending" || !u.approved).length,
      admins: filteredUsers.filter((u) => u.role === "cashier_admin" || u.role === "manager_admin" || u.role === "super_admin").length,
      inactive: filteredUsers.filter((u) => u.status === "inactive").length,
    }
  }, [filteredUsers])

  const handleApproveUser = (user: JabaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    setSelectedUser(user)
    setSelectedRoleTemplate(null)
    setShowAdvancedPermissions(false)
    setEditingPermissions({})
    setIsApproveModalOpen(true)
  }

  const handleOpenPermissions = (user: JabaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    if (user.role === "pending") return
    setSelectedUser(user)
    setEditingPermissions(
      user.role === "super_admin"
        ? getSuperAdminTemplate()
        : user.permissions || {}
    )
    setIsPermissionsModalOpen(true)
  }

  const handleRoleTemplateSelect = (template: "cashier_admin" | "manager_admin" | "super_admin") => {
    setSelectedRoleTemplate(template)
    const templateFn = ROLE_TEMPLATES[template].template
    setEditingPermissions(templateFn())
  }

  const handleApproveAndSave = async () => {
    if (!selectedUser || !selectedRoleTemplate) return
    setUpdating(selectedUser._id)
    try {
      // Update role
      const roleResponse = await fetch(`/api/jaba/users/${selectedUser._id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRoleTemplate }),
      })
      if (!roleResponse.ok) throw new Error('Failed to update role')

      // Update permissions if not super_admin
      if (selectedRoleTemplate !== 'super_admin') {
        const permResponse = await fetch(`/api/jaba/users/${selectedUser._id}/permissions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingPermissions),
        })
        if (!permResponse.ok) throw new Error('Failed to update permissions')
      }

      toast.success('User approved successfully')
      setIsApproveModalOpen(false)
      setSelectedUser(null)
      setSelectedRoleTemplate(null)
      await fetchUsers()
    } catch (error) {
      console.error('Error approving user:', error)
      toast.error('Failed to approve user')
    } finally {
      setUpdating(null)
    }
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return
    setUpdating(selectedUser._id)
    try {
      const response = await fetch(`/api/jaba/users/${selectedUser._id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPermissions),
      })
      if (!response.ok) throw new Error('Failed to update permissions')
      toast.success('Permissions updated successfully')
      setIsPermissionsModalOpen(false)
      setSelectedUser(null)
      await fetchUsers()
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Failed to update permissions')
    } finally {
      setUpdating(null)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'cashier_admin' | 'manager_admin' | 'super_admin' | 'pending') => {
    const operationKey = `${userId}-role`
    if (updatingOperation === operationKey) return
    setUpdating(userId)
    setUpdatingOperation(operationKey)
    try {
      const response = await fetch(`/api/jaba/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) throw new Error('Failed to update role')
      const updatedUser = await response.json()
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId ? { ...user, role: updatedUser.role } : user
        )
      )
      toast.success('Role updated successfully')
    } catch (error) {
      console.error('Error updating role:', error)
      fetchUsers()
      toast.error('Failed to update role')
    } finally {
      setUpdating(null)
      setUpdatingOperation(null)
    }
  }

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive') => {
    const operationKey = `${userId}-status`
    if (updatingOperation === operationKey) return
    setUpdating(userId)
    setUpdatingOperation(operationKey)
    try {
      const response = await fetch(`/api/jaba/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      const updatedUser = await response.json()
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId ? { ...user, status: updatedUser.status } : user
        )
      )
      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Error updating status:', error)
      fetchUsers()
      toast.error('Failed to update status')
    } finally {
      setUpdating(null)
      setUpdatingOperation(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    setUpdating(userId)
    try {
      const response = await fetch(`/api/jaba/users/${userId}`, { method: 'DELETE' })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete user')
      }
      toast.success('User deleted successfully')
      setDeleteConfirmId(null)
      await fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete user')
    } finally {
      setUpdating(null)
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "cashier_admin":
        return "Cashier Admin"
      case "manager_admin":
        return "Manager Admin"
      case "super_admin":
        return "Super Admin"
      case "pending":
        return "Pending"
      default:
        return role || "User"
    }
  }

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
      case "cashier_admin":
        return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
      case "manager_admin":
        return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusBadgeClass = (status?: string) => {
    return status === "active"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-stone-200 text-stone-700 border-stone-400 dark:bg-stone-800 dark:text-stone-400"
  }

  const formatDate = (s: string | null | undefined) => {
    if (!s) return "Never"
    try {
      const d = new Date(s)
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "—"
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
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Jaba users are separate from Catha. Approve pending users and assign permissions to admins.
          </p>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden max-w-[1600px] mx-auto">
        {/* Top Bar: Title + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage user access and permissions</p>
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

        {/* Stats Cards */}
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
                <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.inactive}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
                <UserX className="h-6 w-6 text-stone-600 dark:text-stone-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Row */}
        <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-4 px-4 md:px-6 border-b border-border/50">
            <div className="flex flex-col gap-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")} className="w-full">
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
                {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    onClick={() => {
                      setSearchQuery("")
                      setRoleFilter("all")
                      setStatusFilter("all")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Mobile: Stacked Cards with Sections */}
            <div className="md:hidden p-4 space-y-6">
              {(() => {
                const pendingUsers = filteredUsers.filter((u) => u.role === "pending" || !u.approved)
                const adminUsers = filteredUsers.filter(
                  (u) => (u.role === "cashier_admin" || u.role === "manager_admin" || u.role === "super_admin") && u.status === "active"
                )
                const regularUsers = filteredUsers.filter(
                  (u) => u.role !== "pending" && u.role !== "cashier_admin" && u.role !== "manager_admin" && u.role !== "super_admin" && u.status === "active"
                )
                const inactiveUsers = filteredUsers.filter((u) => u.status === "inactive")

                if (filteredUsers.length === 0) {
                  return (
                    <div className="py-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No users found</p>
                    </div>
                  )
                }

                return (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Pending Approval</h3>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{pendingUsers.length}</Badge>
                      </div>
                      {pendingUsers.length > 0 ? (
                        <div className="space-y-4">
                          {pendingUsers.map((user) => (
                            <UserCardMobile
                              key={user._id}
                              user={user}
                              currentUserEmail={currentUserEmail}
                              onApprove={() => handleApproveUser(user)}
                              onPermissions={() => handleOpenPermissions(user)}
                              onToggleStatus={() => handleStatusChange(user._id, user.status === "active" ? "inactive" : "active")}
                              onDelete={() => setDeleteConfirmId(user._id)}
                              formatDate={formatDate}
                              getRoleLabel={getRoleLabel}
                              getRoleBadgeClass={getRoleBadgeClass}
                              getStatusBadgeClass={getStatusBadgeClass}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No pending users</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Admins</h3>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{adminUsers.length}</Badge>
                      </div>
                      {adminUsers.length > 0 ? (
                        <div className="space-y-4">
                          {adminUsers.map((user) => (
                            <UserCardMobile
                              key={user._id}
                              user={user}
                              currentUserEmail={currentUserEmail}
                              onApprove={() => handleApproveUser(user)}
                              onPermissions={() => handleOpenPermissions(user)}
                              onToggleStatus={() => handleStatusChange(user._id, user.status === "active" ? "inactive" : "active")}
                              onDelete={() => setDeleteConfirmId(user._id)}
                              formatDate={formatDate}
                              getRoleLabel={getRoleLabel}
                              getRoleBadgeClass={getRoleBadgeClass}
                              getStatusBadgeClass={getStatusBadgeClass}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No admins</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Users</h3>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{regularUsers.length}</Badge>
                      </div>
                      {regularUsers.length > 0 ? (
                        <div className="space-y-4">
                          {regularUsers.map((user) => (
                            <UserCardMobile
                              key={user._id}
                              user={user}
                              currentUserEmail={currentUserEmail}
                              onApprove={() => handleApproveUser(user)}
                              onPermissions={() => handleOpenPermissions(user)}
                              onToggleStatus={() => handleStatusChange(user._id, user.status === "active" ? "inactive" : "active")}
                              onDelete={() => setDeleteConfirmId(user._id)}
                              formatDate={formatDate}
                              getRoleLabel={getRoleLabel}
                              getRoleBadgeClass={getRoleBadgeClass}
                              getStatusBadgeClass={getStatusBadgeClass}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No users</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Inactive</h3>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{inactiveUsers.length}</Badge>
                      </div>
                      {inactiveUsers.length > 0 ? (
                        <div className="space-y-4">
                          {inactiveUsers.map((user) => (
                            <UserCardMobile
                              key={user._id}
                              user={user}
                              currentUserEmail={currentUserEmail}
                              onApprove={() => handleApproveUser(user)}
                              onPermissions={() => handleOpenPermissions(user)}
                              onToggleStatus={() => handleStatusChange(user._id, user.status === "active" ? "inactive" : "active")}
                              onDelete={() => setDeleteConfirmId(user._id)}
                              formatDate={formatDate}
                              getRoleLabel={getRoleLabel}
                              getRoleBadgeClass={getRoleBadgeClass}
                              getStatusBadgeClass={getStatusBadgeClass}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No inactive users</p>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Desktop: Row Cards Table */}
            <div className="hidden md:block">
              <div className="divide-y divide-border/50">
                {filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No users found</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <UserRowCard
                      key={user._id}
                      user={user}
                      currentUserEmail={currentUserEmail}
                      onApprove={() => handleApproveUser(user)}
                      onPermissions={() => handleOpenPermissions(user)}
                      onRoleChange={(newRole) => handleRoleChange(user._id, newRole)}
                      onToggleStatus={() => handleStatusChange(user._id, user.status === "active" ? "inactive" : "active")}
                      onDelete={() => setDeleteConfirmId(user._id)}
                      formatDate={formatDate}
                      getRoleLabel={getRoleLabel}
                      getRoleBadgeClass={getRoleBadgeClass}
                      getStatusBadgeClass={getStatusBadgeClass}
                      updating={updating === user._id}
                    />
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approve User Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                Approve user
              </DialogTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsApproveModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedUser && (
              <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 rounded-xl shrink-0">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm md:text-base">
                      {selectedUser.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm md:text-base truncate">{selectedUser.name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <Shield className="h-4 w-4 inline mr-2" />
                As Super Admin, you assign which permissions each admin can access. Choose a role template, then customize permissions below.
              </p>
            </div>
            <div>
              <Label className="text-base font-semibold mb-3 block">Choose Role Template</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(ROLE_TEMPLATES).map(([key, template]) => {
                  const Icon = template.icon
                  const isSelected = selectedRoleTemplate === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleRoleTemplateSelect(key as "cashier_admin" | "manager_admin" | "super_admin")}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{template.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvancedPermissions(!showAdvancedPermissions)} className="h-8 gap-2">
                    {showAdvancedPermissions ? "Hide" : "Show"} Advanced
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedPermissions ? "rotate-180" : ""}`} />
                  </Button>
                </div>
                {showAdvancedPermissions && (
                  <PermissionsEditorAccordion
                    permissions={editingPermissions}
                    setPermissions={setEditingPermissions}
                    readOnly={selectedRoleTemplate === "super_admin"}
                    targetRole={selectedRoleTemplate ?? undefined}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)} className="rounded-xl h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleApproveAndSave} disabled={updating !== null || !selectedRoleTemplate} className="rounded-xl h-11 gap-2 w-full sm:w-auto">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve & Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 md:h-5 md:w-5" />
              <span className="truncate">Permissions — {selectedUser?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">Configure page access and actions for this user.</DialogDescription>
          </DialogHeader>
          <PermissionsEditorAccordion
            permissions={editingPermissions}
            setPermissions={setEditingPermissions}
            readOnly={selectedUser?.role === "super_admin"}
            targetRole={selectedUser?.role}
          />
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)} className="rounded-xl h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={updating !== null} className="rounded-xl h-11 gap-2 w-full sm:w-auto">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="rounded-xl h-11">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteUser(deleteConfirmId)} className="rounded-xl h-11">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Mobile User Card Component
function UserCardMobile({
  user,
  currentUserEmail,
  onApprove,
  onPermissions,
  onToggleStatus,
  onDelete,
  formatDate,
  getRoleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
}: {
  user: JabaUser
  currentUserEmail: string | null
  onApprove: () => void
  onPermissions: () => void
  onToggleStatus: () => void
  onDelete: () => void
  formatDate: (s: string | null | undefined) => string
  getRoleLabel: (role?: string) => string
  getRoleBadgeClass: (role?: string) => string
  getStatusBadgeClass: (status?: string) => string
}) {
  const isCurrentUser = currentUserEmail === user.email?.toLowerCase()
  const isPending = user.role === "pending"

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 rounded-xl border-2 border-border/50 shrink-0">
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
            {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
        </div>
        <Badge className={`text-[10px] rounded-lg border shrink-0 ${getStatusBadgeClass(user.status)}`}>
          {user.status === "active" ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 inline" /> : <XCircle className="h-2.5 w-2.5 mr-0.5 inline" />}
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
        <p className="text-[10px] text-muted-foreground">Last: {formatDate(user.lastLogin)}</p>
      </div>
      {!isCurrentUser && (
        <div className="flex gap-2 mt-3">
          {isPending ? (
            <Button onClick={onApprove} size="sm" className="flex-1 rounded-xl h-9 gap-1.5 text-xs">
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
          ) : (
            <Button onClick={onPermissions} variant="default" size="sm" className="flex-1 rounded-xl h-9 gap-1.5 text-xs">
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
                {user.status === "active" ? <UserX className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {user.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {isCurrentUser && (
        <div className="text-xs text-muted-foreground text-center py-2 mt-3">You cannot edit your own account</div>
      )}
    </div>
  )
}

// Desktop User Row Card Component
function UserRowCard({
  user,
  currentUserEmail,
  onApprove,
  onPermissions,
  onRoleChange,
  onToggleStatus,
  onDelete,
  formatDate,
  getRoleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
  updating,
}: {
  user: JabaUser
  currentUserEmail: string | null
  onApprove: () => void
  onPermissions: () => void
  onRoleChange: (role: 'cashier_admin' | 'manager_admin' | 'super_admin' | 'pending') => void
  onToggleStatus: () => void
  onDelete: () => void
  formatDate: (s: string | null | undefined) => string
  getRoleLabel: (role?: string) => string
  getRoleBadgeClass: (role?: string) => string
  getStatusBadgeClass: (status?: string) => string
  updating: boolean
}) {
  const isCurrentUser = currentUserEmail === user.email?.toLowerCase()

  return (
    <div className="p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 rounded-xl border-2 border-border/50 shrink-0">
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
              {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={user.role || 'pending'} onValueChange={onRoleChange} disabled={updating || isCurrentUser}>
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
          <Badge className={`rounded-lg border text-xs font-medium gap-1 ${getStatusBadgeClass(user.status)}`}>
            {user.status === "active" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {user.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isCurrentUser ? (
            <>
              {user.role === "pending" ? (
                <Button variant="default" size="sm" onClick={onApprove} className="rounded-xl h-9 gap-1.5 text-xs">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onPermissions} className="rounded-xl h-9 gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  Permissions
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onToggleStatus} title={user.status === "active" ? "Deactivate" : "Activate"}>
                {user.status === "active" ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">You</span>
          )}
        </div>
      </div>
    </div>
  )
}

// Permissions Editor with Accordion - readOnly for SUPER_ADMIN (locked), disabled for USER/pending
function PermissionsEditorAccordion({
  permissions,
  setPermissions,
  readOnly = false,
  targetRole,
}: {
  permissions: UserPermissions
  setPermissions: React.Dispatch<React.SetStateAction<UserPermissions>> | ((p: UserPermissions) => void)
  readOnly?: boolean
  targetRole?: string
}) {
  const isSuperAdmin = targetRole === 'super_admin'
  const isUserOrPending = targetRole === 'pending'
  const showLocked = isSuperAdmin

  const updatePermission = (pageId: string, action: 'view' | 'add' | 'edit' | 'delete', value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [pageId]: {
        ...(prev[pageId] || { view: false, add: false, edit: false, delete: false }),
        [action]: value,
      },
    }))
  }

  return (
    <div className="space-y-3">
      {showLocked && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs md:text-sm text-amber-800 dark:text-amber-300">
            <Shield className="h-3 w-3 md:h-4 md:w-4 inline mr-2" />
            Super Admin has full access to all pages. Permissions are locked and cannot be changed.
          </p>
        </div>
      )}
      {isUserOrPending && (
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
          <p className="text-xs md:text-sm text-stone-600 dark:text-stone-400">
            Users without admin role do not have page permissions. Approve the user and assign an admin role first.
          </p>
        </div>
      )}
      <Accordion type="multiple" className="w-full">
        {Object.entries(PERMISSION_GROUPS).map(([groupName, pageIds]) => {
          const groupPages = availablePages.filter((page) => pageIds.includes(page.id as any))
          if (groupPages.length === 0) return null

          return (
            <AccordionItem key={groupName} value={groupName} className="border-border">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {groupName}
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-2">
                {groupPages.map((page) => {
                  const pagePerms = permissions[page.id] || { view: false, add: false, edit: false, delete: false }
                  const PageIcon = page.icon
                  return (
                    <div key={page.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/20">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <PageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{page.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {(['view', 'add', 'edit', 'delete'] as const).map((action) => (
                          <div key={action} className="flex items-center gap-1.5">
                            <Checkbox
                              checked={pagePerms[action]}
                              disabled={readOnly || isUserOrPending || (action !== 'view' && !pagePerms.view)}
                              onCheckedChange={(checked) => updatePermission(page.id, action, !!checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-[10px] text-muted-foreground uppercase w-12 text-right">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
