export type OrderStatusLegacy = "PENDING" | "IN_PROGRESS" | "RECEIVED" | "CANCELLED"
export type OrderStatus = "draft" | "active" | "sent" | "paid" | "cancelled"
export type PaymentStatus = "UNPAID" | "PAID"
export type PaymentMethod = "mpesa" | "cash" | "pending"

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
  inStock: boolean
  tag?: string
  isPopular?: boolean
  isJaba?: boolean
  brand?: string
}

export interface CartItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  image?: string
  notes?: string
}

export interface Order {
  orderId: string
  createdAt: number
  updatedAt?: number
  tableId: string
  tableNumber?: string // alias for tableId
  customerNumber?: string | null
  customerPhone?: string
  guestSessionId?: string | null // for guest orders (device-session based)
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
  items: CartItem[]
  total: number
  subtotal?: number
  lastSentAt?: number // when "Send Now" was clicked
  receivedBy?: string
  cancelledReason?: string
}

export interface MenuCategory {
  id: string
  name: string
  icon?: string
}
