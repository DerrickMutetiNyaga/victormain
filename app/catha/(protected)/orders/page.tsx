 "use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"

import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { type Transaction } from "@/lib/dummy-data"
import { Receipt, Download, TrendingUp, ShoppingBag, Wallet2, Edit2, Plus, CheckSquare, Square, Search, X, Minus, Eye, Trash2, Banknote, Smartphone, Users, Printer, LayoutGrid, TableIcon, Filter, MoreVertical, UtensilsCrossed, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react"
import { normalizeKenyaPhone } from "@/lib/phone-utils"
import { normalizeMpesaStatus } from "@/lib/mpesa-status"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { products } from "@/lib/dummy-data"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCathaPermissions } from "@/hooks/use-catha-permissions"
import { OrderCard } from "@/components/orders/order-card"
import { OrderCardMobile } from "@/components/orders/order-card-mobile"
import { UserChip } from "@/components/orders/user-chip"
import { getStatusLabel } from "@/lib/order-utils"
import { ReceiptModal, type ReceiptOrder } from "@/components/receipt"

// ====== REUSABLE TABLE COMPONENTS ======

// Status Badge - Clean, consistent status display
function StatusBadge({ status }: { status: string }) {
  const config = {
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Completed" },
    pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Pending" },
    cancelled: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Cancelled" },
  }[status] || { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", label: status }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  )
}

// Payment Badge - Simplified payment method display
function PaymentBadge({ method }: { method: string | null }) {
  const config: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string }> = {
    cash: { icon: <Banknote className="h-3 w-3" />, label: "Cash", bg: "bg-emerald-50", text: "text-emerald-700" },
    mpesa: { icon: <Smartphone className="h-3 w-3" />, label: "M-Pesa", bg: "bg-green-50", text: "text-green-700" },
    card: { icon: <Smartphone className="h-3 w-3" />, label: "Card", bg: "bg-blue-50", text: "text-blue-700" },
  }
  const cfg = config[method?.toLowerCase() || ""] || { icon: null, label: method || "—", bg: "bg-slate-50", text: "text-slate-600" }
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// Icon Button - Consistent action buttons
function IconButton({ 
  icon, 
  onClick, 
  title, 
  variant = "default" 
}: { 
  icon: React.ReactNode; 
  onClick: () => void; 
  title: string;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-all ${
        variant === "primary" 
          ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm" 
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
      }`}
    >
      {icon}
    </button>
  )
}

// Row Action Menu - Dropdown for secondary actions
function RowActionMenu({ 
  order,
  onPay,
  onEdit,
  onAddItems,
  onDelete,
}: { 
  order: Transaction;
  onPay?: () => void;
  onEdit?: () => void;
  onAddItems?: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onPay && (
          <DropdownMenuItem onClick={onPay} className="cursor-pointer">
            <Wallet2 className="h-4 w-4 mr-2 text-emerald-600" />
            <span>Process Payment</span>
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit2 className="h-4 w-4 mr-2 text-amber-600" />
            <span>Edit Order</span>
          </DropdownMenuItem>
        )}
        {onAddItems && (
          <DropdownMenuItem onClick={onAddItems} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2 text-blue-600" />
            <span>Add Items</span>
          </DropdownMenuItem>
        )}
        {(onPay || onEdit || onAddItems) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onDelete} variant="destructive" className="cursor-pointer">
          <Trash2 className="h-4 w-4 mr-2" />
          <span>Delete Order</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { canEdit, canDelete } = useCathaPermissions("orders")
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<"table" | "cards">("cards")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "PAID" | "PARTIALLY_PAID" | "NOT_PAID">("all")
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "card" | "mpesa">("all")
  const [orders, setOrders] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "mpesa" | "">("")
  const [cashAmountReceived, setCashAmountReceived] = useState<string>("")
  const [printingOrder, setPrintingOrder] = useState<Transaction | null>(null)
  // M-Pesa STK push states
  const [showMpesaDialog, setShowMpesaDialog] = useState(false)
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState("")
  const [mpesaProcessing, setMpesaProcessing] = useState(false)
  const [pendingMpesaOrderId, setPendingMpesaOrderId] = useState<string | null>(null)
  const [mpesaError, setMpesaError] = useState<{ message: string; status: string } | null>(null)
  const [mpesaCheckoutRequestId, setMpesaCheckoutRequestId] = useState<string | null>(null)
  const mpesaPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Ensure component is mounted on client to prevent hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  const hasScrolledRef = useRef(false)
  const isFetchingRef = useRef(false)
  const ordersLengthRef = useRef(0)
  const pauseUntilRef = useRef(0) // On 500/401, pause polling to avoid aggressive retries

  // Fetch orders - use cache for fast repeat loads (API has 3s Cache-Control)
  const fetchOrders = useCallback(async () => {
    if (isFetchingRef.current) return
    if (Date.now() < pauseUntilRef.current) return // Backoff after error
    
    try {
      isFetchingRef.current = true
      if (ordersLengthRef.current === 0) setLoading(true)
      
      const response = await fetch('/api/catha/orders', {
        cache: 'default',
        headers: { 'Cache-Control': 'max-age=3, stale-while-revalidate=5' },
      })
      if (!response.ok) {
        if (response.status === 401 || response.status >= 500) {
          pauseUntilRef.current = Date.now() + 15_000 // No aggressive retries
        }
        throw new Error('Failed to fetch orders')
      }
      const data = await response.json()
      if (data?.error) {
        pauseUntilRef.current = Date.now() + 15_000
        throw new Error(data.error)
      }
      const rawOrders = Array.isArray(data) ? data : []
      const processedOrders = rawOrders.map((o: any) => ({
        ...o,
        timestamp: o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp),
        paymentStatus: (() => {
          if (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID') return o.paymentStatus
          if (o.status === 'completed') return 'PAID'
          const received = o.cashAmount ?? o.amountReceived ?? 0
          const total = o.total ?? 0
          if (received > 0 && received < total) return 'PARTIALLY_PAID'
          if (o.paymentStatus === 'NOT_PAID') return 'NOT_PAID'
          return 'NOT_PAID'
        })(),
        mpesaReceiptNumber: o.mpesaReceiptNumber || null,
        glovoOrderNumber: o.glovoOrderNumber || null,
        cashAmount: o.cashAmount ?? null,
        cashBalance: o.cashBalance ?? null,
        // Ensure numeric fields have default values (e-commerce orders may not have vat)
        subtotal: o.subtotal ?? 0,
        vat: o.vat ?? 0,
        total: o.total ?? 0,
        // Ensure items have price
        items: (o.items || []).map((item: any) => ({
          ...item,
          price: item.price ?? 0,
          quantity: item.quantity ?? 0,
        })),
      }))
      // Deduplicate by id — prevents React key warnings when alertBar fires twice
      .filter((o: Transaction, idx: number, arr: Transaction[]) => arr.findIndex((x: Transaction) => x.id === o.id) === idx)
      .sort((a: Transaction, b: Transaction) => {
        // First, prioritize pending orders
        const aIsPending = a.status === "pending"
        const bIsPending = b.status === "pending"
        
        // If one is pending and the other isn't, pending comes first
        if (aIsPending && !bIsPending) return -1
        if (!aIsPending && bIsPending) return 1
        
        // If both have same status (both pending or both not pending), sort by timestamp (newest first)
        return b.timestamp.getTime() - a.timestamp.getTime()
      })
      
      // Update orders and track length using functional update
      setOrders((prevOrders) => {
        // Check for any change: IDs, count, or order content (status, payment, totals)
        const hasChanged =
          prevOrders.length !== processedOrders.length ||
          processedOrders.some((next: Transaction) => {
            const prev = prevOrders.find(o => o.id === next.id)
            if (!prev) return true
            return (
              prev.status !== next.status ||
              (prev as any).paymentStatus !== (next as any).paymentStatus ||
              prev.total !== next.total ||
              (prev as any).amountReceived !== (next as any).amountReceived ||
              prev.items.length !== next.items.length
            )
          })

        if (hasChanged) {
          ordersLengthRef.current = processedOrders.length
          return processedOrders
        }
        return prevOrders
      })
    } catch (error) {
      console.error('Error fetching orders:', error)
      // Only set empty array on initial load
      setOrders((prevOrders) => {
        if (prevOrders.length === 0) {
          ordersLengthRef.current = 0
          return []
        }
        return prevOrders
      })
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, []) // No dependencies - function never changes

  // Initial fetch and auto-refresh every 5 seconds for new orders
  useEffect(() => {
    if (!mounted) return
    
    fetchOrders()
    
    // Auto-refresh every 2 seconds to catch new/updated orders in real-time
    const interval = setInterval(() => {
      fetchOrders()
    }, 2000)

    return () => clearInterval(interval)
  }, [mounted, fetchOrders]) // fetchOrders is now stable (no dependencies)

  // Handle scroll to order from notification hash anchor - only run once
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || hasScrolledRef.current) return
    
    const hash = window.location.hash
    if (hash && hash.startsWith('#menu-order-')) {
      hasScrolledRef.current = true
      const orderId = hash.replace('#menu-order-', '')
      
      // Scroll to order after a short delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`menu-order-${orderId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight the order briefly
          element.classList.add('ring-4', 'ring-orange-500', 'ring-offset-2')
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-orange-500', 'ring-offset-2')
          }, 3000)
        }
      }, 1000) // Increased delay to ensure orders are loaded
    }
  }, [mounted]) // Removed orders dependency to prevent re-running

  const totalOrders = orders.length
  const totalItems = orders.reduce(
    (sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0),
    0,
  )
  const paidOrders = orders.filter((tx) => getStatusLabel((tx as any).paymentStatus || tx.status) === "PAID").length
  const partiallyPaidOrders = orders.filter((tx) => getStatusLabel((tx as any).paymentStatus || tx.status) === "PARTIALLY_PAID").length
  const notPaidOrders = orders.filter((tx) => getStatusLabel((tx as any).paymentStatus || tx.status) === "NOT_PAID").length
  const unpaidOrders = notPaidOrders + partiallyPaidOrders

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return orders.filter((tx) => {
      const matchesSearch =
        q.length === 0 ||
        tx.id.toLowerCase().includes(q) ||
        tx.waiter?.toLowerCase().includes(q) ||
        tx.cashier?.toLowerCase().includes(q) ||
        String(tx.table).includes(q) ||
        (tx as any).customerName?.toLowerCase().includes(q) ||
        (tx as any).customerPhone?.includes(q) ||
        tx.items.some((item) => item.name?.toLowerCase().includes(q))

      // Map order status to payment status for filtering
      const orderPaymentStatus = getStatusLabel((tx as any).paymentStatus || tx.status)
      const matchesStatus = statusFilter === "all" || orderPaymentStatus === statusFilter
      
      const matchesPayment =
        paymentFilter === "all" || tx.paymentMethod?.toLowerCase() === paymentFilter

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
    
    // Store order data in sessionStorage for POS page to load
    if (typeof window !== "undefined") {
      sessionStorage.setItem("editOrder", JSON.stringify({
        id: order.id,
        table: order.table,
        items: order.items,
        cashier: order.cashier,
        waiter: order.waiter,
        paymentMethod: order.paymentMethod,
        status: order.status,
        subtotal: order.subtotal,
        vat: order.vat,
        total: order.total,
      }))
      
      // Navigate to POS page
      router.push("/catha/pos?edit=true")
    }
  }

  const handleSaveEdit = async () => {
    if (!editingOrder || !draftStatus || !draftPayment) return

    // Recalculate totals based on draft items
    const newSubtotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const newVat = 0
    const newTotal = newSubtotal

    try {
      const response = await fetch('/api/catha/orders', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOrder.id,
          status: draftStatus,
          paymentMethod: draftPayment,
          items: draftItems,
          subtotal: newSubtotal,
          vat: newVat,
          total: newTotal,
        }),
      })

      if (!response.ok) throw new Error('Failed to update order')

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
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order')
    }
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
    if (!product) {
      console.warn(`Product with ID ${productId} not found`)
      return
    }

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

  const handleSaveItemsToOrder = async () => {
    if (!addingItemsToOrder || newItems.length === 0) return

    // Convert newItems to full item objects with product details
    const updatedItems = newItems
      .map((item) => {
        const product = products.find((p) => p.id === item.productId)
        if (!product) {
          console.warn(`Product with ID ${item.productId} not found, skipping`)
          return null
        }
        return {
          productId: item.productId,
          name: product.name,
          quantity: item.quantity,
          price: product.price,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
    
    if (updatedItems.length === 0) {
      alert('No valid products to add')
      return
    }

    const newSubtotal = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const newVat = 0
    const newTotal = newSubtotal

    try {
      const response = await fetch('/api/catha/orders', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: addingItemsToOrder.id,
          items: updatedItems,
          subtotal: newSubtotal,
          vat: newVat,
          total: newTotal,
        }),
      })

      if (!response.ok) throw new Error('Failed to update order')

      setOrders((prev) => prev.map((o) => (o.id === addingItemsToOrder.id ? {
        ...o,
        items: updatedItems,
        subtotal: newSubtotal,
        vat: newVat,
        total: newTotal,
      } : o)))
      setAddingItemsToOrder(null)
      setNewItems([])
      setAddItemsSearchQuery("")
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order')
    }
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

  const handleBulkPayment = async (paymentMethod: "cash" | "card" | "mpesa") => {
    if (selectedOrders.size === 0) {
      alert("Please select at least one order to pay")
      return
    }

    const selectedOrderIds = Array.from(selectedOrders)
    const totalAmount = orders
      .filter((o) => selectedOrderIds.includes(o.id))
      .reduce((sum, o) => sum + o.total, 0)

    if (confirm(`Pay ${selectedOrderIds.length} order(s) totaling Ksh ${totalAmount.toFixed(2)} by ${paymentMethod}?`)) {
      try {
        await Promise.all(
          selectedOrderIds.map((id) =>
            fetch('/api/catha/orders', {
              method: 'PUT',
              cache: 'no-store',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, status: 'completed', paymentMethod }),
            })
          )
        )

        setOrders((prev) =>
          prev.map((o) =>
            selectedOrderIds.includes(o.id)
              ? { ...o, status: "completed", paymentMethod }
              : o,
          ),
        )
        setSelectedOrders(new Set())
        alert(`Successfully paid ${selectedOrderIds.length} order(s)!`)
      } catch (error) {
        console.error('Error processing payments:', error)
        alert('Failed to process payments')
      }
    }
  }

  const handlePaymentClick = (order: Transaction) => {
    if (order.status === "completed") {
      alert("This order is already paid")
      return
    }
    setProcessingPayment(order)
    setSelectedPaymentMethod("")
    setCashAmountReceived(order.total != null ? String(order.total.toFixed(2)) : "")
  }

  const markOrderPaid = async (orderId: string, method: "cash" | "mpesa", extra: Record<string, unknown> = {}) => {
    const payload: Record<string, unknown> = {
      id: orderId,
      paymentMethod: method,
      status: "completed",
      paymentStatus: "PAID",
      ...extra,
    }
    await fetch('/api/catha/orders', {
      method: 'PUT',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // Sync menu order
    try {
      await fetch('/api/catha/menu-orders', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'PAID', status: 'paid' }),
      })
    } catch { /* non-critical */ }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "completed", paymentMethod: method, paymentStatus: "PAID", ...extra }
          : o,
      ),
    )
  }

  const handleProcessPayment = async () => {
    if (!processingPayment || !selectedPaymentMethod) {
      alert("Please select a payment method")
      return
    }

    // M-Pesa: open STK push dialog (don't process here)
    if (selectedPaymentMethod === "mpesa") {
      setShowMpesaDialog(true)
      return
    }

    // Cash
    const total = processingPayment.total ?? 0
    const received = cashAmountReceived ? parseFloat(cashAmountReceived) || 0 : total
    const isPartial = received > 0 && received < total
    const isFullPayment = received >= total

    try {
      if (isFullPayment) {
        await markOrderPaid(processingPayment.id, "cash", { cashAmount: total })
        setProcessingPayment(null)
        setSelectedPaymentMethod("")
        setCashAmountReceived("")
        toast.success(`Order ${processingPayment.id} paid via Cash`)
      } else if (isPartial) {
        await fetch('/api/catha/orders', {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: processingPayment.id,
            paymentMethod: "cash",
            paymentStatus: "PARTIALLY_PAID",
            cashAmount: received,
          }),
        })
        setOrders((prev) =>
          prev.map((o) =>
            o.id === processingPayment!.id
              ? { ...o, paymentMethod: "cash", paymentStatus: "PARTIALLY_PAID", cashAmount: received } as any
              : o,
          ),
        )
        setProcessingPayment(null)
        setSelectedPaymentMethod("")
        setCashAmountReceived("")
        toast.success(`Recorded Ksh ${received.toFixed(2)}. Balance: Ksh ${(total - received).toFixed(2)}`)
      } else {
        alert("Amount received cannot be zero")
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Failed to process payment')
    }
  }

  // M-Pesa polling — same logic as POS
  useEffect(() => {
    if (!pendingMpesaOrderId) return

    let isStopped = false
    const currentOrderId = pendingMpesaOrderId
    const currentCheckoutId = mpesaCheckoutRequestId

    const stopPolling = () => {
      isStopped = true
      if (mpesaPollIntervalRef.current) {
        clearTimeout(mpesaPollIntervalRef.current)
        mpesaPollIntervalRef.current = null
      }
      toast.dismiss("mpesa-push")
    }

    const startTime = Date.now()
    const POLL_CAP_MS = 180_000
    const FAST_PHASE_MS = 30_000
    const FAST_INTERVAL = 2000
    const SLOW_INTERVAL = 5000

    const checkPaymentStatus = async () => {
      if (isStopped) return
      try {
        const searchQuery = currentCheckoutId || currentOrderId
        const response = await fetch(`/api/mpesa/transactions?search=${searchQuery}`, { cache: 'no-store' })
        const data = await response.json()

        if (data.success && data.transactions && data.transactions.length > 0) {
          const transaction = data.transactions.find((tx: any) =>
            tx.accountReference === currentOrderId ||
            (currentCheckoutId && tx.checkoutRequestId === currentCheckoutId)
          ) || data.transactions[0]

          const status = normalizeMpesaStatus(transaction.status)
          const isTerminal = status !== 'PENDING'
          if (isTerminal) stopPolling()

          if (status === 'COMPLETED') {
            toast.success("M-Pesa payment confirmed!")
            await markOrderPaid(currentOrderId, "mpesa", {
              mpesaReceiptNumber: transaction.mpesaReceiptNumber || null,
            })
            setShowMpesaDialog(false)
            setMpesaPhoneNumber("")
            setMpesaError(null)
            setPendingMpesaOrderId(null)
            setMpesaCheckoutRequestId(null)
            setMpesaProcessing(false)
            setProcessingPayment(null)
            setSelectedPaymentMethod("")
          } else if (status === 'CANCELLED' || status === 'FAILED') {
            const errMsg = transaction.result_desc ||
              (status === 'CANCELLED'
                ? "Payment was cancelled by the customer. Please try again."
                : "Payment failed. Please check the phone and try again.")
            setMpesaError({ message: errMsg, status })
            setPendingMpesaOrderId(null)
            setMpesaProcessing(false)
          }
        }
      } catch { /* ignore poll errors */ }
    }

    const scheduleNext = () => {
      if (isStopped) return
      const elapsed = Date.now() - startTime
      if (elapsed >= POLL_CAP_MS) {
        stopPolling()
        setMpesaError({ message: "Payment confirmation timeout (3 minutes). Please check the phone or try again.", status: 'TIMEOUT' })
        setPendingMpesaOrderId(null)
        setMpesaProcessing(false)
        return
      }
      const delay = elapsed < FAST_PHASE_MS ? FAST_INTERVAL : SLOW_INTERVAL
      mpesaPollIntervalRef.current = window.setTimeout(poll, delay)
    }

    const poll = () => {
      if (isStopped) return
      checkPaymentStatus().finally(() => {
        if (isStopped) return
        scheduleNext()
      })
    }
    poll()

    return () => {
      isStopped = true
      if (mpesaPollIntervalRef.current) {
        clearTimeout(mpesaPollIntervalRef.current)
        mpesaPollIntervalRef.current = null
      }
    }
  }, [pendingMpesaOrderId, mpesaCheckoutRequestId])

  const handleMpesaPayment = async () => {
    if (!mpesaPhoneNumber.trim() || !processingPayment) {
      toast.error("Please enter a phone number")
      return
    }
    setMpesaError(null)
    setMpesaProcessing(true)
    try {
      toast.loading("Initiating M-Pesa payment...", { id: "mpesa-push" })
      const stkResponse = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: normalizeKenyaPhone(mpesaPhoneNumber.trim()),
          amount: processingPayment.total,
          accountReference: processingPayment.id,
          transactionDesc: `Payment for order ${processingPayment.id}`,
        }),
      })
      const stkData = await stkResponse.json()
      if (stkData.success) {
        toast.loading("Payment request sent! Waiting for confirmation...", { id: "mpesa-push" })
        setPendingMpesaOrderId(processingPayment.id)
        setMpesaCheckoutRequestId(stkData.data?.checkoutRequestID || null)
      } else {
        toast.dismiss("mpesa-push")
        setMpesaError({ message: stkData.error || "Failed to initiate payment. Please try again.", status: 'INITIATION_FAILED' })
        setMpesaProcessing(false)
      }
    } catch (error: any) {
      toast.dismiss("mpesa-push")
      setMpesaError({ message: error.message || "Failed to process M-Pesa payment.", status: 'ERROR' })
      setMpesaProcessing(false)
    }
  }

  const handleAcceptMenuOrder = async (orderId: string) => {
    const serverName = (session?.user as any)?.name ?? "Server"
    try {
      await fetch("/api/catha/menu-orders", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "active", receivedBy: serverName }),
      })
      // Update bar order so "Server" shows who accepted (not "Customer")
      await fetch("/api/catha/orders", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, waiter: serverName }),
      })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, waiter: serverName } : o))
      )
    } catch {
      console.error("Failed to accept order")
    }
  }

  const handleDeleteOrder = async (order: Transaction) => {
    if (!confirm(`Are you sure you want to delete order ${order.id}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/catha/orders?id=${order.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })

      if (!response.ok) throw new Error('Failed to delete order')

      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      alert(`Order ${order.id} deleted successfully`)
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order')
    }
  }

  const handlePrintOrder = (order: Transaction) => {
    setPrintingOrder(order)
  }

  const getPaymentBadgeClasses = (method: string) => {
    const m = method.toLowerCase()

    switch (m) {
      case "cash":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "card":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "mpesa":
      case "m-pesa":
        return "bg-purple-50 text-purple-700 border-purple-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const statusChipCounts = { all: totalOrders, PAID: paidOrders, PARTIALLY_PAID: partiallyPaidOrders, NOT_PAID: notPaidOrders }

  return (
    <>
      {/* ========== MOBILE ONLY (< md) ========== */}
      <div className="md:hidden min-h-screen bg-[#F7F9FC]">
        <div className="sticky top-0 z-20 bg-white border-b border-[#e5e7eb] shadow-sm">
          <div className="grid grid-cols-[56px_1fr_44px] items-center h-14 px-2">
            <div className="w-11 h-11" />
            <h1 className="text-center text-lg font-semibold text-[#0f172a]">Orders</h1>
            <div className="flex justify-end">
              {mounted && session?.user && (
                <UserChip compact name={session.user.name} email={session.user.email} role={session.user.role} />
              )}
            </div>
          </div>
          <p className="text-[11px] text-[#94a3b8] text-center pb-2 -mt-1">Today · {filteredOrders.length} orders</p>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-[#f8fafc] border-[#e5e7eb] text-sm w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            {(["all", "PAID", "PARTIALLY_PAID", "NOT_PAID"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all ${
                  statusFilter === status ? "bg-primary text-white shadow-sm" : "bg-white border border-[#e5e7eb] text-[#64748b]"
                }`}
              >
                {status === "all" ? "All" : status === "PAID" ? "Paid" : status === "PARTIALLY_PAID" ? "Partially paid" : "Not paid"} ({statusChipCounts[status]})
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-[#e5e7eb] p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-[#0f172a]">{totalOrders}</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">Today</p>
            <div className="mt-2 flex justify-end">
              <div className="h-8 w-8 rounded-lg bg-[#ecfdf5] flex items-center justify-center">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#e5e7eb] p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">Payment Split</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Paid
                </span>
                <span className="text-sm font-bold text-[#0f172a]">{paidOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Partially paid
                </span>
                <span className="text-sm font-bold text-[#0f172a]">{partiallyPaidOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Not paid
                </span>
                <span className="text-sm font-bold text-[#0f172a]">{notPaidOrders}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#64748b] px-2 py-1 rounded-lg bg-white border border-[#e5e7eb]">
              {statusFilter === "all" ? "All statuses" : statusFilter === "PAID" ? "Paid" : statusFilter === "PARTIALLY_PAID" ? "Partially paid" : "Not paid"}
            </span>
            <span className="text-xs text-[#64748b] px-2 py-1 rounded-lg bg-white border border-[#e5e7eb]">
              {paymentFilter === "all" ? "All payments" : paymentFilter.charAt(0).toUpperCase() + paymentFilter.slice(1)}
            </span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-[#e5e7eb]" onClick={() => setFilterSheetOpen(true)}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-8 text-center">
              <Receipt className="h-12 w-12 text-[#94a3b8] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#64748b]">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((tx) => {
                const orderSource = (tx as any).orderSource || ((tx as any).cashier === "Customer" && (tx as any).customerPhone ? "menu" : "pos")
                const orderData = {
                  id: tx.id,
                  timestamp: tx.timestamp,
                  status: tx.status,
                  paymentStatus: getStatusLabel((tx as any).paymentStatus || tx.status),
                  items: tx.items.map((item) => ({ name: item.name || "Unknown", quantity: item.quantity || 0, price: item.price || 0 })),
                  total: tx.total ?? null,
                  customerName: (tx as any).customerName || undefined,
                  customerPhone: (tx as any).customerPhone || null,
                  paymentMethod: tx.paymentMethod || null,
                  orderSource,
                  amountReceived: (tx as any).cashAmount ?? (tx as any).amountReceived ?? null,
                }
                // Accept only shows when not yet accepted (waiter still "Customer")
                const isPendingMenuOrder = tx.status === "pending" && !!(tx as any).customerPhone && ((tx as any).waiter === "Customer" || !(tx as any).waiter)
                return (
                  <div key={tx.id} className="relative">
                    {isPendingMenuOrder && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-t-xl bg-gradient-to-r from-orange-500 to-amber-500 -mb-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          <span className="text-white text-xs font-bold uppercase tracking-wide">New Order — Table {tx.table}</span>
                          {(tx as any).customerPhone && (
                            <span className="text-white/80 text-xs font-mono">{(tx as any).customerPhone}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleAcceptMenuOrder(tx.id)}
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-full transition-all active:scale-95"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </button>
                      </div>
                    )}
                    <OrderCardMobile
                      order={orderData}
                      originalOrder={tx}
                      onView={handleViewClick}
                      onPrint={handlePrintOrder}
                      onDelete={canDelete ? handleDeleteOrder : undefined}
                      onPay={tx.status !== "completed" ? handlePaymentClick : undefined}
                      onEdit={canEdit && tx.status !== "completed" ? handleEditClick : undefined}
                      onAddItems={canEdit && tx.status === "pending" ? handleAddItemsClick : undefined}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========== DESKTOP / LARGER SCREENS (md+) - ONE scroll (main) ========== */}
      <div className="hidden md:block bg-[#f8fafc] min-h-0">
        {/* Header - sticky so it stays visible when main scrolls */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200/60 px-6 py-4 nest-hub-max:py-2 nest-hub-max:px-4 shrink-0">
          <div className="flex items-center justify-between nest-hub-max:mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-[#0f172a] nest-hub-max:text-xl">Orders</h1>
              <p className="text-sm text-[#64748b] mt-1 nest-hub-max:mt-0.5 nest-hub-max:text-xs nest-hub-max:font-medium nest-hub-max:text-slate-600">Today</p>
            </div>
            {mounted && session?.user && (
              <UserChip
                name={session.user.name}
                email={session.user.email}
                role={session.user.role}
              />
            )}
          </div>
          
          {/* Search and filters - compact + horizontal scroll on tablet zone */}
          <div className="flex flex-wrap items-center gap-3 nest-hub-max:flex-nowrap nest-hub-max:gap-2 nest-hub-max:overflow-x-auto nest-hub-max:scrollbar-hide nest-hub-max:pb-1">
            <div className="relative flex-1 min-w-[200px] nest-hub-max:min-w-[140px] nest-hub-max:flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
              <Input
                placeholder="Search orders, customer, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-white border-[#e5e7eb] nest-hub-max:h-9 nest-hub-max:text-sm"
              />
            </div>
            
            {/* Status filter pills - compact on tablet */}
            <div className="flex items-center gap-2 nest-hub-max:gap-1.5 nest-hub-max:flex-shrink-0">
              {(["all", "PAID", "PARTIALLY_PAID", "NOT_PAID"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all nest-hub-max:px-2 nest-hub-max:py-1 nest-hub-max:text-[11px] nest-hub-max:rounded-md ${
                    statusFilter === status
                      ? "bg-[#2563eb] text-white"
                      : "bg-white border border-[#e5e7eb] text-[#64748b] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {status === "all" ? "All" : status === "PAID" ? "Paid" : status === "PARTIALLY_PAID" ? "Partially paid" : "Not paid"}
                </button>
              ))}
            </div>
            
            {/* Payment filter pills - compact on tablet */}
            <div className="flex items-center gap-2 nest-hub-max:gap-1.5 nest-hub-max:flex-shrink-0">
              {(["all", "cash", "mpesa", "card"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentFilter(method)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all nest-hub-max:px-2 nest-hub-max:py-1 nest-hub-max:text-[11px] nest-hub-max:rounded-md ${
                    paymentFilter === method
                      ? "bg-[#2563eb] text-white"
                      : "bg-white border border-[#e5e7eb] text-[#64748b] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {method === "all" ? "All" : method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 nest-hub-max:p-3 nest-hub-max:space-y-2">
          {/* Top summary row */}
          <div className="flex items-center justify-between gap-4 nest-hub-max:gap-2 nest-hub-max:shrink-0">
            <div className="flex items-center gap-3 nest-hub-max:gap-2">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center nest-hub-max:h-8 nest-hub-max:w-8 nest-hub-max:rounded-xl">
                <Receipt className="h-5 w-5 text-primary nest-hub-max:h-4 nest-hub-max:w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground nest-hub-max:text-base nest-hub-max:font-semibold nest-hub-max:text-slate-800">Order Overview</h2>
                <p className="text-sm text-muted-foreground nest-hub-max:text-xs nest-hub-max:font-medium nest-hub-max:text-slate-600">
                  Sorted by most recent first · {filteredOrders.length} orders
                </p>
              </div>
            </div>
            <div className="flex gap-2 nest-hub-max:gap-1.5">
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
            <Button variant="outline" className="gap-2 bg-transparent nest-hub-max:h-9 nest-hub-max:text-sm nest-hub-max:px-2.5">
              <Download className="h-4 w-4 nest-hub-max:h-3.5 nest-hub-max:w-3.5" />
              Export
            </Button>
            </div>
          </div>

          {/* Key stats - compact on tablet */}
          <div className="grid gap-4 md:grid-cols-3 nest-hub-max:gap-2 nest-hub-max:grid-cols-3 nest-hub-max:shrink-0">
            <Card className="border border-border shadow-sm bg-background nest-hub-max:border-slate-200">
              <CardContent className="flex items-center justify-between p-5 nest-hub-max:p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-semibold nest-hub-max:mb-1 nest-hub-max:text-[10px] nest-hub-max:font-semibold nest-hub-max:text-slate-600">Total Orders</p>
                  <p className="text-3xl font-black text-primary nest-hub-max:text-xl nest-hub-max:font-bold">{totalOrders}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 border border-primary/20 nest-hub-max:p-2 nest-hub-max:rounded-md">
                  <ShoppingBag className="h-6 w-6 text-primary nest-hub-max:h-4 nest-hub-max:w-4" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm bg-background nest-hub-max:border-slate-200">
              <CardContent className="p-5 nest-hub-max:p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4 font-semibold nest-hub-max:mb-2 nest-hub-max:text-[10px] nest-hub-max:font-semibold nest-hub-max:text-slate-600">Payment Status</p>
                <div className="space-y-3 nest-hub-max:space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 nest-hub-max:gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm nest-hub-max:h-2 nest-hub-max:w-2" />
                      <span className="text-sm font-semibold text-foreground nest-hub-max:text-xs nest-hub-max:font-semibold nest-hub-max:text-slate-800">Paid</span>
                    </div>
                    <span className="text-2xl font-black text-emerald-600 nest-hub-max:text-lg nest-hub-max:font-bold">{paidOrders}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 nest-hub-max:gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm nest-hub-max:h-2 nest-hub-max:w-2" />
                      <span className="text-sm font-semibold text-foreground nest-hub-max:text-xs nest-hub-max:font-semibold nest-hub-max:text-slate-800">Unpaid</span>
                    </div>
                    <span className="text-2xl font-black text-amber-600 nest-hub-max:text-lg nest-hub-max:font-bold">{unpaidOrders}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm bg-background nest-hub-max:border-slate-200">
              <CardContent className="flex items-center justify-between p-5 nest-hub-max:p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-semibold nest-hub-max:mb-1 nest-hub-max:text-[10px] nest-hub-max:font-semibold nest-hub-max:text-slate-600">Total Items Sold</p>
                  <p className="text-3xl font-black text-primary nest-hub-max:text-xl nest-hub-max:font-bold">{totalItems}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 border border-primary/20 nest-hub-max:p-2 nest-hub-max:rounded-md">
                  <Wallet2 className="h-6 w-6 text-primary nest-hub-max:h-4 nest-hub-max:w-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Section - normal flow, no nested scroll */}
          <Card className="border border-[#e5e7eb] shadow-sm nest-hub-max:gap-0 nest-hub-max:py-0">
            {/* Modern Premium Toolbar */}
            <div className="bg-white border-b border-[#e5e7eb] nest-hub-max:bg-white/80 nest-hub-max:border-slate-200 nest-hub-max:shrink-0">
              {/* Desktop Layout - hidden on Nest Hub Max */}
              <div className="hidden md:flex nest-hub-max:!hidden items-center justify-between px-5 py-4 gap-4">
                {/* Left: Title + Subtitle */}
                <div className="flex-shrink-0">
                  <h2 className="text-xl font-semibold text-[#0f172a]">All Orders</h2>
                  <p className="text-sm text-[#64748b] mt-0.5">Manage orders, payments, and receipts.</p>
                </div>

                {/* Right: Toolbar Controls */}
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <Input
                      placeholder="Search by order #, customer, phone…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 w-[280px] pl-10 pr-4 text-sm rounded-xl border-[#e5e7eb] bg-[#f8fafc] focus:bg-white focus:border-[#2563eb] transition-colors"
                    />
                  </div>

                  {/* Status Filter */}
                  {mounted ? (
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="h-10 w-[140px] rounded-xl border-[#e5e7eb] bg-white text-sm font-medium">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="PAID">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                            Paid
                          </span>
                        </SelectItem>
                        <SelectItem value="PARTIALLY_PAID">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                            Partially paid
                          </span>
                        </SelectItem>
                        <SelectItem value="NOT_PAID">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                            Not Paid
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 w-[140px] rounded-xl border border-[#e5e7eb] bg-[#f8fafc] animate-pulse" />
                  )}

                  {/* Payment Filter */}
                  {mounted ? (
                    <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
                      <SelectTrigger className="h-10 w-[140px] rounded-xl border-[#e5e7eb] bg-white text-sm font-medium">
                        <SelectValue placeholder="All payments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All payments</SelectItem>
                        <SelectItem value="cash">
                          <span className="flex items-center gap-2">
                            <Banknote className="h-3.5 w-3.5 text-[#16a34a]" />
                            Cash
                          </span>
                        </SelectItem>
                        <SelectItem value="mpesa">
                          <span className="flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5 text-[#7c3aed]" />
                            M-Pesa
                          </span>
                        </SelectItem>
                        <SelectItem value="card">
                          <span className="flex items-center gap-2">
                            Card
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 w-[140px] rounded-xl border border-[#e5e7eb] bg-[#f8fafc] animate-pulse" />
                  )}

                  {/* View Toggle - Segmented Control */}
                  <div className="flex items-center bg-[#f1f5f9] rounded-full p-1">
                    <button
                      type="button"
                      onClick={() => setView("table")}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                        view === "table"
                          ? "bg-white text-[#0f172a] shadow-sm"
                          : "text-[#64748b] hover:text-[#0f172a]"
                      }`}
                    >
                      <TableIcon className="h-4 w-4" />
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("cards")}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                        view === "cards"
                          ? "bg-white text-[#0f172a] shadow-sm"
                          : "text-[#64748b] hover:text-[#0f172a]"
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Cards
                    </button>
                  </div>
                </div>
              </div>

              {/* Nest Hub Max / Tablet Landscape - 2-row compact toolbar */}
              <div className="hidden nest-hub-max:grid nest-hub-max:grid-rows-[auto_auto] nest-hub-max:gap-2 nest-hub-max:px-4 nest-hub-max:py-3">
                {/* Row 1: Title (left) | View toggle + Export (right) */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div>
                    <h2 className="text-xl font-semibold text-[#0f172a] nest-hub-max:text-lg">All Orders</h2>
                    <p className="text-sm text-[#64748b] nest-hub-max:text-xs nest-hub-max:font-medium nest-hub-max:text-slate-600">Manage orders, payments, and receipts.</p>
                  </div>
                  <div className="flex items-center gap-2 h-10">
                    <div className="flex items-center bg-[#f1f5f9] rounded-full p-1 h-10">
                      <button
                        type="button"
                        onClick={() => setView("table")}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all h-8 ${
                          view === "table"
                            ? "bg-white text-[#0f172a] shadow-sm"
                            : "text-[#64748b] hover:text-[#0f172a]"
                        }`}
                      >
                        <TableIcon className="h-3.5 w-3.5" />
                        Table
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("cards")}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all h-8 ${
                          view === "cards"
                            ? "bg-white text-[#0f172a] shadow-sm"
                            : "text-[#64748b] hover:text-[#0f172a]"
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Cards
                      </button>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5 text-sm shrink-0">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
                {/* Row 2: Search (1fr) | Status | Payment */}
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <Input
                      placeholder="Search by order #, customer, phone…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 min-h-[40px] pl-10 pr-4 text-sm rounded-xl border-slate-200 bg-white/80 focus:bg-white focus:border-[#2563eb] transition-colors w-full"
                    />
                  </div>
                  {mounted ? (
                    <>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                        <SelectTrigger className="h-10 min-h-[40px] w-[120px] rounded-xl border-slate-200 bg-white/80 text-sm font-medium shrink-0">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="PAID">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                              Paid
                            </span>
                          </SelectItem>
                          <SelectItem value="PARTIALLY_PAID">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                              Partially paid
                            </span>
                          </SelectItem>
                          <SelectItem value="NOT_PAID">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                              Not Paid
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
                        <SelectTrigger className="h-10 min-h-[40px] w-[110px] rounded-xl border-slate-200 bg-white/80 text-sm font-medium shrink-0">
                          <SelectValue placeholder="All payments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All payments</SelectItem>
                          <SelectItem value="cash">
                            <span className="flex items-center gap-2">
                              <Banknote className="h-3.5 w-3.5 text-[#16a34a]" />
                              Cash
                            </span>
                          </SelectItem>
                          <SelectItem value="mpesa">
                            <span className="flex items-center gap-2">
                              <Smartphone className="h-3.5 w-3.5 text-[#7c3aed]" />
                              M-Pesa
                            </span>
                          </SelectItem>
                          <SelectItem value="card">
                            <span className="flex items-center gap-2">Card</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-[120px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse shrink-0" />
                      <div className="h-10 w-[110px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse shrink-0" />
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden px-4 py-3 space-y-3">
                {/* Row 1: Title + View Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#0f172a]">All Orders</h2>
                    <p className="text-xs text-[#64748b]">Manage orders & payments</p>
                  </div>
                  <div className="flex items-center bg-[#f1f5f9] rounded-full p-0.5">
                    <button
                      type="button"
                      onClick={() => setView("table")}
                      className={`p-2 rounded-full transition-all ${
                        view === "table"
                          ? "bg-white text-[#0f172a] shadow-sm"
                          : "text-[#64748b]"
                      }`}
                    >
                      <TableIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("cards")}
                      className={`p-2 rounded-full transition-all ${
                        view === "cards"
                          ? "bg-white text-[#0f172a] shadow-sm"
                          : "text-[#64748b]"
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                  <Input
                    placeholder="Search orders…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-full pl-10 pr-4 text-sm rounded-xl border-[#e5e7eb] bg-[#f8fafc] focus:bg-white"
                  />
                </div>

                {/* Row 3: Filters */}
                <div className="grid grid-cols-2 gap-2">
                  {mounted ? (
                    <>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                        <SelectTrigger className="h-10 rounded-xl border-[#e5e7eb] bg-white text-sm">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="PAID">Paid</SelectItem>
                          <SelectItem value="PARTIALLY_PAID">Partially paid</SelectItem>
                          <SelectItem value="NOT_PAID">Not paid</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
                        <SelectTrigger className="h-10 rounded-xl border-[#e5e7eb] bg-white text-sm">
                          <SelectValue placeholder="Payment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All payments</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <div className="h-10 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] animate-pulse" />
                      <div className="h-10 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] animate-pulse" />
                    </>
                  )}
                </div>
              </div>

              {/* Summary Strip - Quick Stats - compact on tablet */}
              <div className="px-5 py-2.5 bg-[#f8fafc] border-t border-[#e5e7eb] flex items-center gap-6 text-xs overflow-x-auto nest-hub-max:px-4 nest-hub-max:py-1.5 nest-hub-max:gap-4 nest-hub-max:shrink-0">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                  <span className="text-[#64748b]">Paid:</span>
                  <span className="font-semibold text-[#0f172a]">{paidOrders}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                  <span className="text-[#64748b]">Partially paid:</span>
                  <span className="font-semibold text-[#0f172a]">{partiallyPaidOrders}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                  <span className="text-[#64748b]">Not paid:</span>
                  <span className="font-semibold text-[#0f172a]">{notPaidOrders}</span>
                </div>
                <div className="h-4 w-px bg-[#e5e7eb]" />
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[#64748b]">Showing:</span>
                  <span className="font-semibold text-[#0f172a]">{filteredOrders.length} of {orders.length}</span>
                </div>
              </div>
            </div>
            <CardContent className="p-4 nest-hub-max:p-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading orders...</p>
                  </div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold text-foreground mb-2">No orders found</p>
                  <p className="text-sm text-muted-foreground text-center">
                    {orders.length === 0 
                      ? "No orders in the database. Run the seed script to add sample orders."
                      : "No orders match your current filters."}
                  </p>
                </div>
              ) : view === "table" ? (
                /* ============ PREMIUM REDESIGNED TABLE ============ */
                <div className="overflow-x-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f8fafc] border-b border-[#e5e7eb] hover:bg-[#f8fafc]">
                        <TableHead className="w-12 px-4 py-3">
                          <button
                            onClick={() => {
                              if (selectedOrders.size === filteredOrders.length) {
                                setSelectedOrders(new Set())
                              } else {
                                setSelectedOrders(new Set(filteredOrders.map((o) => o.id)))
                              }
                            }}
                            className="flex items-center justify-center p-1 rounded hover:bg-white/80 transition-colors"
                          >
                            {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? (
                              <CheckSquare className="h-4 w-4 text-[#2563eb]" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Order</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Time</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Service</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Staff</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Payment</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Total</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Status</TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((tx) => {
                        const itemCount = tx.items.reduce((sum, i) => sum + i.quantity, 0)
                        const customerName = (tx as any).customerName || null
                        const customerPhone = (tx as any).customerPhone || null
                        const payStatus = getStatusLabel((tx as any).paymentStatus || tx.status)
                        const isPaid = payStatus === "PAID"
                        const isPartiallyPaid = payStatus === "PARTIALLY_PAID"
                        const cashAmount = (tx as any).cashAmount
                        const cashBalance = (tx as any).cashBalance
                        const total = tx.total ?? 0
                        
                        let paymentDetail = ""
                        if (isPaid && tx.paymentMethod?.toLowerCase() === "cash" && cashAmount != null) {
                          paymentDetail = `Rec: KSh ${cashAmount?.toFixed(2)}`
                          if (cashBalance > 0) paymentDetail += ` • Chg: KSh ${cashBalance?.toFixed(2)}`
                        } else if (isPaid && tx.paymentMethod?.toLowerCase() === "mpesa" && tx.mpesaReceiptNumber) {
                          paymentDetail = `#${tx.mpesaReceiptNumber}`
                        } else if (isPaid && tx.paymentMethod?.toLowerCase() === "glovo" && (tx as any).glovoOrderNumber) {
                          paymentDetail = `Glovo #${(tx as any).glovoOrderNumber}`
                        } else if (isPartiallyPaid && cashAmount != null) {
                          paymentDetail = `Rec: KSh ${cashAmount.toFixed(2)} • Due: KSh ${(total - cashAmount).toFixed(2)}`
                        } else if (payStatus === "NOT_PAID") {
                          paymentDetail = "Not paid"
                        }
                        
                        return (
                          <TableRow 
                            key={tx.id} 
                            className="border-b border-[#f1f5f9] hover:bg-[#f9fafb] transition-colors"
                          >
                            {/* Checkbox */}
                            <TableCell className="px-4 py-3">
                              <button
                                onClick={() => toggleOrderSelection(tx.id)}
                                className="flex items-center justify-center p-1 rounded hover:bg-slate-100 transition-colors"
                              >
                                {selectedOrders.has(tx.id) ? (
                                  <CheckSquare className="h-4 w-4 text-[#2563eb]" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-300 hover:text-slate-500 transition-colors" />
                                )}
                              </button>
                            </TableCell>
                            
                            {/* Order (2-line: Order # + Customer) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-sm font-semibold text-slate-900">#{tx.id}</span>
                                {(customerName || customerPhone) && (
                                  <span className="text-xs text-slate-500 truncate max-w-[180px]">
                                    {customerName}{customerName && customerPhone && " • "}{customerPhone}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            
                            {/* Time (date + time stacked) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm text-slate-700">{tx.timestamp.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
                                <span className="text-xs text-slate-400">
                                  {tx.timestamp.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </TableCell>
                            
                            {/* Service (Type + Table badge if inhouse) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                                  tx.table ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {tx.table ? <UtensilsCrossed className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                                  {tx.table ? "Inhouse" : "Takeout"}
                                </span>
                                {tx.table && (
                                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    T{tx.table}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            
                            {/* Staff (Waiter + Cashier stacked) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-col gap-0.5 text-sm">
                                {tx.waiter && (
                                  <span className="text-slate-700">{tx.waiter}</span>
                                )}
                                {tx.cashier && tx.cashier !== tx.waiter && (
                                  <span className="text-xs text-slate-400">{tx.cashier}</span>
                                )}
                                {!tx.waiter && !tx.cashier && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </TableCell>
                            
                            {/* Payment (method + small secondary info) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <PaymentBadge method={tx.paymentMethod} />
                                {paymentDetail && (
                                  <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                                    {paymentDetail}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            
                            {/* Total (biggest in row, right aligned) */}
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-lg font-bold text-slate-900 tabular-nums">
                                  KSh {(tx.total ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </TableCell>
                            
                            {/* Status (badge) */}
                            <TableCell className="px-4 py-3 text-center">
                              <StatusBadge status={tx.status} />
                            </TableCell>
                            
                            {/* Actions (2 quick + More menu) */}
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <IconButton 
                                  icon={<Eye className="h-4 w-4" />} 
                                  onClick={() => handleViewClick(tx)} 
                                  title="View order"
                                />
                                <IconButton 
                                  icon={<Printer className="h-4 w-4" />} 
                                  onClick={() => handlePrintOrder(tx)} 
                                  title="Print receipt"
                                />
                                <RowActionMenu
                                  order={tx}
                                  onPay={tx.status === "pending" ? () => handlePaymentClick(tx) : undefined}
                                  onEdit={tx.status !== "completed" ? () => handleEditClick(tx) : undefined}
                                  onAddItems={tx.status === "pending" ? () => handleAddItemsClick(tx) : undefined}
                                  onDelete={() => handleDeleteOrder(tx)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 nest-hub-max:gap-2 nest-hub-max:grid-cols-2">
                  {filteredOrders.map((tx) => {
                    const orderSource = (tx as any).orderSource || ((tx as any).cashier === "Customer" && (tx as any).customerPhone ? "menu" : "pos")
                    const orderData = {
                      id: tx.id,
                      timestamp: tx.timestamp,
                      status: tx.status,
                      paymentStatus: getStatusLabel((tx as any).paymentStatus || tx.status),
                      items: tx.items.map((item) => ({
                        name: item.name || "Unknown",
                        quantity: item.quantity || 0,
                        price: item.price || 0,
                      })),
                      subtotal: tx.subtotal ?? null,
                      vat: tx.vat ?? null,
                      total: tx.total ?? null,
                      customerName: (tx as any).customerName || undefined,
                      customerPhone: (tx as any).customerPhone || null,
                      paymentMethod: tx.paymentMethod || null,
                      orderSource,
                      amountReceived: (tx as any).cashAmount || (tx as any).amountReceived || null,
                      receiptCode: tx.mpesaReceiptNumber || (tx as any).receiptCode || null,
                      server: tx.waiter ? { name: tx.waiter } : tx.cashier ? { name: tx.cashier } : null,
                      waiter: tx.waiter,
                      cashier: tx.cashier,
                    }
                    
                    // Accept only shows when not yet accepted (waiter still "Customer")
                const isPendingMenuOrder = tx.status === "pending" && !!(tx as any).customerPhone && ((tx as any).waiter === "Customer" || !(tx as any).waiter)
                    return (
                      <div key={tx.id} className="relative">
                        {isPendingMenuOrder && (
                          <div className="flex items-center justify-between px-3 py-2 rounded-t-xl bg-gradient-to-r from-orange-500 to-amber-500 -mb-1 z-10 relative">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2 w-2 rounded-full bg-white animate-pulse flex-shrink-0" />
                              <span className="text-white text-xs font-bold">Table {tx.table}</span>
                              {(tx as any).customerPhone && (
                                <span className="text-white/80 text-xs font-mono truncate">{(tx as any).customerPhone}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleAcceptMenuOrder(tx.id)}
                              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 flex-shrink-0"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accept
                            </button>
                          </div>
                        )}
                        <OrderCard
                          order={orderData}
                          originalOrder={tx}
                          isSelected={selectedOrders.has(tx.id)}
                          onSelect={toggleOrderSelection}
                          onView={handleViewClick}
                          onPrint={handlePrintOrder}
                          onDelete={canDelete ? handleDeleteOrder : undefined}
                          onPay={tx.status !== "completed" ? handlePaymentClick : undefined}
                          onEdit={canEdit && tx.status !== "completed" ? handleEditClick : undefined}
                          onAddItems={canEdit && tx.status === "pending" ? handleAddItemsClick : undefined}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

      {/* Filter bottom sheet (mobile only) */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl h-auto max-h-[88vh] p-0 gap-0 md:hidden border-0 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        >
          {/* Drag handle + header area for close button */}
          <div className="flex flex-col items-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#cbd5e1]" />
          </div>
          <div className="px-5 pt-1 pb-8 overflow-y-auto">
            <h2 className="text-base font-semibold text-[#0f172a] mb-5">Filters</h2>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Status</p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "PAID", "PARTIALLY_PAID", "NOT_PAID"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setFilterSheetOpen(false) }}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation ${
                        statusFilter === s
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white border-2 border-[#e2e8f0] text-[#475569] active:bg-[#f8fafc]"
                      }`}
                    >
                      {s === "all" ? "All statuses" : s === "PAID" ? "Paid" : s === "PARTIALLY_PAID" ? "Partially paid" : "Not paid"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Payment</p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "cash", "mpesa", "card"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setPaymentFilter(m); setFilterSheetOpen(false) }}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation ${
                        paymentFilter === m
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white border-2 border-[#e2e8f0] text-[#475569] active:bg-[#f8fafc]"
                      }`}
                    >
                      {m === "all" ? "All payments" : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Date</p>
                <div className="flex flex-wrap gap-2">
                  <button className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white shadow-sm touch-manipulation">
                    Today
                  </button>
                  <button className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border-2 border-[#e2e8f0] text-[#475569] active:bg-[#f8fafc] touch-manipulation">
                    Yesterday
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-[#e5e7eb]">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-semibold border-2 border-[#e2e8f0] text-[#475569]"
                onClick={() => { setStatusFilter("all"); setPaymentFilter("all"); setFilterSheetOpen(false) }}
              >
                Reset
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl font-semibold bg-primary hover:bg-primary/90"
                onClick={() => setFilterSheetOpen(false)}
              >
                Apply
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
                        {newItems
                          .map((item) => {
                            const product = products.find((p) => p.id === item.productId)
                            if (!product) {
                              console.warn(`Product with ID ${item.productId} not found`)
                              return null
                            }
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
                        })
                          .filter((item) => item !== null)}
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-semibold">
                              Ksh{" "}
                              {newItems
                                .reduce((sum, item) => {
                                  const product = products.find((p) => p.id === item.productId)
                                  if (!product) return sum
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
                                  const product = products.find((p) => p.id === item.productId)
                                  if (!product) return sum
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
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handlePrintOrder(viewingOrder)}
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print
                </Button>
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
                {viewingOrder.status !== "completed" && viewingOrder.status !== "pending" && (
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
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setViewingOrder(null)
                    handleDeleteOrder(viewingOrder)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
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

      {/* Receipt Modal - Clean Premium Design */}
      <ReceiptModal
        order={printingOrder ? {
          id: printingOrder.id,
          timestamp: printingOrder.timestamp,
          status: printingOrder.status,
          table: printingOrder.table,
          customerName: (printingOrder as any).customerName,
          waiter: printingOrder.waiter,
          cashier: printingOrder.cashier,
          paymentMethod: printingOrder.paymentMethod,
          mpesaReceiptNumber: printingOrder.mpesaReceiptNumber,
          glovoOrderNumber: (printingOrder as any).glovoOrderNumber,
          items: printingOrder.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price ?? 0
          })),
          subtotal: printingOrder.subtotal,
          vat: printingOrder.vat,
          total: printingOrder.total,
          cashAmount: (printingOrder as any).cashAmount,
          cashBalance: (printingOrder as any).cashBalance
        } : null}
        open={!!printingOrder}
        onClose={() => setPrintingOrder(null)}
        businessName="CATHA LODGE"
        businessSubtitle="Restaurant & Bar"
        showQRCode={true}
      />

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
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedPaymentMethod("cash")
                      setCashAmountReceived(processingPayment.total != null ? String(processingPayment.total.toFixed(2)) : "")
                    }}
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
                    onClick={() => setSelectedPaymentMethod("mpesa")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === "mpesa"
                        ? "border-green-500 bg-green-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        selectedPaymentMethod === "mpesa" ? "bg-green-100" : "bg-gray-100"
                      }`}>
                        <Smartphone className={`h-6 w-6 ${selectedPaymentMethod === "mpesa" ? "text-green-600" : "text-gray-600"}`} />
                      </div>
                      <span className={`text-xs font-semibold ${selectedPaymentMethod === "mpesa" ? "text-green-700" : "text-gray-700"}`}>
                        M-Pesa
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {selectedPaymentMethod === "cash" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Amount received (Ksh)</Label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmountReceived}
                    onChange={(e) => setCashAmountReceived(e.target.value)}
                    placeholder={String(processingPayment.total?.toFixed(2) ?? "0")}
                    className="w-full h-11 px-4 rounded-lg border border-[#e5e7eb] bg-white text-sm font-medium"
                  />
                  <p className="text-xs text-[#64748b]">
                    Enter less than total for partial payment. Balance due: Ksh {Math.max(0, (processingPayment.total ?? 0) - (parseFloat(cashAmountReceived) || 0)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => {
                setProcessingPayment(null)
                setSelectedPaymentMethod("")
                setCashAmountReceived("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleProcessPayment}
                disabled={!selectedPaymentMethod}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
              >
                {selectedPaymentMethod === "mpesa" ? (
                  <><Smartphone className="h-4 w-4 mr-2" />Send M-Pesa Request</>
                ) : (
                  <><Wallet2 className="h-4 w-4 mr-2" />Confirm Payment</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* M-Pesa STK Push Dialog */}
      {showMpesaDialog && (
        <Dialog
          open={showMpesaDialog}
          onOpenChange={(open) => {
            if (!open && (pendingMpesaOrderId || mpesaError)) return
            if (!open) {
              setShowMpesaDialog(false)
              setMpesaPhoneNumber("")
              setMpesaError(null)
              setMpesaCheckoutRequestId(null)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
                M-Pesa Payment
              </DialogTitle>
              <DialogDescription>
                {mpesaError
                  ? "Payment error — review the message below and retry or cancel."
                  : "Enter the customer's phone number to send an M-Pesa payment request"}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {mpesaError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      {mpesaError.status === 'CANCELLED' ? 'Payment Cancelled'
                        : mpesaError.status === 'FAILED' ? 'Payment Failed'
                        : mpesaError.status === 'TIMEOUT' ? 'Payment Timeout'
                        : 'Payment Error'}
                    </p>
                    <p className="text-sm text-red-700">{mpesaError.message}</p>
                  </div>
                </div>
              )}

              {pendingMpesaOrderId && !mpesaError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    Waiting for M-Pesa confirmation… Please check the customer's phone.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="orders-mpesa-phone">Customer Phone Number</Label>
                <Input
                  id="orders-mpesa-phone"
                  type="tel"
                  placeholder="0712345678 or 254712345678"
                  value={mpesaPhoneNumber}
                  onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mpesaPhoneNumber.trim() && !mpesaProcessing && !pendingMpesaOrderId) {
                      handleMpesaPayment()
                    }
                  }}
                  autoFocus={!mpesaError}
                  disabled={mpesaProcessing || !!pendingMpesaOrderId}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">Format: 0712345678 or 254712345678</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold text-primary">
                    Ksh {(processingPayment?.total ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                {mpesaError ? (
                  <>
                    <Button
                      onClick={() => { setMpesaError(null); setMpesaCheckoutRequestId(null) }}
                      className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Smartphone className="h-5 w-5 mr-2" />
                      Retry Payment
                    </Button>
                    <Button
                      onClick={() => {
                        setShowMpesaDialog(false)
                        setMpesaPhoneNumber("")
                        setMpesaError(null)
                        setPendingMpesaOrderId(null)
                        setMpesaCheckoutRequestId(null)
                        setMpesaProcessing(false)
                        toast.dismiss("mpesa-push")
                      }}
                      variant="outline"
                      className="h-12 text-base font-semibold"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleMpesaPayment}
                      disabled={!mpesaPhoneNumber.trim() || mpesaProcessing || !!pendingMpesaOrderId}
                      className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                      {mpesaProcessing ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Processing...</span>
                      ) : pendingMpesaOrderId ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Waiting for Payment...</span>
                      ) : (
                        <><Smartphone className="h-5 w-5 mr-2" />Send Payment Request</>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowMpesaDialog(false)
                        setMpesaPhoneNumber("")
                        setMpesaError(null)
                        setPendingMpesaOrderId(null)
                        setMpesaCheckoutRequestId(null)
                        setMpesaProcessing(false)
                        if (mpesaPollIntervalRef.current) {
                          clearInterval(mpesaPollIntervalRef.current)
                          mpesaPollIntervalRef.current = null
                        }
                        toast.dismiss("mpesa-push")
                      }}
                      variant="outline"
                      disabled={mpesaProcessing && !pendingMpesaOrderId && !mpesaError}
                      className="h-12 text-base font-semibold"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
