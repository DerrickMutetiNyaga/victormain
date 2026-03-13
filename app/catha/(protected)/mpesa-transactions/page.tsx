"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/layout/header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Smartphone,
  Search,
  Wallet2,
  CheckCircle2,
  Clock,
  XCircle,
  FileDown,
  ExternalLink,
  Hash,
  Phone,
  Receipt,
  Calendar,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MpesaTransaction {
  id: string
  transactionType: string
  transactionId?: string
  checkoutRequestId?: string
  merchantRequestId?: string
  amount: number
  phoneNumber: string
  accountReference: string
  status: string
  responseCode?: string
  resultDesc?: string
  mpesaReceiptNumber?: string
  createdAt: string
  updatedAt: string
}

export default function MpesaTransactionsPage() {
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({})
  const [selectedTx, setSelectedTx] = useState<MpesaTransaction | null>(null)

  useEffect(() => {
    loadTransactions()
  }, [statusFilter, typeFilter, dateFilter])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (dateFilter.start) params.append("startDate", dateFilter.start)
      if (dateFilter.end) params.append("endDate", dateFilter.end)
      if (searchQuery) params.append("search", searchQuery)

      const response = await fetch(`/api/mpesa/transactions?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.transactions || [])
      } else {
        throw new Error(data.error || "Failed to load transactions")
      }
    } catch (error: any) {
      console.error("Error loading transactions:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load transactions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions

    return transactions.filter((tx) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        tx.mpesaReceiptNumber?.toLowerCase().includes(searchLower) ||
        tx.checkoutRequestId?.toLowerCase().includes(searchLower) ||
        tx.merchantRequestId?.toLowerCase().includes(searchLower) ||
        tx.transactionId?.toLowerCase().includes(searchLower) ||
        tx.accountReference.toLowerCase().includes(searchLower) ||
        tx.phoneNumber.includes(searchQuery)
      )
    })
  }, [transactions, searchQuery])

  // Shared summary — ONE source for both mobile and desktop. Same dataset (filteredTransactions), same filters.
  const summaryStats = useMemo(() => {
    const completed = filteredTransactions.filter((tx) => tx.status === "COMPLETED")
    const totalAmount = completed.reduce((sum, tx) => sum + tx.amount, 0)
    const completedCount = completed.length
    const pendingCount = filteredTransactions.filter((tx) => tx.status === "PENDING").length
    const totalCount = filteredTransactions.length
    const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    const stats = {
      totalAmount,
      completedCount,
      pendingCount,
      totalCount,
      successRate,
      formattedAmount: `KSh ${totalAmount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }
    if (process.env.NODE_ENV === "development") {
      console.debug("[mpesa-summary] Unified stats (mobile + desktop):", stats)
    }
    return stats
  }, [filteredTransactions])

  const { totalAmount, completedCount: completedTransactions, pendingCount: pendingTransactions, totalCount: totalTransactions, successRate, formattedAmount } = summaryStats
  const failedTransactions = filteredTransactions.filter((tx) => tx.status === "FAILED")

  // Financial insights (derived from same summaryStats)
  const avgTransaction = completedTransactions > 0 ? totalAmount / completedTransactions : 0
  const hourlyCounts: Record<number, number> = {}
  filteredTransactions.forEach((tx) => {
    const h = new Date(tx.createdAt).getHours()
    hourlyCounts[h] = (hourlyCounts[h] || 0) + 1
  })
  const peakHour =
    Object.keys(hourlyCounts).length > 0
      ? Object.entries(hourlyCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-emerald-100 text-emerald-800 border-0",
      PENDING: "bg-amber-100 text-amber-800 border-0",
      CANCELLED: "bg-transparent text-slate-600 border border-slate-300",
      FAILED: "bg-red-100 text-red-800 border-0",
    }
    return styles[status] || "bg-slate-100 text-slate-600 border-0"
  }

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 8) return phone
    return `${phone.slice(0, 4)}•••${phone.slice(-3)}`
  }

  const groupedByDate = useMemo(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 864e5).toDateString()

    const byKey: Record<string, { label: string; date: Date; txs: MpesaTransaction[] }> = {}
    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.createdAt)
      const dateStr = d.toDateString()
      const label = dateStr === today ? "Today" : dateStr === yesterday ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      const key = dateStr
      if (!byKey[key]) byKey[key] = { label, date: d, txs: [] }
      byKey[key].txs.push(tx)
    })

    return Object.values(byKey)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(({ label, txs }) => ({ label, txs: txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }))
  }, [filteredTransactions])

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Type",
      "Transaction ID",
      "Amount",
      "Phone Number",
      "Account Reference",
      "Status",
      "Receipt Number",
      "Date",
    ]

    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.transactionType,
      tx.transactionId || tx.checkoutRequestId || "",
      tx.amount,
      tx.phoneNumber,
      tx.accountReference,
      tx.status,
      tx.mpesaReceiptNumber || "",
      new Date(tx.createdAt).toLocaleString(),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `mpesa-transactions-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: "Transactions exported to CSV",
    })
  }

  return (
    <>
      <Header title="M-Pesa Transactions" subtitle="Track all mobile money payments and till transfers" />
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 overflow-x-hidden">
        {/* 1. Clean Financial Summary */}
        <div className="space-y-4 mb-6">
          <div className="hidden md:grid grid-cols-4 gap-4">
            {[
              { label: "Total Volume", value: formattedAmount, subtext: "Completed transactions only", icon: Wallet2 },
              { label: "Completed", value: String(completedTransactions), subtext: `Success rate: ${successRate}%`, icon: CheckCircle2 },
              { label: "Pending", value: String(pendingTransactions), subtext: "Awaiting confirmation", icon: Clock },
              { label: "Total", value: String(totalTransactions), subtext: "All transactions", icon: Smartphone },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow"
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{card.subtext}</p>
                <div className="mt-3 flex justify-end">
                  <card.icon className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>

          {/* Mobile stats — SAME values as desktop via summaryStats */}
          <div className="md:hidden -mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { label: "Total Volume", value: formattedAmount, subtext: "Completed only", icon: Wallet2 },
                { label: "Completed", value: String(completedTransactions), subtext: `${successRate}% success`, icon: CheckCircle2 },
                { label: "Pending", value: String(pendingTransactions), subtext: "Awaiting", icon: Clock },
                { label: "Total", value: String(totalTransactions), subtext: "All transactions", icon: Smartphone },
              ].map((card) => (
                <div
                  key={card.label}
                  className="flex-shrink-0 w-[140px] bg-white rounded-[14px] border border-[#E5E7EB] p-3 shadow-sm"
                >
                  <p className="text-[10px] uppercase text-slate-500 font-medium">{card.label}</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 truncate" title={card.value}>{card.value}</p>
                  {card.subtext && <p className="text-[10px] text-slate-500 mt-0.5">{card.subtext}</p>}
                  <card.icon className="h-4 w-4 text-slate-400 mt-2" />
                </div>
              ))}
            </div>
          </div>

          {/* 5. Financial Insights Bar */}
          <div className="hidden md:flex items-center gap-8 py-3 px-4 bg-white rounded-xl border border-[#E5E7EB] text-sm">
            <div>
              <span className="text-slate-500">Success Rate:</span>
              <span className="ml-2 font-semibold text-slate-900">{successRate}%</span>
            </div>
            <div>
              <span className="text-slate-500">Avg Transaction:</span>
              <span className="ml-2 font-semibold text-slate-900">
                KSh {avgTransaction.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Peak Hour:</span>
              <span className="ml-2 font-semibold text-slate-900">
                {peakHour !== null ? `${String(peakHour).padStart(2, "0")}:00` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Professional Filter Bar */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 mb-4">
          {/* Desktop filter row */}
          <div className="hidden md:flex items-center gap-3">
            <div className="relative flex-[0.6] min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by ID, reference, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-slate-400 focus:bg-white rounded-lg"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-[130px] bg-slate-50 border-slate-200 rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-11 w-[120px] bg-slate-50 border-slate-200 rounded-lg">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="STK">STK Push</SelectItem>
                <SelectItem value="C2B">C2B</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter.start || ""}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="h-11 w-[140px] bg-slate-50 border-slate-200 rounded-lg"
            />
            <Input
              type="date"
              value={dateFilter.end || ""}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="h-11 w-[140px] bg-slate-50 border-slate-200 rounded-lg"
            />
            <Button variant="outline" onClick={exportToCSV} className="h-11 ml-auto border-slate-200 rounded-lg gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="md:hidden space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-50 border-slate-200 text-sm rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 bg-slate-50 border-slate-200 text-sm rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 bg-slate-50 border-slate-200 text-sm rounded-lg">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="STK">STK Push</SelectItem>
                  <SelectItem value="C2B">C2B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={dateFilter.start || ""}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 text-sm rounded-lg"
              />
              <Input
                type="date"
                value={dateFilter.end || ""}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 text-sm rounded-lg"
              />
            </div>
            <Button variant="outline" onClick={exportToCSV} className="w-full h-11 border-slate-200 rounded-lg gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* 3. Table Section */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] overflow-hidden">
          {/* Mobile Transaction Cards */}
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-sm">Loading transactions...</div>
          ) : (
            <>
              {/* Mobile: Responsive table/card hybrid - same columns as desktop */}
              <div className="md:hidden overflow-x-auto">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center">
                    <Wallet2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No transactions found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="min-w-[600px] p-4">
                    {/* Mobile table header row - matches desktop */}
                    <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50/80 rounded-t-lg">
                      <span>Transaction</span>
                      <span>Order</span>
                      <span className="text-right">Amount</span>
                      <span>Status</span>
                      <span className="w-20" />
                    </div>
                    {groupedByDate.map((group) => (
                      <div key={group.label} className="space-y-2 mt-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 sticky top-0 py-1.5 z-10 bg-[#F8FAFC]">
                          {group.label}
                        </p>
                        {group.txs.map((tx) => (
                          <div
                            key={tx.id}
                            onClick={() => setSelectedTx(tx)}
                            className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center px-3 py-3 bg-white rounded-lg border border-slate-200 shadow-sm active:bg-slate-50/80 cursor-pointer transition-colors hover:border-slate-300"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-slate-900 truncate">
                                {tx.mpesaReceiptNumber || tx.checkoutRequestId?.slice(-8) || tx.transactionId?.slice(-8) || "—"}
                              </p>
                              <p className="font-mono text-[10px] text-slate-500 truncate">
                                {tx.transactionType} • {tx.checkoutRequestId?.slice(-6) || tx.id.slice(-6)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              {tx.accountReference?.startsWith("TXN") ? (
                                <a
                                  href={`/catha/orders?search=${tx.accountReference}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-emerald-600 font-medium hover:underline truncate block"
                                >
                                  {tx.accountReference}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-500 truncate block">{tx.accountReference || "—"}</span>
                              )}
                              {tx.phoneNumber && (
                                <span className="text-[10px] text-slate-400 font-mono">{maskPhone(tx.phoneNumber)}</span>
                              )}
                            </div>
                            <p
                              className={`text-sm font-bold tabular-nums text-right ${
                                tx.status === "COMPLETED" ? "text-emerald-600" : tx.status === "FAILED" ? "text-red-600" : "text-slate-900"
                              }`}
                            >
                              KSh {tx.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                            </p>
                            <Badge className={`text-[10px] font-medium px-2 py-0.5 rounded-md w-fit ${getStatusBadge(tx.status)}`}>
                              {tx.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] border-slate-200"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTx(tx)
                              }}
                            >
                              View
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-xl px-1">
                <Table>
                  <TableHeader>
                    <TableRow className="border-0 hover:bg-transparent bg-slate-50/60">
                      <TableHead className="text-slate-500 font-medium text-xs tracking-wider py-4 pl-6 border-0">Transaction</TableHead>
                      <TableHead className="text-slate-500 font-medium text-xs tracking-wider py-4 border-0">Order</TableHead>
                      <TableHead className="text-right text-slate-500 font-medium text-xs tracking-wider py-4 pr-6 border-0">Amount</TableHead>
                      <TableHead className="text-slate-500 font-medium text-xs tracking-wider py-4 border-0">Status</TableHead>
                      <TableHead className="text-slate-500 font-medium text-xs tracking-wider py-4 pr-6 w-[120px] border-0"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16 text-slate-500 border-0">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <TableRow
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="border-0 border-b-0 cursor-pointer transition-all hover:bg-slate-50/80 group [&+tr]:border-t-0"
                        >
                          <TableCell className="py-5 pl-6 border-0 align-top">
                            <div className="space-y-1">
                              <p className="font-mono text-sm font-bold text-slate-900 tracking-wide">
                                {tx.mpesaReceiptNumber || tx.checkoutRequestId?.slice(-8) || tx.transactionId?.slice(-8) || "—"}
                              </p>
                              <p className="text-xs text-slate-500 font-mono">
                                Ref: {tx.checkoutRequestId?.slice(-8) || tx.transactionId?.slice(-8) || tx.id.slice(-8)} • {tx.transactionType}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tx.accountReference} ({tx.phoneNumber})
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-5 border-0 align-top">
                            {tx.accountReference && tx.accountReference.startsWith("TXN") ? (
                              <a
                                href={`/catha/orders?search=${tx.accountReference}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                {tx.accountReference}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-sm text-slate-500">{tx.accountReference || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-5 pr-6 text-right border-0 align-top">
                            <span
                              className={`text-lg font-bold tabular-nums tracking-tight ${
                                tx.status === "COMPLETED"
                                  ? "text-emerald-600"
                                  : tx.status === "FAILED"
                                    ? "text-red-600"
                                    : "text-slate-900"
                              }`}
                            >
                              KSh {tx.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="py-5 border-0 align-top">
                            <Badge className={`text-[11px] font-medium px-2.5 py-0.5 rounded-md ${getStatusBadge(tx.status)}`}>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-5 pr-6 border-0 align-top" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                              onClick={() => setSelectedTx(tx)}
                            >
                              View Details
                              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Transaction Detail Slide Panel */}
        <Sheet open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col">
            {selectedTx && (
              <>
                {/* Header — primary identifier */}
                <div className="p-6 pb-4 pr-14 border-b border-slate-100">
                  <SheetTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Transaction Details</SheetTitle>
                  <div className="mt-3 flex items-baseline justify-between gap-4">
                    <p className="font-mono text-2xl font-bold text-slate-900 tracking-tight">
                      {selectedTx.mpesaReceiptNumber || selectedTx.checkoutRequestId?.slice(-12) || "—"}
                    </p>
                    <Badge className={`text-xs font-medium px-3 py-1 rounded-lg shrink-0 ${getStatusBadge(selectedTx.status)}`}>
                      {selectedTx.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Payment summary */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Amount</p>
                      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${selectedTx.status === "COMPLETED" ? "text-emerald-600" : selectedTx.status === "FAILED" ? "text-red-600" : "text-slate-900"}`}>
                        KSh {selectedTx.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <Receipt className="h-10 w-10 text-slate-200" />
                  </div>

                  {/* Customer & order */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer & order</h3>
                    <div className="grid gap-3">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-sm text-slate-500 shrink-0">Phone</span>
                        <span className="font-mono text-sm text-slate-900 text-right">{selectedTx.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-sm text-slate-500 shrink-0">Order</span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-slate-900">{selectedTx.accountReference || "—"}</span>
                          {selectedTx.accountReference?.startsWith("TXN") && (
                            <a
                              href={`/catha/orders?search=${selectedTx.accountReference}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-end gap-1.5 mt-1 text-sm text-emerald-600 hover:underline"
                            >
                              View order
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metadata</h3>
                    <div className="rounded-lg border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                      <div className="flex justify-between items-center gap-3 px-4 py-3">
                        <span className="text-sm text-slate-500">Type</span>
                        <span className="text-sm font-medium text-slate-900">{selectedTx.transactionType}</span>
                      </div>
                      <div className="px-4 py-3">
                        <span className="text-sm text-slate-500 block mb-1">Reference ID</span>
                        <p className="font-mono text-xs text-slate-700 break-all leading-relaxed">{selectedTx.checkoutRequestId || selectedTx.transactionId || selectedTx.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Timeline</h3>
                    <div className="rounded-lg border border-slate-100 overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-50">
                        <span className="text-sm text-slate-500">Created</span>
                        <span className="text-sm tabular-nums text-slate-900">{new Date(selectedTx.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-sm text-slate-500">Updated</span>
                        <span className="text-sm tabular-nums text-slate-900">{new Date(selectedTx.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Result message */}
                  {selectedTx.resultDesc && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Result</h3>
                      <p className="text-sm text-slate-700 leading-relaxed rounded-lg bg-slate-50/80 border border-slate-100 px-4 py-3">
                        {selectedTx.resultDesc}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

