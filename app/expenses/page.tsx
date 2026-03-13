"use client"

import { useState, useMemo } from "react"
import { Sidebar } from "@/components/layout/sidebar"
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
} from "lucide-react"

export interface Expense {
  id: string
  date: Date
  category: string
  vendor: string
  amount: number
  method: "cash" | "bank" | "mpesa" | "card"
  description?: string
  receipt?: string
}

const defaultExpenses: Expense[] = [
  {
    id: "1",
    date: new Date("2025-02-01"),
    category: "Stock Purchase",
    vendor: "Main Distributor",
    amount: 84500,
    method: "bank",
    description: "Monthly stock order",
  },
  {
    id: "2",
    date: new Date("2025-02-01"),
    category: "Rent",
    vendor: "Landlord",
    amount: 120000,
    method: "bank",
    description: "Monthly rent payment",
  },
  {
    id: "3",
    date: new Date("2025-01-31"),
    category: "Staff Wages",
    vendor: "Staff",
    amount: 68000,
    method: "cash",
    description: "Weekly payroll",
  },
  {
    id: "4",
    date: new Date("2025-01-30"),
    category: "Utilities",
    vendor: "KPLC & Water",
    amount: 15500,
    method: "mpesa",
    description: "Electricity and water bills",
  },
  {
    id: "5",
    date: new Date("2025-01-28"),
    category: "Marketing",
    vendor: "Social Media Agency",
    amount: 25000,
    method: "bank",
    description: "Monthly marketing campaign",
  },
  {
    id: "6",
    date: new Date("2025-01-25"),
    category: "Maintenance",
    vendor: "Equipment Repair Co",
    amount: 12000,
    method: "mpesa",
    description: "Bar equipment maintenance",
  },
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("expenses")
      if (saved) {
        return JSON.parse(saved).map((e: any) => ({ ...e, date: new Date(e.date) }))
      }
    }
    return defaultExpenses
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState<"all" | Expense["method"]>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "",
    vendor: "",
    amount: "",
    method: "" as Expense["method"] | "",
    description: "",
  })

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
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
        return exp.date.getMonth() === now.getMonth() && exp.date.getFullYear() === now.getFullYear()
      })
      .reduce((sum, exp) => sum + exp.amount, 0)
    const categories = Array.from(new Set(expenses.map((e) => e.category))).length
    const avgExpense = expenses.length > 0 ? total / expenses.length : 0

    return { total, thisMonth, categories, avgExpense }
  }, [expenses])

  const getMethodBadgeColor = (method: Expense["method"]) => {
    switch (method) {
      case "cash":
        return "bg-emerald-100 text-emerald-800 border-emerald-300"
      case "bank":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "mpesa":
        return "bg-purple-100 text-purple-800 border-purple-300"
      case "card":
        return "bg-amber-100 text-amber-800 border-amber-300"
      default:
        return "bg-muted text-muted-foreground"
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

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Expenses" subtitle="Track and manage your operating costs" />

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

          {/* Main Content Card */}
          <Card className="border-border/60 bg-gradient-to-br from-white via-white to-rose-50/30 shadow-lg rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Expense Ledger</CardTitle>
                  <CardDescription className="mt-1">Track all your business expenses and payments</CardDescription>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40 shadow-sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by category, vendor, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-border/70 bg-background/60"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border/70 bg-background/60">
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
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border/70 bg-background/60">
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

              {/* Table */}
              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/40">
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
                      {filteredExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No expenses found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExpenses.map((exp) => {
                          const MethodIcon = getMethodIcon(exp.method)
                          return (
                            <TableRow key={exp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {exp.date.toLocaleDateString("en-KE", {
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-amber-50 hover:text-amber-600"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
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
              <div className="flex items-center justify-between pt-2">
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
            {viewingExpense && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <p className="text-sm font-medium text-foreground">
                      {viewingExpense.date.toLocaleDateString("en-KE", {
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
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setViewingExpense(null)} className="rounded-lg">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Expense Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
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
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl h-11 font-semibold">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!formData.date || !formData.category || !formData.vendor || !formData.amount || !formData.method) {
                    alert("Please fill in all required fields")
                    return
                  }
                  const newExpense: Expense = {
                    id: Date.now().toString(),
                    date: new Date(formData.date),
                    category: formData.category,
                    vendor: formData.vendor,
                    amount: parseFloat(formData.amount),
                    method: formData.method,
                    description: formData.description || undefined,
                  }
                  const updatedExpenses = [newExpense, ...expenses]
                  setExpenses(updatedExpenses)
                  if (typeof window !== "undefined") {
                    localStorage.setItem("expenses", JSON.stringify(updatedExpenses))
                  }
                  setFormData({
                    date: new Date().toISOString().split("T")[0],
                    category: "",
                    vendor: "",
                    amount: "",
                    method: "" as Expense["method"] | "",
                    description: "",
                  })
                  setIsAddModalOpen(false)
                }}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 h-11 font-semibold shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
