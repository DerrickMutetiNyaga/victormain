"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  Wallet2,
  Plus,
  Search,
  Filter,
  TrendingDown,
  Calendar,
  DollarSign,
  Building2,
  CreditCard,
  Banknote,
  Smartphone,
  Download,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"

export interface Expense {
  id: string
  _id?: string
  date: string | Date
  category: string
  vendor: string
  amount: number
  method: "cash" | "bank" | "mpesa" | "card"
  description?: string
  receipt?: string
}

export default function ExpensesPage() {
  const { canAdd, canEdit, canDelete } = useCathaPermissions("expenses")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState<"all" | Expense["method"]>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "",
    vendor: "",
    amount: "",
    method: "" as Expense["method"] | "",
    description: "",
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/catha/expenses')
      
      if (!response.ok) {
        throw new Error('Failed to fetch expenses')
      }

      const data = await response.json()
      if (data.success) {
        setExpenses(data.expenses || [])
      } else {
        throw new Error(data.error || 'Failed to fetch expenses')
      }
    } catch (err: any) {
      console.error('Error fetching expenses:', err)
      setError(err.message || 'Failed to load expenses')
      toast.error('Failed to load expenses', {
        description: err.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const expDate = typeof exp.date === 'string' ? new Date(exp.date) : exp.date
      const matchesSearch =
        exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "all" || exp.category === categoryFilter
      const matchesMethod = methodFilter === "all" || exp.method === methodFilter
      return matchesSearch && matchesCategory && matchesMethod
    })
  }, [expenses, searchQuery, categoryFilter, methodFilter])

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0)
    const thisMonth = expenses
      .filter((exp) => {
        const now = new Date()
        const expDate = typeof exp.date === 'string' ? new Date(exp.date) : exp.date
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear()
      })
      .reduce((sum, exp) => sum + exp.amount, 0)
    const categories = Array.from(new Set(expenses.map((e) => e.category))).length
    const avgExpense = expenses.length > 0 ? total / expenses.length : 0

    return { total, thisMonth, categories, avgExpense }
  }, [expenses])

  const getMethodBadgeColor = (method: Expense["method"]) => {
    switch (method) {
      case "cash":
        return "bg-emerald-100 text-emerald-800 border-0"
      case "bank":
        return "bg-blue-100 text-blue-800 border-0"
      case "mpesa":
        return "bg-slate-100 text-slate-700 border-0"
      case "card":
        return "bg-amber-100 text-amber-800 border-0"
      default:
        return "bg-slate-100 text-slate-600 border-0"
    }
  }

  const getMethodIcon = (method: Expense["method"]) => {
    switch (method) {
      case "cash":
        return Banknote
      case "bank":
        return CreditCard
      case "mpesa":
        return Smartphone
      case "card":
        return CreditCard
      default:
        return DollarSign
    }
  }

  const categories = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.category)))
  }, [expenses])

  const groupedByDate = useMemo(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 864e5).toDateString()

    const byKey: Record<string, { label: string; date: Date; exps: Expense[] }> = {}
    filteredExpenses.forEach((exp) => {
      const d = typeof exp.date === "string" ? new Date(exp.date) : exp.date
      const dateStr = d.toDateString()
      const label = dateStr === today ? "Today" : dateStr === yesterday ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      if (!byKey[dateStr]) byKey[dateStr] = { label, date: d, exps: [] }
      byKey[dateStr].exps.push(exp)
    })

    return Object.values(byKey)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(({ label, exps }) => ({
        label,
        exps: exps.sort((a, b) => {
          const da = typeof a.date === "string" ? new Date(a.date) : a.date
          const db = typeof b.date === "string" ? new Date(b.date) : b.date
          return db.getTime() - da.getTime()
        }),
      }))
  }, [filteredExpenses])

  const handleSaveExpense = async () => {
    if (!formData.date || !formData.category || !formData.vendor || !formData.amount || !formData.method) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsSaving(true)
      const url = editingExpense ? '/api/catha/expenses' : '/api/catha/expenses'
      const method = editingExpense ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editingExpense && { id: editingExpense.id }),
          date: formData.date,
          category: formData.category,
          vendor: formData.vendor,
          amount: formData.amount,
          method: formData.method,
          description: formData.description || '',
          userName: 'Current User', // TODO: Get from auth session
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save expense')
      }

      const data = await response.json()
      if (data.success) {
        toast.success(editingExpense ? 'Expense updated successfully' : 'Expense added successfully')
        setFormData({
          date: new Date().toISOString().split("T")[0],
          category: "",
          vendor: "",
          amount: "",
          method: "" as Expense["method"] | "",
          description: "",
        })
        setIsAddModalOpen(false)
        setIsEditModalOpen(false)
        setEditingExpense(null)
        fetchExpenses()
      }
    } catch (error: any) {
      console.error('Error saving expense:', error)
      toast.error('Failed to save expense', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/catha/expenses?id=${deletingExpense.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete expense')
      }

      toast.success('Expense deleted successfully')
      setDeletingExpense(null)
      fetchExpenses()
    } catch (error: any) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense', {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Header title="Expenses" subtitle="Track and manage your operating costs" />

        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Stats Cards */}
          <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      Ksh {stats.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-rose-100 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-rose-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      Ksh {stats.thisMonth.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Categories</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.categories}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Wallet2 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Average Expense</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      Ksh {stats.avgExpense.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Stats */}
          <div className="md:hidden -mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex-shrink-0 w-[140px] bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm">
                <p className="text-[10px] uppercase text-slate-500 font-medium">Total</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">KSh {stats.total.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                <TrendingDown className="h-4 w-4 text-rose-500 mt-2" />
              </div>
              <div className="flex-shrink-0 w-[140px] bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm">
                <p className="text-[10px] uppercase text-slate-500 font-medium">This Month</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">KSh {stats.thisMonth.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                <Calendar className="h-4 w-4 text-blue-500 mt-2" />
              </div>
              <div className="flex-shrink-0 w-[100px] bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm">
                <p className="text-[10px] uppercase text-slate-500 font-medium">Categories</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">{stats.categories}</p>
                <Wallet2 className="h-4 w-4 text-slate-400 mt-2" />
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <Card className="border border-[#E5E7EB] bg-white shadow-sm rounded-[14px] overflow-hidden">
            <CardHeader className="pb-4 px-4 md:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg md:text-xl font-bold text-slate-900">Expense Ledger</CardTitle>
                  <CardDescription className="mt-0.5 text-slate-500">Track all your business expenses</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchExpenses}
                    disabled={isLoading}
                    className="gap-2 rounded-lg border-slate-200 h-9"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isLoading ? "Loading..." : "Refresh"}</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 rounded-lg border-slate-200 h-9 hidden sm:flex">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  {canAdd && (
                    <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="gap-2 rounded-lg h-9 ml-auto sm:ml-0">
                      <Plus className="h-4 w-4" />
                      Add Expense
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-4 md:px-6">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by category, vendor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-lg border-slate-200 bg-slate-50 h-11"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-slate-200 bg-slate-50 h-11">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-slate-200 bg-slate-50 h-11">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile Expense Cards */}
              <div className="md:hidden space-y-4">
                {isLoading ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Loading expenses...</p>
                  </div>
                ) : error ? (
                  <div className="py-12 text-center">
                    <p className="text-red-600 text-sm mb-3">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchExpenses}>Retry</Button>
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="py-16 text-center">
                    <Wallet2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No expenses found</p>
                    <p className="text-slate-400 text-xs mt-1">Add your first expense to get started</p>
                    {canAdd && <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="mt-4">Add Expense</Button>}
                  </div>
                ) : (
                  groupedByDate.map((group) => (
                    <div key={group.label} className="space-y-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 sticky top-0 py-2 -mx-1 z-10 bg-white">
                        {group.label}
                      </p>
                      <div className="space-y-3">
                        {group.exps.map((exp) => {
                          const MethodIcon = getMethodIcon(exp.method)
                          const expDate = typeof exp.date === "string" ? new Date(exp.date) : exp.date
                          return (
                            <div
                              key={exp.id}
                              onClick={() => setViewingExpense(exp)}
                              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 active:bg-slate-50/80 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="font-semibold text-sm text-slate-900 truncate">{exp.category}</p>
                                <Badge className={`text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${getMethodBadgeColor(exp.method)}`}>
                                  <MethodIcon className="h-3 w-3" />
                                  {exp.method === "mpesa" ? "M-Pesa" : exp.method}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {exp.vendor}
                                </p>
                                <span className="text-xs text-slate-500 shrink-0">
                                  {expDate.toLocaleDateString("en-KE", { month: "short", day: "2-digit" })} · {expDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-lg font-bold tabular-nums text-red-600">
                                  KSh {exp.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                                </p>
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-0.5 shrink-0">
                                  View
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </span>
                              </div>
                              {exp.description && (
                                <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 line-clamp-2">{exp.description}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                        <TableHead className="font-semibold uppercase text-xs tracking-wider">Date</TableHead>
                        <TableHead className="font-semibold uppercase text-xs tracking-wider">Category</TableHead>
                        <TableHead className="font-semibold uppercase text-xs tracking-wider">Vendor</TableHead>
                        <TableHead className="font-semibold uppercase text-xs tracking-wider">Payment Method</TableHead>
                        <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Amount</TableHead>
                        <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading expenses...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-destructive">
                            <div className="flex flex-col items-center gap-2">
                              <p>{error}</p>
                              <Button variant="outline" size="sm" onClick={fetchExpenses}>
                                Retry
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery || categoryFilter !== "all" || methodFilter !== "all" ? "No expenses match your filters" : "No expenses found. Add your first expense!"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExpenses.map((exp) => {
                          const MethodIcon = getMethodIcon(exp.method)
                          const expDate = typeof exp.date === 'string' ? new Date(exp.date) : exp.date
                          return (
                            <TableRow key={exp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {expDate.toLocaleDateString("en-KE", {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm text-foreground">{exp.category}</div>
                                {exp.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{exp.description}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  {exp.vendor}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${getMethodBadgeColor(exp.method)} border text-xs font-medium capitalize flex items-center gap-1.5 w-fit`}>
                                  <MethodIcon className="h-3 w-3" />
                                  {exp.method === "mpesa" ? "M-Pesa" : exp.method}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-right">
                                  <div className="font-bold text-sm text-red-700">
                                    Ksh {exp.amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingExpense(exp)}
                                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingExpense(exp)
                                        setFormData({
                                          date: (typeof exp.date === 'string' ? new Date(exp.date) : exp.date).toISOString().split("T")[0],
                                          category: exp.category,
                                          vendor: exp.vendor,
                                          amount: exp.amount.toString(),
                                          method: exp.method,
                                          description: exp.description || "",
                                        })
                                        setIsEditModalOpen(true)
                                      }}
                                      className="h-8 w-8 p-0 hover:bg-amber-50 hover:text-amber-600"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingExpense(exp)}
                                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              <div className="hidden md:flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredExpenses.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{expenses.length}</span> expenses
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled className="rounded-lg">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg">
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Expense Modal */}
        <Dialog open={!!viewingExpense} onOpenChange={() => setViewingExpense(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Wallet2 className="h-5 w-5 text-rose-600" />
                Expense Details
              </DialogTitle>
              <DialogDescription>View complete expense information</DialogDescription>
            </DialogHeader>
            {viewingExpense && (() => {
              const viewDate = typeof viewingExpense.date === 'string' ? new Date(viewingExpense.date) : viewingExpense.date
              return (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <p className="text-sm font-medium text-foreground">
                        {viewDate.toLocaleDateString("en-KE", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <p className="text-sm font-medium text-foreground">{viewingExpense.category}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vendor</Label>
                    <p className="text-sm font-medium text-foreground">{viewingExpense.vendor}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Payment Method</Label>
                    <Badge className={`${getMethodBadgeColor(viewingExpense.method)} border text-xs font-medium capitalize`}>
                      {viewingExpense.method === "mpesa" ? "M-Pesa" : viewingExpense.method}
                    </Badge>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <p className="text-2xl font-bold text-red-700">
                      Ksh {viewingExpense.amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  {viewingExpense.description && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm text-foreground">{viewingExpense.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )})()}
            <div className="flex flex-wrap gap-2 justify-end pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setViewingExpense(null)} className="rounded-lg">
                Close
              </Button>
              {viewingExpense && (
                <>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingExpense(viewingExpense)
                        setFormData({
                          date: (typeof viewingExpense.date === "string" ? new Date(viewingExpense.date) : viewingExpense.date).toISOString().split("T")[0],
                          category: viewingExpense.category,
                          vendor: viewingExpense.vendor,
                          amount: viewingExpense.amount.toString(),
                          method: viewingExpense.method,
                          description: viewingExpense.description || "",
                        })
                        setViewingExpense(null)
                        setIsEditModalOpen(true)
                      }}
                      className="rounded-lg gap-1.5"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeletingExpense(viewingExpense)
                        setViewingExpense(null)
                      }}
                      className="rounded-lg gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Expense Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsEditModalOpen(false)
            setEditingExpense(null)
            setFormData({
              date: new Date().toISOString().split("T")[0],
              category: "",
              vendor: "",
              amount: "",
              method: "" as Expense["method"] | "",
              description: "",
            })
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Edit2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div>Edit Expense</div>
                  <DialogDescription className="text-sm font-normal mt-1">
                    Update expense information
                  </DialogDescription>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-6">
              {/* Basic Information Section */}
              <Card className="border-2 border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-pink-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
                      <Wallet2 className="h-4 w-4 text-rose-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Expense Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-date" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Calendar className="h-4 w-4 text-rose-600" />
                        Date *
                      </Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="rounded-lg border-2 focus:border-rose-500 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Filter className="h-4 w-4 text-rose-600" />
                        Category *
                      </Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger className="rounded-lg border-2 focus:border-rose-500 h-11">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stock Purchase">Stock Purchase</SelectItem>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="Staff Wages">Staff Wages</SelectItem>
                          <SelectItem value="Utilities">Utilities</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Insurance">Insurance</SelectItem>
                          <SelectItem value="Licenses">Licenses</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-vendor" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Building2 className="h-4 w-4 text-rose-600" />
                      Vendor / Payee *
                    </Label>
                    <Input
                      id="edit-vendor"
                      placeholder="e.g., Main Distributor, Landlord, etc."
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="rounded-lg border-2 focus:border-rose-500 h-11"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Details Section */}
              <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-cyan-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-blue-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Payment Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-amount" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Amount (Ksh) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Ksh</span>
                        <Input
                          id="edit-amount"
                          type="number"
                          placeholder="0.00"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="rounded-lg border-2 focus:border-blue-500 h-11 pl-14"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-method" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        Payment Method *
                      </Label>
                      <Select
                        value={formData.method}
                        onValueChange={(v) => setFormData({ ...formData, method: v as Expense["method"] })}
                      >
                        <SelectTrigger className="rounded-lg border-2 focus:border-blue-500 h-11">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">
                            <div className="flex items-center gap-2">
                              <Banknote className="h-4 w-4" />
                              Cash
                            </div>
                          </SelectItem>
                          <SelectItem value="bank">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Bank Transfer
                            </div>
                          </SelectItem>
                          <SelectItem value="mpesa">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              M-Pesa
                            </div>
                          </SelectItem>
                          <SelectItem value="card">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Card
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes Section */}
              <Card className="border-2 border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-gray-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-slate-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Additional Notes</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-description" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 text-slate-600" />
                      Description
                    </Label>
                    <Textarea
                      id="edit-description"
                      placeholder="Add any additional details about this expense..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="rounded-lg border-2 focus:border-slate-500 min-h-[100px] resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent -mx-6 px-6 pb-6">
              <Button variant="outline" onClick={() => {
                setIsEditModalOpen(false)
                setEditingExpense(null)
                setFormData({
                  date: new Date().toISOString().split("T")[0],
                  category: "",
                  vendor: "",
                  amount: "",
                  method: "" as Expense["method"] | "",
                  description: "",
                })
              }} className="rounded-xl h-11 font-semibold">
                Cancel
              </Button>
              <Button
                onClick={handleSaveExpense}
                disabled={isSaving}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 h-11 font-semibold shadow-lg disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Update Expense
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingExpense} onOpenChange={(open) => !open && setDeletingExpense(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the expense for <strong>{deletingExpense?.category}</strong> from <strong>{deletingExpense?.vendor}</strong>.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingExpense(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteExpense}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Expense Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false)
            setFormData({
              date: new Date().toISOString().split("T")[0],
              category: "",
              vendor: "",
              amount: "",
              method: "" as Expense["method"] | "",
              description: "",
            })
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div>Add New Expense</div>
                  <DialogDescription className="text-sm font-normal mt-1">
                    Record a new business expense
                  </DialogDescription>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-6">
              {/* Basic Information Section */}
              <Card className="border-2 border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-pink-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
                      <Wallet2 className="h-4 w-4 text-rose-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Expense Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Calendar className="h-4 w-4 text-rose-600" />
                        Date *
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="rounded-lg border-2 focus:border-rose-500 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Filter className="h-4 w-4 text-rose-600" />
                        Category *
                      </Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger className="rounded-lg border-2 focus:border-rose-500 h-11">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stock Purchase">Stock Purchase</SelectItem>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="Staff Wages">Staff Wages</SelectItem>
                          <SelectItem value="Utilities">Utilities</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Insurance">Insurance</SelectItem>
                          <SelectItem value="Licenses">Licenses</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendor" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Building2 className="h-4 w-4 text-rose-600" />
                      Vendor / Payee *
                    </Label>
                    <Input
                      id="vendor"
                      placeholder="e.g., Main Distributor, Landlord, etc."
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="rounded-lg border-2 focus:border-rose-500 h-11"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Details Section */}
              <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-cyan-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-blue-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Payment Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Amount (Ksh) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Ksh</span>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="0.00"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="rounded-lg border-2 focus:border-blue-500 h-11 pl-14"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="method" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        Payment Method *
                      </Label>
                      <Select
                        value={formData.method}
                        onValueChange={(v) => setFormData({ ...formData, method: v as Expense["method"] })}
                      >
                        <SelectTrigger className="rounded-lg border-2 focus:border-blue-500 h-11">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">
                            <div className="flex items-center gap-2">
                              <Banknote className="h-4 w-4" />
                              Cash
                            </div>
                          </SelectItem>
                          <SelectItem value="bank">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Bank Transfer
                            </div>
                          </SelectItem>
                          <SelectItem value="mpesa">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              M-Pesa
                            </div>
                          </SelectItem>
                          <SelectItem value="card">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Card
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes Section */}
              <Card className="border-2 border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-gray-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-slate-700" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Additional Notes</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 text-slate-600" />
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Add any additional details about this expense..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="rounded-lg border-2 focus:border-slate-500 min-h-[100px] resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent -mx-6 px-6 pb-6">
              <Button variant="outline" onClick={() => {
                setIsAddModalOpen(false)
                setFormData({
                  date: new Date().toISOString().split("T")[0],
                  category: "",
                  vendor: "",
                  amount: "",
                  method: "" as Expense["method"] | "",
                  description: "",
                })
              }} className="rounded-xl h-11 font-semibold">
                Cancel
              </Button>
              <Button
                onClick={handleSaveExpense}
                disabled={isSaving}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 h-11 font-semibold shadow-lg disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </>
  )
}
