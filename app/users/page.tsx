"use client"

import { useState, useMemo, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
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
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
  X,
  UserPlus,
  KeyRound,
} from "lucide-react"

// Define all pages from navigation
const allPages = [
  { id: "dashboard", name: "Dashboard", path: "/" },
  { id: "pos", name: "POS Sales", path: "/pos" },
  { id: "inventory", name: "Inventory", path: "/inventory" },
  { id: "suppliers", name: "Suppliers", path: "/suppliers" },
  { id: "stock-movement", name: "Stock Movement", path: "/stock-movement" },
  { id: "orders", name: "Orders", path: "/orders" },
  { id: "mpesa", name: "M-Pesa", path: "/mpesa" },
  { id: "expenses", name: "Expenses", path: "/expenses" },
  { id: "clients", name: "Clients", path: "/clients" },
  { id: "users", name: "User Management", path: "/users" },
  { id: "distributor-requests", name: "Distributor Requests", path: "/distributor-requests" },
  { id: "reports", name: "Reports", path: "/reports" },
  { id: "settings", name: "Settings", path: "/settings" },
]

export interface User {
  id: string
  name: string
  username: string
  email: string
  role: "admin" | "manager" | "cashier" | "waiter"
  status: "active" | "inactive"
  avatar?: string
  permissions: {
    [pageId: string]: {
      view: boolean
      edit: boolean
      delete: boolean
    }
  }
  createdAt: Date
  lastLogin?: Date
}

