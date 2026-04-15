 "use client"

import { useMemo, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { recentTransactions, type Transaction } from "@/lib/dummy-data"
import { Receipt, Download, TrendingUp, ShoppingBag, Wallet2, Edit2, Plus, CheckSquare, Square, Search, X, Minus, Eye, Trash2, Banknote, CreditCard, Smartphone } from "lucide-react"
import { products } from "@/lib/dummy-data"
import { useEffect } from "react"

export default function OrdersPage() {
  const [view, setView] = useState<"table" | "cards">("table")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | Transaction["status"]>("all")
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "card" | "mpesa">("all")
  const [orders, setOrders] = useState<Transaction[]>(recentTransactions)
  const [editingOrder, setEditingOrder] = useState<Transaction | null>(null)
  const [viewingOrder, setViewingOrder] = useState<Transaction | null>(null)
  const [draftStatus, setDraftStatus] = useState<Transaction["status"] | "">("")
  const [draftPayment, setDraftPayment] = useState<"cash" | "card" | "mpesa" | "">("")
  const [draftItems, setDraftItems] = useState<Transaction["items"]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [addingItemsToOrder, setAddingItemsToOrder] = useState<Transaction | null>(null)
  const [newItems, setNewItems] = useState<{ productId: string; quantity: number }[]>([])
  const [addItemsSearchQuery, setAddItemsSearchQuery] = useState("")
  const [processingPayment, setProcessingPayment] = useState<Transaction | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "card" | "mpesa" | "">("")

  // Load from localStorage on client side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      const pendingOrders = JSON.parse(localStorage.getItem("orders") || "[]")
      const completedOrders = JSON.parse(localStorage.getItem("allOrders") || "[]")
      const allOrders = [...recentTransactions, ...pendingOrders, ...completedOrders]
      // Convert timestamp strings back to Date objects and remove duplicates
      const uniqueOrders = Array.from(
        new Map(allOrders.map((o) => [o.id, o])).values(),
      )
      const processedOrders = uniqueOrders
        .map((o) => ({
          ...o,
          timestamp: o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp),
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      setOrders(processedOrders)
    }
  }, [])

  // Sync with localStorage when orders change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOrders = orders.filter((o) => o.status === "pending")
      localStorage.setItem("orders", JSON.stringify(savedOrders))
    }
  }, [orders])

  const totalOrders = orders.length
  const totalItems = orders.reduce(
    (sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0),
    0,
  )
  const paidOrders = orders.filter((tx) => tx.status === "completed").length
  const unpaidOrders = orders.length - paidOrders

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return orders.filter((tx) => {
      const matchesSearch =
        q.length === 0 ||
        tx.id.toLowerCase().includes(q) ||
        tx.waiter.toLowerCase().includes(q) ||
        tx.cashier.toLowerCase().includes(q) ||
        String(tx.table).includes(q)

      const matchesStatus = statusFilter === "all" || tx.status === statusFilter
      const matchesPayment =
        paymentFilter === "all" || tx.paymentMethod.toLowerCase() === paymentFilter

      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [orders, paymentFilter, searchQuery, statusFilter])

  const handleViewClick = (order: Transaction) => {
    setViewingOrder(order)
  }

  const handleEditClick = (order: Transaction) => {
    if (order.status === "completed") {
      alert("Cannot edit completed orders")
      return
    }
    setEditingOrder(order)
    setDraftStatus(order.status)
    setDraftPayment(order.paymentMethod as "cash" | "card" | "mpesa")
    setDraftItems([...order.items])
  }

  const handleSaveEdit = () => {
    if (!editingOrder || !draftStatus || !draftPayment) return

    // Recalculate totals based on draft items
    const newSubtotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const newVat = 0
    const newTotal = newSubtotal

    setOrders((prev) =>
      prev.map((o) =>
        o.id === editingOrder.id
          ? {
              ...o,
              status: draftStatus,
              paymentMethod: draftPayment,
              items: draftItems,
              subtotal: newSubtotal,
              vat: newVat,
              total: newTotal,
            }
          : o,
      ),
    )
    setEditingOrder(null)
    setDraftItems([])
  }

  const handleRemoveItemFromEdit = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItemFromEdit(index)
      return
    }
    setDraftItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: newQuantity } : item)),
    )
  }

  const handleAddItemsClick = (order: Transaction) => {
    if (order.status !== "pending") {
      alert("You can only add items to pending orders")
      return
    }
    setAddingItemsToOrder(order)
    // Initialize with existing items from the order
    const existingItems = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))
    setNewItems(existingItems)
  }

  const handleAddItemToOrder = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    setNewItems((prev) => {
      const existing = prev.find((i) => i.productId === productId)
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { productId, quantity: 1 }]
    })
  }

  const handleSaveItemsToOrder = () => {
    if (!addingItemsToOrder || newItems.length === 0) return

    // Convert newItems to full item objects with product details
    const updatedItems = newItems.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      return {
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
      }
    })

    const updatedOrder = { ...addingItemsToOrder }
    updatedOrder.items = updatedItems
    updatedOrder.subtotal = updatedOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    updatedOrder.vat = 0
    updatedOrder.total = updatedOrder.subtotal

    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
    setAddingItemsToOrder(null)
    setNewItems([])
    setAddItemsSearchQuery("")
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleBulkPayment = (paymentMethod: "cash" | "card" | "mpesa") => {
    if (selectedOrders.size === 0) {
      alert("Please select at least one order to pay")
      return
    }

    const selectedOrderIds = Array.from(selectedOrders)
    const totalAmount = orders
      .filter((o) => selectedOrderIds.includes(o.id))
      .reduce((sum, o) => sum + o.total, 0)

    if (confirm(`Pay ${selectedOrderIds.length} order(s) totaling Ksh ${totalAmount.toFixed(2)} by ${paymentMethod}?`)) {
      setOrders((prev) =>
        prev.map((o) =>
          selectedOrderIds.includes(o.id)
            ? { ...o, status: "completed", paymentMethod }
            : o,
        ),
      )
      setSelectedOrders(new Set())
      alert(`Successfully paid ${selectedOrderIds.length} order(s)!`)
    }
  }

  const handlePaymentClick = (order: Transaction) => {
    if (order.status === "completed") {
      alert("This order is already paid")
      return
    }
    setProcessingPayment(order)
    setSelectedPaymentMethod("")
  }

  const handleProcessPayment = () => {
    if (!processingPayment || !selectedPaymentMethod) {
      alert("Please select a payment method")
      return
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === processingPayment.id
          ? { ...o, status: "completed", paymentMethod: selectedPaymentMethod }
          : o,
      ),
    )
    setProcessingPayment(null)
    setSelectedPaymentMethod("")
    alert(`Order ${processingPayment.id} marked as paid via ${selectedPaymentMethod.toUpperCase()}`)
  }

  const getPaymentBadgeClasses = (method: string) => {
    const m = method.toLowerCase()

    switch (m) {
      case "cash":
        return "bg-emerald-100 text-emerald-800 border border-emerald-300"
      case "card":
        return "bg-sky-100 text-sky-800 border border-sky-300"
      case "mpesa":
      case "m-pesa":
        return "bg-purple-100 text-purple-800 border border-purple-300"
      default:
        return "bg-muted text-muted-foreground border border-border"
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Orders" subtitle="Monitor all POS tickets and payments" />
        <div className="p-6 space-y-6">
          {/* Top summary row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Order Overview</h2>
                <p className="text-sm text-muted-foreground">
                  Sorted by most recent first · sample data you can later connect to your backend.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedOrders.size > 0 && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedOrders.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkPayment("cash")}
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                  >
                    Pay Cash
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkPayment("card")}
                    className="bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100"
                  >
                    Pay Card
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkPayment("mpesa")}
                    className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                  >
                    Pay M-Pesa
                  </Button>
                </div>
              )}
            <Button variant="outline" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export
            </Button>
            </div>
          </div>

          {/* Key stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2 border-blue-200/60 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Orders</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">{totalOrders}</p>
                </div>
                <div className="rounded-xl bg-primary/20 p-2.5 border border-primary/30">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Payment Status
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Paid
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        {paidOrders}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                        Unpaid
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        {unpaidOrders}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-200 p-2.5 border border-emerald-300">
                  <TrendingUp className="h-5 w-5 text-emerald-700" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-purple-200/60 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Items Sold</p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">{totalItems}</p>
                </div>
                <div className="rounded-xl bg-amber-200 p-2.5 border border-amber-300">
                  <Wallet2 className="h-5 w-5 text-amber-700" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders table / cards */}
          <Card className="border-2 border-blue-200/60 bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-gray-800">All Orders</CardTitle>
                <CardDescription>Switch between compact table view and detailed cards.</CardDescription>
              </div>
              <div className="flex flex-col gap-3 md:items-end md:text-right">
                <div className="inline-flex rounded-full bg-muted p-1 text-xs font-medium self-end">
                <button
                  type="button"
                  onClick={() => setView("table")}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    view === "table"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setView("cards")}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    view === "cards"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cards
                </button>
                </div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Search by order #, table, waiter or cashier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-40 md:w-56 text-xs"
                  />
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-2xl p-4">
              {view === "table" ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-blue-200/60 hover:bg-transparent bg-blue-100/50">
                      <TableHead className="w-12">
                        <button
                          onClick={() => {
                            if (selectedOrders.size === filteredOrders.length) {
                              setSelectedOrders(new Set())
                            } else {
                              setSelectedOrders(new Set(filteredOrders.map((o) => o.id)))
                            }
                          }}
                          className="flex items-center justify-center"
                        >
                          {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="w-[120px] text-gray-800 font-bold">Order #</TableHead>
                      <TableHead className="text-gray-800 font-bold">Time</TableHead>
                      <TableHead className="text-gray-800 font-bold">Table</TableHead>
                      <TableHead className="text-gray-800 font-bold">Waiter</TableHead>
                      <TableHead className="text-gray-800 font-bold">Cashier</TableHead>
                      <TableHead className="text-gray-800 font-bold">Payment</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold">Items</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold">Total</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold">Status</TableHead>
                      <TableHead className="text-right text-gray-800 font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((tx) => (
                      <TableRow key={tx.id} className="border-blue-200/40 hover:bg-white/80 bg-white/60">
                        <TableCell>
                          <button
                            onClick={() => toggleOrderSelection(tx.id)}
                            className="flex items-center justify-center"
                          >
                            {selectedOrders.has(tx.id) ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{tx.id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.timestamp.toLocaleDateString()}{" "}
                          {tx.timestamp.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">Table {tx.table}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.waiter}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.cashier}</TableCell>
                        <TableCell className="text-sm">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold ${getPaymentBadgeClasses(
                              tx.paymentMethod,
                            )}`}
                          >
                            {tx.paymentMethod.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {tx.items.reduce((sum, i) => sum + i.quantity, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-xs font-bold text-primary/70 uppercase">Ksh</span>
                            <span className="text-base font-black text-primary">{tx.total.toFixed(2)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`text-[11px] capitalize ${
                              tx.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : tx.status === "cancelled"
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 gap-1.5 text-xs font-medium border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              onClick={() => handleViewClick(tx)}
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-blue-600">View</span>
                            </Button>
                            {tx.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 gap-1.5 text-xs font-medium border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300"
                                  onClick={() => handleAddItemsClick(tx)}
                                >
                                  <Plus className="h-3.5 w-3.5 text-emerald-600" />
                                  <span className="text-emerald-600">Add Items</span>
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 px-3 gap-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                                  onClick={() => handlePaymentClick(tx)}
                                >
                                  <Wallet2 className="h-3.5 w-3.5" />
                                  <span>Pay</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {filteredOrders.map((tx) => {
                    const itemCount = tx.items.reduce((sum, i) => sum + i.quantity, 0)
                    return (
                      <div
                        key={tx.id}
                        className="relative flex flex-col rounded-2xl border-2 border-purple-200/60 bg-gradient-to-br from-white to-purple-50/50 p-4 shadow-md hover:shadow-lg hover:border-primary/60 transition-all duration-200"
                      >
                        {/* Checkbox */}
                        <div className="absolute top-3 left-3">
                          <button
                            onClick={() => toggleOrderSelection(tx.id)}
                            className="flex items-center justify-center"
                          >
                            {selectedOrders.has(tx.id) ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3 pb-2 border-b-2 border-purple-200/50 bg-gradient-to-r from-blue-100/60 to-sky-100/60 -mx-4 px-4 pt-3 rounded-t-2xl">
                          <div>
                            <p className="font-mono text-[11px] text-gray-600 font-semibold bg-purple-100/50 px-2 py-0.5 rounded inline-block">#{tx.id}</p>
                            <p className="mt-1 text-sm font-bold text-gray-800">
                              Table {tx.table} · {itemCount} item{itemCount !== 1 ? "s" : ""}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {tx.timestamp.toLocaleDateString()} ·{" "}
                              {tx.timestamp.toLocaleTimeString("en-KE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge
                              className={`text-[11px] capitalize justify-end ${
                                tx.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : tx.status === "cancelled"
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {tx.status}
                            </Badge>
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs font-black text-primary/70 uppercase tracking-wider">Ksh</span>
                                <span className="text-lg font-black text-primary leading-none">{tx.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground">Total</span>
                            </div>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="py-3 space-y-1.5 bg-gradient-to-br from-yellow-50/70 to-amber-50/50 -mx-4 px-4">
                          {tx.items.map((item, idx) => (
                            <div
                              key={`${item.productId}-${idx}`}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground truncate max-w-[55%]">
                                <span className="mr-2 font-medium text-xs text-foreground">{item.quantity}x</span>
                                {item.name}
                              </span>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[10px] font-bold text-primary/70 uppercase">Ksh</span>
                                  <span className="text-xs font-black text-primary">{(item.price * item.quantity).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground/70">Item Total</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Footer meta */}
                        <div className="mt-auto pt-3 border-t-2 border-purple-200/50 flex items-center justify-between text-xs text-gray-600 bg-gradient-to-r from-green-50/70 to-emerald-50/70 -mx-4 px-4 py-2 rounded-b-2xl">
                          <div className="space-y-0.5">
                            <p>
                              Waiter: <span className="font-semibold text-gray-800">{tx.waiter}</span>
                            </p>
                            <p>
                              Cashier: <span className="font-semibold text-gray-800">{tx.cashier}</span>
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <span
                              className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold ${getPaymentBadgeClasses(
                                tx.paymentMethod,
                              )}`}
                            >
                              {tx.paymentMethod.toLowerCase()}
                              </span>
                            <div className="text-[11px] flex flex-col items-end gap-0.5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-gray-600">Subtotal:</span>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-[10px] font-bold text-primary/60 uppercase">Ksh</span>
                                  <span className="font-bold text-gray-800">{tx.subtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                              </div>
                              {/* VAT is already included in item prices; no separate tax line */}
                              <div className="flex items-baseline gap-1 pt-1 border-t border-purple-200/50">
                                <span className="text-gray-800 font-semibold">Total:</span>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-[10px] font-bold text-primary/70 uppercase">Ksh</span>
                                  <span className="font-bold text-primary">{tx.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - At Bottom */}
                        <div className="flex items-center gap-2 -mx-4 px-4 pt-3 mt-3 border-t border-purple-200/50">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs font-medium border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                            onClick={() => handleViewClick(tx)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                            <span className="text-blue-600">View</span>
                          </Button>
                          {tx.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9 text-xs font-medium border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300"
                                onClick={() => handleAddItemsClick(tx)}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                <span className="text-emerald-600">Add Items</span>
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1 h-9 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                                onClick={() => handlePaymentClick(tx)}
                              >
                                <Wallet2 className="h-3.5 w-3.5 mr-1.5" />
                                <span>Pay</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Items Modal */}
      {addingItemsToOrder && (
        <Dialog
          open={!!addingItemsToOrder}
          onOpenChange={(open) => {
            if (!open) {
              setAddingItemsToOrder(null)
              setAddItemsSearchQuery("")
              setNewItems([])
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[95vh] w-[95vw] sm:w-full flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <DialogTitle className="text-lg sm:text-xl font-bold">Add Items to Order #{addingItemsToOrder.id}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-hidden px-6 py-4">
              {/* Search Bar */}
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or barcode..."
                  value={addItemsSearchQuery}
                  onChange={(e) => setAddItemsSearchQuery(e.target.value)}
                  className="pl-10 h-10 sm:h-11 text-sm sm:text-base"
                />
    </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-3 sm:gap-4 overflow-hidden min-h-0">
                {/* Products Grid */}
                <div className="flex flex-col overflow-hidden min-h-0">
                  <div className="mb-2 flex items-center justify-between flex-shrink-0">
                    <Label className="text-xs sm:text-sm font-semibold">Select Products</Label>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {products.filter((p) => {
                        const query = addItemsSearchQuery.toLowerCase()
                        return (
                          query === "" ||
                          p.name.toLowerCase().includes(query) ||
                          p.barcode.toLowerCase().includes(query)
                        )
                      }).length}{" "}
                      products
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto border rounded-lg p-3 sm:p-4 bg-muted/30 min-h-0">
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                      {products
                        .filter((p) => {
                          const query = addItemsSearchQuery.toLowerCase()
                          return (
                            query === "" ||
                            p.name.toLowerCase().includes(query) ||
                            p.barcode.toLowerCase().includes(query)
                          )
                        })
                        .map((product) => {
                          const itemInCart = newItems.find((i) => i.productId === product.id)
                          return (
                            <button
                              key={product.id}
                              onClick={() => handleAddItemToOrder(product.id)}
                              className={`flex flex-col p-3 sm:p-4 rounded-lg border transition-all text-left w-full ${
                                itemInCart
                                  ? "border-primary bg-primary/10 hover:bg-primary/15 shadow-sm"
                                  : "border-border hover:border-primary/50 hover:bg-background hover:shadow-sm"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm sm:text-base text-foreground leading-tight mb-1 line-clamp-2">
                                    {product.name}
                                  </div>
                                  {product.barcode && (
                                    <div className="text-[10px] sm:text-xs text-muted-foreground/70 font-mono">
                                      {product.barcode}
                                    </div>
                                  )}
                                </div>
                                {itemInCart && (
                                  <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0">
                                    <span>{itemInCart.quantity}</span>
                                    <Plus className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                                  {product.category}
                                </div>
                                <div className="text-sm sm:text-base font-bold text-primary">
                                  Ksh {product.price.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                </div>

                {/* Selected Items Summary */}
                <div className="flex flex-col overflow-hidden min-h-0">
                  <div className="mb-2 flex items-center justify-between flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-2">
                      <Label className="text-xs sm:text-sm font-semibold">Order Items</Label>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                        {newItems.length} item{newItems.length !== 1 ? "s" : ""} • Click products to add more
                      </p>
                    </div>
                    {newItems.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Reset to only existing items
                          if (addingItemsToOrder) {
                            const existingItems = addingItemsToOrder.items.map((item) => ({
                              productId: item.productId,
                              quantity: item.quantity,
                            }))
                            setNewItems(existingItems)
                          } else {
                            setNewItems([])
                          }
                        }}
                        className="h-7 text-[10px] sm:text-xs text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Reset</span>
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto border rounded-lg p-2 sm:p-3 bg-muted/30 min-h-0">
                    {newItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">No items selected</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click on products to add them to the order
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {newItems.map((item) => {
                          const product = products.find((p) => p.id === item.productId)!
                          const itemTotal = product.price * item.quantity
                          return (
                            <div
                              key={item.productId}
                              className="flex flex-col p-3 sm:p-4 rounded-lg border border-border bg-background gap-3"
                            >
                              {/* Product Name - Prominent */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm sm:text-base text-foreground leading-tight mb-1 line-clamp-2">
                                    {product.name}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                                    {product.category}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                  onClick={() => {
                                    setNewItems((prev) => prev.filter((i) => i.productId !== item.productId))
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Quantity, Price, and Controls */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs sm:text-sm text-muted-foreground">
                                    {item.quantity} × Ksh {product.price.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right mr-2">
                                    <div className="text-sm sm:text-base font-bold text-primary">
                                      Ksh {itemTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">Item Total</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setNewItems((prev) =>
                                          prev.map((i) =>
                                            i.productId === item.productId
                                              ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                                              : i,
                                          ),
                                        )
                                      }}
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="w-10 text-center text-sm font-bold">{item.quantity}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setNewItems((prev) =>
                                          prev.map((i) =>
                                            i.productId === item.productId
                                              ? { ...i, quantity: i.quantity + 1 }
                                              : i,
                                          ),
                                        )
                                      }}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-semibold">
                              Ksh{" "}
                              {newItems
                                .reduce((sum, item) => {
                                  const product = products.find((p) => p.id === item.productId)!
                                  return sum + product.price * item.quantity
                                }, 0)
                                .toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {/* VAT is already included in item prices; no separate tax line */}
                          <div className="flex justify-between pt-2 border-t font-bold text-base">
                            <span>Total</span>
                            <span className="text-primary">
                              Ksh{" "}
                              {newItems
                                .reduce((sum, item) => {
                                  const product = products.find((p) => p.id === item.productId)!
                                  return sum + product.price * item.quantity
                                }, 0)
                                .toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t px-6 pb-4 sm:pb-6 flex-shrink-0 bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => {
                  setAddingItemsToOrder(null)
                  setAddItemsSearchQuery("")
                  setNewItems([])
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveItemsToOrder}
                disabled={newItems.length === 0}
                size="sm"
                className="w-full sm:w-auto min-w-32 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Save {newItems.length > 0 ? `(${newItems.reduce((sum, i) => sum + i.quantity, 0)} items)` : "Items"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Order Modal */}
      {viewingOrder && (
        <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-lg font-bold">Order #{viewingOrder.id}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Order Info - Compact */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg text-xs">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Table</Label>
                  <p className="text-xs font-semibold mt-0.5">Table {viewingOrder.table}</p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Date</Label>
                  <p className="text-xs font-semibold mt-0.5">
                    {viewingOrder.timestamp.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Time</Label>
                  <p className="text-xs font-semibold mt-0.5">
                    {viewingOrder.timestamp.toLocaleTimeString("en-KE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Waiter</Label>
                  <p className="text-xs font-semibold mt-0.5 truncate">{viewingOrder.waiter}</p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Cashier</Label>
                  <p className="text-xs font-semibold mt-0.5 truncate">{viewingOrder.cashier}</p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                  <div className="mt-0.5">
                    <Badge
                      className={`text-[10px] px-2 py-0.5 ${
                        viewingOrder.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : viewingOrder.status === "cancelled"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {viewingOrder.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Payment Method Badge */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Payment:</Label>
                <span
                  className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${getPaymentBadgeClasses(
                    viewingOrder.paymentMethod,
                  )}`}
                >
                  {viewingOrder.paymentMethod.toLowerCase()}
                </span>
              </div>

              {/* Items List - Compact */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Items ({viewingOrder.items.length})</Label>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {viewingOrder.items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="p-2.5 flex items-center justify-between hover:bg-muted/30"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-xs truncate">
                          <span className="text-primary mr-1.5">{item.quantity}x</span>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Ksh {item.price.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary text-xs">
                          Ksh {(item.price * item.quantity).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Item Total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals - Compact */}
              <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/40 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-gray-800">
                    Ksh {viewingOrder.subtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* VAT is already included in item prices; no separate tax line */}
                <div className="flex justify-between pt-1.5 border-t border-border/50 mt-1.5 text-sm">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="font-bold text-primary">
                    Ksh {viewingOrder.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-2 px-6 py-4 border-t bg-muted/20">
              <div className="flex flex-wrap gap-2">
                {viewingOrder.status === "pending" && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs"
                      onClick={() => {
                        setViewingOrder(null)
                        handlePaymentClick(viewingOrder)
                      }}
                    >
                      <Wallet2 className="h-3.5 w-3.5 mr-1.5" />
                      Process Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setViewingOrder(null)
                        handleAddItemsClick(viewingOrder)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Items
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setViewingOrder(null)
                        handleEditClick(viewingOrder)
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setViewingOrder(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit Order #{editingOrder.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as Transaction["status"])}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <Select
                    value={draftPayment}
                    onValueChange={(v) => setDraftPayment(v as "cash" | "card" | "mpesa")}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Editable Items List */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Items ({draftItems.length})</Label>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {draftItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No items in this order</div>
                  ) : (
                    draftItems.map((item, idx) => (
                      <div key={`${item.productId}-${idx}`} className="p-3 flex items-center justify-between hover:bg-muted/50">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {item.quantity}x {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ksh {item.price.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <p className="font-bold text-primary text-sm">
                              Ksh {(item.price * item.quantity).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItemFromEdit(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Updated Totals */}
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-gray-800">
                    Ksh{" "}
                    {draftItems
                      .reduce((sum, item) => sum + item.price * item.quantity, 0)
                      .toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* VAT is already included in item prices; no separate tax line */}
                <div className="flex justify-between pt-2 border-t border-border/50 mt-2 text-base">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="font-bold text-primary">
                    Ksh{" "}
                    {draftItems
                      .reduce((sum, item) => sum + item.price * item.quantity, 0)
                      .toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => {
                setEditingOrder(null)
                setDraftItems([])
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!draftStatus || !draftPayment || draftItems.length === 0}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Process Payment Modal */}
      {processingPayment && (
        <Dialog open={!!processingPayment} onOpenChange={(open) => !open && setProcessingPayment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Process Payment - Order #{processingPayment.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    Ksh {processingPayment.subtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* VAT is already included in item prices; no separate tax line */}
                <div className="flex justify-between pt-2 border-t border-border/50 mt-2 text-lg font-bold">
                  <span>Total Amount</span>
                  <span className="text-primary">
                    Ksh {processingPayment.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Select Payment Method</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedPaymentMethod("cash")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        selectedPaymentMethod === "cash" ? "bg-emerald-100" : "bg-gray-100"
                      }`}>
                        <Banknote className={`h-6 w-6 ${selectedPaymentMethod === "cash" ? "text-emerald-600" : "text-gray-600"}`} />
                      </div>
                      <span className={`text-xs font-semibold ${selectedPaymentMethod === "cash" ? "text-emerald-700" : "text-gray-700"}`}>
                        Cash
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedPaymentMethod("card")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === "card"
                        ? "border-sky-500 bg-sky-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        selectedPaymentMethod === "card" ? "bg-sky-100" : "bg-gray-100"
                      }`}>
                        <CreditCard className={`h-6 w-6 ${selectedPaymentMethod === "card" ? "text-sky-600" : "text-gray-600"}`} />
                      </div>
                      <span className={`text-xs font-semibold ${selectedPaymentMethod === "card" ? "text-sky-700" : "text-gray-700"}`}>
                        Card
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedPaymentMethod("mpesa")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === "mpesa"
                        ? "border-purple-500 bg-purple-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        selectedPaymentMethod === "mpesa" ? "bg-purple-100" : "bg-gray-100"
                      }`}>
                        <Smartphone className={`h-6 w-6 ${selectedPaymentMethod === "mpesa" ? "text-purple-600" : "text-gray-600"}`} />
                      </div>
                      <span className={`text-xs font-semibold ${selectedPaymentMethod === "mpesa" ? "text-purple-700" : "text-gray-700"}`}>
                        M-Pesa
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => {
                setProcessingPayment(null)
                setSelectedPaymentMethod("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleProcessPayment}
                disabled={!selectedPaymentMethod}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
              >
                <Wallet2 className="h-4 w-4 mr-2" />
                Confirm Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
