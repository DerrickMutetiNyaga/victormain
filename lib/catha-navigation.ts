/**
 * CATHA navigation config - single source for sidebar.
 * Each item has permissionKey (canonical). Filter with canView(user, item.permissionKey).
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Users,
  Receipt,
  Grid3X3,
  QrCode,
  Wallet2,
  Smartphone,
  UserCircle2,
  UserPlus2,
} from 'lucide-react'
import type { CanonicalPermissionKey } from './catha-access'

export interface CathaNavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  permissionKey: CanonicalPermissionKey
}

export interface CathaNavSection {
  title: string
  items: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; permissionKey: CanonicalPermissionKey }[]
}

export const CATHA_NAV_ITEMS: CathaNavItem[] = [
  { name: 'Dashboard', href: '/catha', icon: LayoutDashboard, color: 'indigo', permissionKey: 'system.dashboard' },
  { name: 'POS Sales', href: '/catha/pos', icon: ShoppingCart, color: 'emerald', permissionKey: 'sales.posSales' },
  { name: 'Orders', href: '/catha/orders', icon: Receipt, color: 'indigo', permissionKey: 'sales.orders' },
  { name: 'Tables', href: '/catha/tables', icon: Grid3X3, color: 'blue', permissionKey: 'operations.tables' },
  { name: 'Table QR Codes', href: '/catha/qr-tables', icon: QrCode, color: 'emerald', permissionKey: 'operations.tableQrCodes' },
  { name: 'Inventory', href: '/catha/inventory', icon: Package, color: 'amber', permissionKey: 'inventory.inventory' },
  { name: 'Suppliers', href: '/catha/suppliers', icon: Truck, color: 'sky', permissionKey: 'inventory.suppliers' },
  { name: 'Stock Movement', href: '/catha/stock-movement', icon: ArrowLeftRight, color: 'violet', permissionKey: 'inventory.stockMovement' },
  { name: 'M-Pesa Transactions', href: '/catha/mpesa-transactions', icon: Smartphone, color: 'emerald', permissionKey: 'financial.mpesaTransactions' },
  { name: 'Expenses', href: '/catha/expenses', icon: Wallet2, color: 'rose', permissionKey: 'financial.expenses' },
  { name: 'Clients', href: '/catha/clients', icon: UserCircle2, color: 'sky', permissionKey: 'management.clients' },
  { name: 'User Management', href: '/catha/users', icon: Users, color: 'amber', permissionKey: 'system.userManagement' },
  { name: 'Distributor Requests', href: '/catha/distributor-requests', icon: UserPlus2, color: 'violet', permissionKey: 'management.distributorRequests' },
  { name: 'Reports', href: '/catha/reports', icon: BarChart3, color: 'rose', permissionKey: 'system.reports' },
  { name: 'Settings', href: '/catha/settings', icon: Settings, color: 'slate', permissionKey: 'system.settings' },
]

export const CATHA_NAV_SECTIONS: CathaNavSection[] = [
  {
    title: 'Main',
    items: [
      { name: 'Dashboard', href: '/catha', icon: LayoutDashboard, permissionKey: 'system.dashboard' },
      { name: 'POS Sales', href: '/catha/pos', icon: ShoppingCart, permissionKey: 'sales.posSales' },
      { name: 'Orders', href: '/catha/orders', icon: Receipt, permissionKey: 'sales.orders' },
      { name: 'Tables', href: '/catha/tables', icon: Grid3X3, permissionKey: 'operations.tables' },
      { name: 'Table QR Codes', href: '/catha/qr-tables', icon: QrCode, permissionKey: 'operations.tableQrCodes' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { name: 'Inventory', href: '/catha/inventory', icon: Package, permissionKey: 'inventory.inventory' },
      { name: 'Suppliers', href: '/catha/suppliers', icon: Truck, permissionKey: 'inventory.suppliers' },
      { name: 'Stock Movement', href: '/catha/stock-movement', icon: ArrowLeftRight, permissionKey: 'inventory.stockMovement' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { name: 'M-Pesa Transactions', href: '/catha/mpesa-transactions', icon: Smartphone, permissionKey: 'financial.mpesaTransactions' },
      { name: 'Expenses', href: '/catha/expenses', icon: Wallet2, permissionKey: 'financial.expenses' },
      { name: 'Reports', href: '/catha/reports', icon: BarChart3, permissionKey: 'system.reports' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { name: 'Clients', href: '/catha/clients', icon: UserCircle2, permissionKey: 'management.clients' },
      { name: 'User Management', href: '/catha/users', icon: Users, permissionKey: 'system.userManagement' },
      { name: 'Distributor Requests', href: '/catha/distributor-requests', icon: UserPlus2, permissionKey: 'management.distributorRequests' },
      { name: 'Settings', href: '/catha/settings', icon: Settings, permissionKey: 'system.settings' },
    ],
  },
]