const defaultUsers: User[] = [
  {
    id: "1",
    name: "Marcus Johnson",
    username: "marcus",
    email: "marcus@example.com",
    role: "admin",
    status: "active",
    createdAt: new Date("2024-01-15"),
    lastLogin: new Date(),
    permissions: allPages.reduce((acc, page) => {
      acc[page.id] = { view: true, edit: true, delete: true }
      return acc
    }, {} as any),
  },
  {
    id: "2",
    name: "Jane Doe",
    username: "jane",
    email: "jane@example.com",
    role: "manager",
    status: "active",
    createdAt: new Date("2024-02-20"),
    lastLogin: new Date(Date.now() - 86400000),
    permissions: {
      dashboard: { view: true, edit: false, delete: false },
      pos: { view: true, edit: true, delete: false },
      inventory: { view: true, edit: true, delete: false },
      suppliers: { view: true, edit: true, delete: false },
      "stock-movement": { view: true, edit: true, delete: false },
      orders: { view: true, edit: true, delete: false },
      mpesa: { view: true, edit: false, delete: false },
      expenses: { view: true, edit: true, delete: false },
      clients: { view: true, edit: true, delete: false },
      users: { view: true, edit: false, delete: false },
      "distributor-requests": { view: true, edit: true, delete: false },
      reports: { view: true, edit: false, delete: false },
      settings: { view: false, edit: false, delete: false },
    },
  },
  {
    id: "3",
    name: "Kelvin Barista",
    username: "kelvin",
    email: "kelvin@example.com",
    role: "waiter",
    status: "active",
    createdAt: new Date("2024-03-10"),
    lastLogin: new Date(Date.now() - 172800000),
    permissions: {
      dashboard: { view: true, edit: false, delete: false },
      pos: { view: true, edit: true, delete: false },
      inventory: { view: false, edit: false, delete: false },
      suppliers: { view: false, edit: false, delete: false },
      "stock-movement": { view: false, edit: false, delete: false },
      orders: { view: true, edit: true, delete: false },
      mpesa: { view: false, edit: false, delete: false },
      expenses: { view: false, edit: false, delete: false },
      clients: { view: true, edit: false, delete: false },
      users: { view: false, edit: false, delete: false },
      "distributor-requests": { view: false, edit: false, delete: false },
      reports: { view: false, edit: false, delete: false },
      settings: { view: false, edit: false, delete: false },
    },
  },
]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("users")
      if (saved) return JSON.parse(saved).map((u: any) => ({ ...u, createdAt: new Date(u.createdAt), lastLogin: u.lastLogin ? new Date(u.lastLogin) : undefined }))
    }
    return defaultUsers
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | User["role"]>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | User["status"]>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<Partial<User>>({})
  const [editingPermissions, setEditingPermissions] = useState<{ [pageId: string]: { view: boolean; edit: boolean; delete: boolean } }>({})

  // Save to localStorage whenever users change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("users", JSON.stringify(users))
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.username.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const handleAddUser = () => {
    setEditingUser({
      name: "",
      username: "",
      email: "",
      role: "waiter",
      status: "active",
      permissions: allPages.reduce((acc, page) => {
        acc[page.id] = { view: false, edit: false, delete: false }
        return acc
      }, {} as any),
    })
    setIsAddModalOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user })
    setIsEditModalOpen(true)
  }

  const handleViewPermissions = (user: User) => {
    setSelectedUser(user)
    setEditingPermissions({ ...user.permissions })
    setIsPermissionsModalOpen(true)
  }

  const handleSaveUser = () => {
    if (!editingUser.name || !editingUser.username || !editingUser.email) return

    if (isAddModalOpen) {
      const newUser: User = {
        id: Date.now().toString(),
        name: editingUser.name!,
        username: editingUser.username!,
        email: editingUser.email!,
        role: editingUser.role || "waiter",
        status: editingUser.status || "active",
        permissions: editingUser.permissions || allPages.reduce((acc, page) => {
          acc[page.id] = { view: false, edit: false, delete: false }
          return acc
        }, {} as any),
        createdAt: new Date(),
      }
      setUsers([...users, newUser])
      setIsAddModalOpen(false)
    } else {
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...editingUser } : u)))
      setIsEditModalOpen(false)
    }
    setEditingUser({})
    if (typeof window !== "undefined") {
      localStorage.setItem("users", JSON.stringify(users))
    }
  }

  const handleSavePermissions = () => {
    if (!selectedUser) return
    setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, permissions: editingPermissions } : u)))
    setIsPermissionsModalOpen(false)
    setSelectedUser(null)
    setEditingPermissions({})
    if (typeof window !== "undefined") {
      localStorage.setItem("users", JSON.stringify(users))
    }
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== userId))
      if (typeof window !== "undefined") {
        localStorage.setItem("users", JSON.stringify(users))
      }
    }
  }

  const handleToggleStatus = (userId: string) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u)))
    if (typeof window !== "undefined") {
      localStorage.setItem("users", JSON.stringify(users))
    }
  }

  const getRoleBadgeColor = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-300"
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "cashier":
        return "bg-green-100 text-green-800 border-green-300"
      case "waiter":
        return "bg-amber-100 text-amber-800 border-amber-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusBadgeColor = (status: User["status"]) => {
    return status === "active" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-800 border-gray-300"
  }

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      admins: users.filter((u) => u.role === "admin").length,
      managers: users.filter((u) => u.role === "manager").length,
    }
  }, [users])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="User Management" subtitle="Manage users, roles, and permissions" />

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.active}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Admins</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.admins}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Managers</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.managers}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Card */}
          <Card className="border-border/60 bg-gradient-to-br from-white via-white to-blue-50/30 shadow-lg rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">User Accounts</CardTitle>
                  <CardDescription className="mt-1">Manage staff accounts, roles, and access permissions</CardDescription>
                </div>
                <Button onClick={handleAddUser} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm">
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-border/70 bg-background/60"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border/70 bg-background/60">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border/70 bg-background/60">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/40">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">User</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Role</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Status</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Last Login</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Permissions</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-border/50">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                                  {user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-sm text-foreground">{user.name}</div>
                                <div className="text-xs text-muted-foreground">@{user.username}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getRoleBadgeColor(user.role)} border text-xs font-medium capitalize`}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusBadgeColor(user.status)} border text-xs font-medium capitalize`}>
                              {user.status === "active" ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Inactive
                                </span>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              {user.lastLogin ? (
                                <>
                                  {user.lastLogin.toLocaleDateString()}
                                  <br />
                                  <span className="text-[10px]">{user.lastLogin.toLocaleTimeString()}</span>
                                </>
                              ) : (
                                "Never"
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPermissions(user)}
                              className="gap-1.5 text-xs rounded-lg border-border/70 hover:bg-primary/10 hover:border-primary/50"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Manage
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(user.id)}
                                className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                {user.status === "active" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

        {/* Add User Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add New User</DialogTitle>
              <DialogDescription>Create a new user account with role and permissions</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="John Doe"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={editingUser.username || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  placeholder="johndoe"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="john@example.com"
                  className="rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={editingUser.role || "waiter"}
                    onValueChange={(v) => setEditingUser({ ...editingUser, role: v as User["role"] })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="waiter">Waiter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editingUser.status || "active"}
                    onValueChange={(v) => setEditingUser({ ...editingUser, status: v as User["status"] })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button onClick={handleSaveUser} className="rounded-lg bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit User</DialogTitle>
              <DialogDescription>Update user information and role</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="John Doe"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editingUser.username || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  placeholder="johndoe"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="john@example.com"
                  className="rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={editingUser.role || "waiter"}
                    onValueChange={(v) => setEditingUser({ ...editingUser, role: v as User["role"] })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="waiter">Waiter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingUser.status || "active"}
                    onValueChange={(v) => setEditingUser({ ...editingUser, status: v as User["status"] })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button onClick={handleSaveUser} className="rounded-lg bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Modal */}
        <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Manage Permissions - {selectedUser?.name}
              </DialogTitle>
              <DialogDescription>Configure page access and actions for this user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center pb-2 border-b border-border/50">
                    <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Page</div>
                    <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground text-center">View</div>
                    <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground text-center">Edit</div>
                    <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground text-center">Delete</div>
                  </div>
                  {allPages.map((page) => (
                    <div key={page.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center py-2 border-b border-border/30 last:border-0">
                      <div className="font-medium text-sm text-foreground">{page.name}</div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={editingPermissions[page.id]?.view || false}
                          onCheckedChange={(checked) => {
                            setEditingPermissions({
                              ...editingPermissions,
                              [page.id]: {
                                ...editingPermissions[page.id],
                                view: checked as boolean,
                              },
                            })
                          }}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={editingPermissions[page.id]?.edit || false}
                          onCheckedChange={(checked) => {
                            setEditingPermissions({
                              ...editingPermissions,
                              [page.id]: {
                                ...editingPermissions[page.id],
                                edit: checked as boolean,
                              },
                            })
                          }}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={editingPermissions[page.id]?.delete || false}
                          onCheckedChange={(checked) => {
                            setEditingPermissions({
                              ...editingPermissions,
                              [page.id]: {
                                ...editingPermissions[page.id],
                                delete: checked as boolean,
                              },
                            })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} className="rounded-lg bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4 mr-2" />
                Save Permissions
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
