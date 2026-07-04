"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, MoreHorizontal, Eye, Edit, Truck, Mail, Phone, Building2, MapPin, Calendar, DollarSign, Filter, CheckCircle2, Loader2 } from "lucide-react"
import { ViewSupplierModal } from "./view-supplier-modal"
import { AddSupplierModal } from "./add-supplier-modal"
import { DeliveryModal } from "./delivery-modal"

interface Supplier {
  id: string
  name: string
  category: string
  contact: string
  email: string
  phone: string
  address: string
  balance: number
  status: "active" | "inactive"
  lastDelivery: string | Date | null
}

interface SuppliersTableProps {
  suppliers: Supplier[]
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
  canEdit?: boolean
  canDelete?: boolean
}

export function SuppliersTable({ suppliers = [], isLoading = false, error = null, onRefresh, canEdit = true, canDelete = true }: SuppliersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deliverySupplier, setDeliverySupplier] = useState<Supplier | null>(null)

  const filteredSuppliers = useMemo(() => {
    if (!suppliers || !Array.isArray(suppliers)) {
      return []
    }
    return suppliers.filter((supplier) => {
      const matchesSearch =
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || supplier.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [searchQuery, statusFilter, suppliers])

  return (
    <Card className="border-border/60 bg-gradient-to-br from-white via-white to-sky-50/30 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Filters - Desktop */}
        <div className="hidden md:flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, contact, email, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/70 bg-background/60"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px] rounded-xl border-border/70 bg-background/60">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filters - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/70 bg-white h-10 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-full rounded-xl border-border/70 bg-white h-10 text-sm">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Supplier Cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading suppliers...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive mb-3">{error}</p>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh} className="rounded-lg">
                  Retry
                </Button>
              )}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery || statusFilter !== "all" ? "No suppliers match your filters" : "No suppliers found"}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => {
              const lastDeliveryDate = supplier.lastDelivery
                ? (typeof supplier.lastDelivery === "string" ? new Date(supplier.lastDelivery) : supplier.lastDelivery)
                : null
              return (
                <div
                  key={supplier.id}
                  className="bg-white rounded-xl border border-border/50 p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    <Avatar className="h-12 w-12 border-2 border-border/50 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700 font-bold text-sm">
                        {supplier.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-foreground truncate">{supplier.name}</h3>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{supplier.contact}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem className="rounded-md cursor-pointer text-sm" onClick={() => setViewingSupplier(supplier)}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem className="rounded-md cursor-pointer text-sm" onClick={() => setEditingSupplier(supplier)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canEdit && (
                              <DropdownMenuItem className="rounded-md cursor-pointer text-sm" onClick={() => setDeliverySupplier(supplier)}>
                                <Truck className="mr-2 h-4 w-4" /> Delivery
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] border-border/70 px-1.5 py-0">
                          {supplier.category}
                        </Badge>
                        <Badge
                          className={
                            supplier.status === "active"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0"
                              : "bg-gray-100 text-gray-800 border-gray-300 text-[10px] px-1.5 py-0"
                          }
                        >
                          {supplier.status === "active" && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                          {supplier.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Balance</p>
                      <p className="text-sm font-bold text-amber-700">
                        Ksh {(supplier.balance || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase">Last Delivery</p>
                      <p className="text-xs text-muted-foreground">
                        {lastDeliveryDate
                          ? lastDeliveryDate.toLocaleDateString("en-KE", { month: "short", day: "2-digit", year: "numeric" })
                          : "None"}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-xl border border-border/50 overflow-hidden bg-background/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Supplier</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Category</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Contact</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Balance</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Last Delivery</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading suppliers...
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-destructive">
                    <div className="flex flex-col items-center gap-2">
                      <p>{error}</p>
                      {onRefresh && (
                        <Button variant="outline" size="sm" onClick={onRefresh}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery || statusFilter !== "all" ? "No suppliers match your filters" : "No suppliers found. Add your first supplier!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const lastDeliveryDate = supplier.lastDelivery 
                    ? (typeof supplier.lastDelivery === 'string' ? new Date(supplier.lastDelivery) : supplier.lastDelivery)
                    : null
                  return (
                    <TableRow key={supplier.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 border-border/50">
                            <AvatarFallback className="bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700 font-bold text-sm">
                              {supplier.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{supplier.name}</p>
                            {supplier.address && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {supplier.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-border/70">
                          <Building2 className="h-3 w-3 mr-1" />
                          {supplier.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{supplier.contact}</p>
                          {supplier.email && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 font-bold text-amber-700">
                            <span className="text-xs font-semibold uppercase">Ksh</span>
                            {(supplier.balance || 0).toLocaleString("en-KE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lastDeliveryDate ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {lastDeliveryDate.toLocaleDateString("en-KE", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No deliveries</span>
                        )}
                      </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          supplier.status === "active"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-medium"
                            : "bg-gray-100 text-gray-800 border-gray-300 text-xs font-medium"
                        }
                      >
                        {supplier.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {supplier.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg">
                          <DropdownMenuItem 
                            className="rounded-md cursor-pointer"
                            onClick={() => setViewingSupplier(supplier)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem 
                              className="rounded-md cursor-pointer"
                              onClick={() => setEditingSupplier(supplier)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Supplier
                            </DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem 
                              className="rounded-md cursor-pointer"
                              onClick={() => setDeliverySupplier(supplier)}
                            >
                              <Truck className="mr-2 h-4 w-4" />
                              Record Delivery
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination - Desktop */}
        <div className="hidden md:flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredSuppliers.length}</span> of{" "}
            <span className="font-semibold text-foreground">{Array.isArray(suppliers) ? suppliers.length : 0}</span> suppliers
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

        {/* Pagination - Mobile */}
        <div className="md:hidden flex items-center justify-between pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredSuppliers.length}</span> of{" "}
            <span className="font-semibold text-foreground">{Array.isArray(suppliers) ? suppliers.length : 0}</span> suppliers
          </p>
        </div>
      </CardContent>

      {/* View Supplier Modal */}
      <ViewSupplierModal
        supplier={viewingSupplier}
        open={!!viewingSupplier}
        onOpenChange={(open) => !open && setViewingSupplier(null)}
      />

      {/* Edit Supplier Modal */}
      <AddSupplierModal
        supplier={editingSupplier}
        open={!!editingSupplier}
        onOpenChange={(open) => !open && setEditingSupplier(null)}
        onSuccess={() => {
          setEditingSupplier(null)
          if (onRefresh) onRefresh()
        }}
        onClose={() => setEditingSupplier(null)}
        showTrigger={false}
      />

      {/* Delivery Modal */}
      <DeliveryModal
        supplierId={deliverySupplier?.id}
        supplierName={deliverySupplier?.name}
        open={!!deliverySupplier}
        onOpenChange={(open) => !open && setDeliverySupplier(null)}
        onSuccess={() => {
          setDeliverySupplier(null)
          if (onRefresh) onRefresh()
        }}
        showTrigger={false}
      />
    </Card>
  )
}
