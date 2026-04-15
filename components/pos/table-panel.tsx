"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users, Clock, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Table {
  id: number
  name?: string
  status: 'available' | 'occupied' | 'reserved'
  guests?: number
  waiter?: string | null
  orderTotal?: number
  capacity?: number
  location?: string
}

interface TablePanelProps {
  open: boolean
  onClose: () => void
  selectedTable: number | null
  onSelect: (table: number) => void
}

export function TablePanel({ open, onClose, selectedTable, onSelect }: TablePanelProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch tables from API when dialog opens
  useEffect(() => {
    if (open) {
      const fetchTables = async () => {
        try {
          setIsLoading(true)
          const response = await fetch('/api/catha/tables')
          const data = await response.json()
          
          if (data.success) {
            setTables(data.tables || [])
          } else {
            // Fallback to empty array if API fails
            setTables([])
          }
        } catch (error) {
          console.error('Error fetching tables:', error)
          setTables([])
        } finally {
          setIsLoading(false)
        }
      }
      
      fetchTables()
    }
  }, [open])

  const availableTables = tables.filter((t) => t.status === "available").length
  const occupiedTables = tables.filter((t) => t.status === "occupied").length
  const reservedTables = tables.filter((t) => t.status === "reserved").length

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Select Table</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-3">
          <div className="rounded-xl bg-success/10 p-2.5 text-center border border-success/20">
            <p className="text-xl font-bold text-success">{availableTables}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Available</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-2.5 text-center border border-destructive/20">
            <p className="text-xl font-bold text-destructive">{occupiedTables}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Occupied</p>
          </div>
          <div className="rounded-xl bg-warning/10 p-2.5 text-center border border-warning/20">
            <p className="text-xl font-bold text-warning">{reservedTables}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Reserved</p>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">No tables found</p>
              <p className="text-sm text-muted-foreground">Create tables in the Table Management page</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => {
                    if (table.status !== "occupied" || table.id === selectedTable) {
                      onSelect(table.id)
                      onClose()
                    }
                  }}
                  disabled={table.status === "occupied" && table.id !== selectedTable}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all aspect-square",
                    "hover:scale-105 active:scale-95",
                    table.status === "available" &&
                      "border-success/30 bg-success/5 hover:border-success hover:bg-success/10",
                    table.status === "occupied" && "border-destructive/30 bg-destructive/5 cursor-not-allowed opacity-60",
                    table.status === "reserved" && "border-warning/30 bg-warning/5 hover:border-warning hover:bg-warning/10",
                    selectedTable === table.id && "border-primary bg-primary/10 ring-2 ring-primary/50 shadow-lg shadow-primary/20",
                  )}
                >
                  <span className="text-lg font-bold text-foreground">{table.id}</span>
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase mt-0.5",
                      table.status === "available" && "text-success",
                      table.status === "occupied" && "text-destructive",
                      table.status === "reserved" && "text-warning",
                    )}
                  >
                    {table.status}
                  </span>

                  {table.guests && table.guests > 0 && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-md">
                      <Users className="h-2.5 w-2.5" />
                    </div>
                  )}

                  {table.status === "reserved" && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-[8px] text-warning font-medium">
                      <Clock className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 border-t border-border/50 bg-card/50 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground font-medium">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <span className="text-[10px] text-muted-foreground font-medium">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-warning" />
            <span className="text-[10px] text-muted-foreground font-medium">Reserved</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
