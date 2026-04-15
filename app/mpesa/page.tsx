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
import {
  Smartphone,
  Download,
  Search,
  TrendingUp,
  Wallet2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar,
} from "lucide-react"

const mpesaTx = [
  {
    id: "MPA12345",
    date: "2025-02-02 10:24",
    phone: "0712 345 678",
    customer: "John Doe",
    amount: 2450,
    type: "Customer Payment",
    status: "Completed",
  },
  {
    id: "MPA12346",
    date: "2025-02-02 10:02",
    phone: "0790 555 001",
    customer: "Walk-in",
    amount: 1200,
    type: "Customer Payment",
    status: "Completed",
  },
  {
    id: "MPA12347",
    date: "2025-02-01 22:17",
    phone: "0700 111 222",
    customer: "Jane Smith",
    amount: 5800,
    type: "Till Transfer",
    status: "Pending",
  },
  {
    id: "MPA12348",
    date: "2025-02-01 18:45",
    phone: "0723 456 789",
    customer: "Mike Johnson",
    amount: 3200,
    type: "Customer Payment",
    status: "Completed",
  },
  {
    id: "MPA12349",
    date: "2025-02-01 15:30",
    phone: "0745 678 901",
    customer: "Sarah Williams",
    amount: 1500,
    type: "Till Transfer",
    status: "Failed",
  },
  {
    id: "MPA12350",
    date: "2025-02-01 12:15",
    phone: "0767 890 123",
    customer: "David Brown",
    amount: 4500,
    type: "Customer Payment",
    status: "Completed",
  },
]

export default function MpesaPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "Completed" | "Pending" | "Failed">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "Customer Payment" | "Till Transfer">("all")

  const filteredTransactions = useMemo(() => {
    return mpesaTx.filter((tx) => {
      const matchesSearch =
        searchQuery === "" ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.phone.includes(searchQuery)

      const matchesStatus = statusFilter === "all" || tx.status === statusFilter
      const matchesType = typeFilter === "all" || tx.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [searchQuery, statusFilter, typeFilter])

  const totalAmount = filteredTransactions
    .filter((tx) => tx.status === "Completed")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalTransactions = filteredTransactions.length
  const completedTransactions = filteredTransactions.filter((tx) => tx.status === "Completed").length
  const pendingTransactions = filteredTransactions.filter((tx) => tx.status === "Pending").length

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-purple-50/30">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="M-Pesa Transactions" subtitle="Track all mobile money payments and till transfers" />
        <div className="p-6 space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-2 border-purple-200/60 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Amount</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">
                    Ksh {totalAmount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl bg-purple-500/20 p-2.5 border border-purple-300/50">
                  <Wallet2 className="h-5 w-5 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">{completedTransactions}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/20 p-2.5 border border-emerald-300/50">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">{pendingTransactions}</p>
                </div>
                <div className="rounded-xl bg-amber-500/20 p-2.5 border border-amber-300/50">
                  <ArrowUpRight className="h-5 w-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Transactions</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">{totalTransactions}</p>
                </div>
                <div className="rounded-xl bg-blue-500/20 p-2.5 border border-blue-300/50">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="border-2 border-purple-200/60 bg-gradient-to-br from-white to-purple-50/30 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-800">All Transactions</CardTitle>
                  <CardDescription>Filter and search M-Pesa transactions</CardDescription>
                </div>
                <Button variant="outline" className="gap-2 bg-white hover:bg-purple-50 border-purple-200">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-purple-200/50">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ID, customer, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-white border-purple-200 focus:border-purple-400"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="h-10 w-40 bg-white border-purple-200 focus:border-purple-400">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger className="h-10 w-48 bg-white border-purple-200 focus:border-purple-400">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Customer Payment">Customer Payment</SelectItem>
                    <SelectItem value="Till Transfer">Till Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-lg border-2 border-purple-200/60 bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-purple-200/60 hover:bg-transparent bg-gradient-to-r from-purple-100/50 to-purple-50/30">
                      <TableHead className="text-gray-800 font-bold uppercase text-xs">Ref</TableHead>
                      <TableHead className="text-gray-800 font-bold uppercase text-xs">Date & Time</TableHead>
                      <TableHead className="text-gray-800 font-bold uppercase text-xs">Customer</TableHead>
                      <TableHead className="text-gray-800 font-bold uppercase text-xs">Phone</TableHead>
                      <TableHead className="text-gray-800 font-bold uppercase text-xs">Type</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold uppercase text-xs">Amount</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold uppercase text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <TableRow
                          key={tx.id}
                          className="border-purple-200/40 hover:bg-purple-50/50 bg-white/60 transition-colors"
                        >
                          <TableCell className="font-mono text-xs font-semibold text-purple-700">{tx.id}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tx.date}</TableCell>
                          <TableCell className="text-sm font-semibold text-gray-800">{tx.customer}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{tx.phone}</TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[11px] ${
                                tx.type === "Customer Payment"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                              }`}
                            >
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="text-xs font-bold text-primary/70 uppercase">Ksh</span>
                              <span className="text-sm font-black text-primary">
                                {tx.amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={`text-[11px] ${
                                tx.status === "Completed"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : tx.status === "Pending"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                              }`}
                            >
                              {tx.status}
                            </Badge>
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
      </main>
    </div>
  )
}
