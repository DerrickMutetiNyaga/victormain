"use client"

import { cn } from "@/lib/utils"
import { tables } from "@/lib/dummy-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"

interface TableSelectorProps {
  selectedTable: number | null
  onSelect: (table: number) => void
}

export function TableSelector({ selectedTable, onSelect }: TableSelectorProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Users className="h-4 w-4" />
          {selectedTable ? `Table ${selectedTable}` : "Select Table"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Table</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-3 p-4">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => onSelect(table.id)}
              disabled={table.status === "occupied" && table.id !== selectedTable}
              className={cn(
                "relative flex h-20 flex-col items-center justify-center rounded-xl border-2 transition-all",
                table.status === "available" && "border-border bg-secondary hover:border-primary",
                table.status === "occupied" && "border-destructive/50 bg-destructive/10",
                table.status === "reserved" && "border-warning/50 bg-warning/10",
                selectedTable === table.id && "border-primary bg-primary/20",
              )}
            >
              <span className="text-lg font-bold text-card-foreground">{table.id}</span>
              <span
                className={cn(
                  "text-xs capitalize",
                  table.status === "available" && "text-chart-2",
                  table.status === "occupied" && "text-destructive",
                  table.status === "reserved" && "text-warning",
                )}
              >
                {table.status}
              </span>
              {table.guests > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {table.guests}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-chart-2" />
            <span className="text-xs text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Reserved</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
