"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Filter, ArrowUpCircle, ArrowDownCircle, Calendar, Package, User, Hash, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StockMovement {
  id: string
  productId: string
  productName: string
  movementType: "inflow" | "outflow"
  reason: string
  quantity: number
  previousStock: number
  newStock: number
  supplier?: string
  reference: string
  date: string
  user: string
}

interface MovementTableProps {
  movements: StockMovement[]
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
}

export function MovementTable({ movements = [], isLoading = false, error = null, onRefresh }: MovementTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [reasonFilter, setReasonFilter] = useState("all")

  const filteredMovements = useMemo(() => {
    if (!movements || !Array.isArray(movements)) {
      return []
    }
    return movements.filter((movement) => {
      const matchesSearch =
        movement.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.user.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === "all" || movement.movementType === typeFilter
      const matchesReason = reasonFilter === "all" || movement.reason === reasonFilter
      return matchesSearch && matchesType && matchesReason
    })
  }, [searchQuery, typeFilter, reasonFilter, movements])

  const getReasonBadgeColor = (reason: string, type: string) => {
    if (type === "inflow") {
      switch (reason) {
        case "delivery":
          return "bg-emerald-100 text-emerald-800 border-emerald-300"
        case "return":
          return "bg-blue-100 text-blue-800 border-blue-300"
        default:
          return "bg-emerald-100 text-emerald-800 border-emerald-300"
      }
    } else {
      switch (reason) {
        case "sale":
          return "bg-amber-100 text-amber-800 border-amber-300"
        case "wastage":
          return "bg-red-100 text-red-800 border-red-300"
        case "transfer":
          return "bg-purple-100 text-purple-800 border-purple-300"
        default:
          return "bg-amber-100 text-amber-800 border-amber-300"
      }
    }
  }

  return (
    <Card className="border-border/60 bg-gradient-to-br from-white via-white to-violet-50/30 shadow-lg rounded-2xl">
      <CardContent className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product, reference, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/70 bg-background/60"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] rounded-xl border-border/70 bg-background/60">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inflow">Inflow</SelectItem>
              <SelectItem value="outflow">Outflow</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-[160px] rounded-xl border-border/70 bg-background/60">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="wastage">Wastage</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="return">Return</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-border/70 bg-background/60 hover:bg-background hover:border-primary/40"
          >
            <Calendar className="h-4 w-4" />
            Date Range
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/50 overflow-hidden bg-background/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Type</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Product</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Reason</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Quantity</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Previous</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">New Stock</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Reference</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">Date</TableHead>
                <TableHead className="font-semibold uppercase text-xs tracking-wider">User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading movements...
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-destructive">
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
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchQuery || typeFilter !== "all" || reasonFilter !== "all" ? "No movements match your filters" : "No movements found. Record your first stock movement!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => {
                  const movementDate = new Date(movement.date)
                  return (
                    <TableRow key={movement.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div
                          className={cn(
                            "flex items-center gap-2 font-medium",
                            movement.movementType === "inflow" ? "text-emerald-700" : "text-red-700",
                          )}
                        >
                          {movement.movementType === "inflow" ? (
                            <ArrowDownCircle className="h-5 w-5" />
                          ) : (
                            <ArrowUpCircle className="h-5 w-5" />
                          )}
                          <span className="capitalize">{movement.movementType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{movement.productName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize text-xs font-medium border", getReasonBadgeColor(movement.reason, movement.movementType))}>
                          {movement.reason}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-bold",
                          movement.movementType === "inflow" ? "text-emerald-700" : "text-red-700",
                        )}
                      >
                        {movement.movementType === "inflow" ? "+" : "-"}
                        {movement.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-medium">
                        {movement.previousStock.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {movement.newStock.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <code className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
                            {movement.reference}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <div>
                            <div>{movementDate.toLocaleDateString("en-KE", { month: "short", day: "2-digit", year: "numeric" })}</div>
                            <div className="text-[10px]">{movementDate.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {movement.user}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredMovements.length}</span> of{" "}
            <span className="font-semibold text-foreground">{Array.isArray(movements) ? movements.length : 0}</span> movements
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
