"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Package, AlertTriangle, TrendingDown, TrendingUp, DollarSign, Loader2 } from "lucide-react"

interface Product {
  _id: string
  id: string
  name: string
  category: string
  barcode: string
  cost: number
  price: number
  stock: number
  minStock: number
  unit: string
  size?: string
  supplier: string
  image?: string
}

export function InventoryStats() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
    
    // Listen for inventory update events
    const handleInventoryUpdate = () => {
      fetchProducts()
    }
    
    window.addEventListener('inventory-updated', handleInventoryUpdate)
    
    return () => {
      window.removeEventListener('inventory-updated', handleInventoryUpdate)
    }
  }, [])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/catha/inventory')
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const data = await response.json()
      if (data.success) {
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Error fetching products for stats:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate stats from products
  const totalItems = products.length
  const totalStockValue = products.reduce((sum, p) => sum + (p.cost || 0) * (p.stock || 0), 0)
  const totalSellingValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0)
  const lowStockItems = products.filter((p) => (p.stock || 0) <= (p.minStock || 0))
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0)

  const stats: Array<{
    title: string
    value: string
    subtitle: string
    icon: any
    color: string
    bgColor: string
    borderColor: string
    isCurrency: boolean
  }> = [
  {
    title: "Total Items",
      value: isLoading ? "..." : totalItems.toString(),
    subtitle: "Unique products",
    icon: Package,
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
      isCurrency: false,
  },
  {
    title: "Total Stock Value",
      value: isLoading ? "..." : totalStockValue.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    subtitle: "At cost price",
    icon: DollarSign,
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-200",
      isCurrency: true,
  },
  {
    title: "Potential Value",
      value: isLoading ? "..." : totalSellingValue.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    subtitle: "At selling price",
    icon: TrendingUp,
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
      isCurrency: true,
  },
  {
    title: "Low Stock Items",
      value: isLoading ? "..." : lowStockItems.length.toString(),
    subtitle: "Need reordering",
    icon: AlertTriangle,
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-200",
      isCurrency: false,
  },
  {
      title: "Total Stock Units",
      value: isLoading ? "..." : totalStockUnits.toLocaleString(),
      subtitle: "Total quantity in stock",
    icon: TrendingDown,
    color: "text-violet-700",
    bgColor: "bg-violet-100",
    borderColor: "border-violet-200",
      isCurrency: false,
  },
]

  return (
    <>
      {/* Desktop Stats Grid */}
      <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className={`overflow-hidden border-2 ${stat.borderColor} bg-gradient-to-br from-card to-card/90 shadow-sm hover:shadow-md transition-shadow`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {stat.title}
                  </p>
                  <p className="text-xl font-bold text-foreground mb-1">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin inline-block" />
                    ) : stat.isCurrency ? (
                      <>
                        <span className="text-xl font-bold">Ksh </span>
                        {stat.value}
                      </>
                    ) : (
                      stat.value
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className={`rounded-xl ${stat.bgColor} p-3 shadow-sm flex items-center justify-center flex-shrink-0`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mobile Stats - Horizontal scroll */}
      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              className={`overflow-hidden border ${stat.borderColor} bg-white shadow-sm flex-shrink-0 w-[140px]`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`rounded-lg ${stat.bgColor} p-1.5 flex items-center justify-center`}>
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                    {stat.title}
                  </p>
                </div>
                <p className="text-base font-bold text-foreground truncate">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline-block" />
                  ) : stat.isCurrency ? (
                    <>
                      <span className="text-xs font-semibold">Ksh </span>
                      {stat.value}
                    </>
                  ) : (
                    stat.value
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
