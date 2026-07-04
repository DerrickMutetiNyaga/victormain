"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User } from "lucide-react"
import { staff, type Staff } from "@/lib/dummy-data"

interface WaiterSelectProps {
  value: string
  onValueChange: (value: string) => void
  extendedStaff?: Staff[] // Optional extended staff list that includes logged-in user
}

export function WaiterSelect({ value, onValueChange, extendedStaff }: WaiterSelectProps) {
  const [isMounted, setIsMounted] = useState(false)
  
  // Use extendedStaff if provided, otherwise use default staff
  const staffList = extendedStaff || staff
  
  // Get waiters - only show logged-in user (from extendedStaff) and remove static dummy waiters
  // Filter out static staff members (those with IDs starting with "staff")
  const waiters = useMemo(() => {
    // Filter out static dummy staff (IDs starting with "staff")
    // Only keep the logged-in user (ID starting with "user-")
    const loggedInUser = staffList.filter((s) => s.id.startsWith("user-"))
    
    // If a value is selected and that staff member is not in the list, add them
    if (value) {
      const selectedStaff = staffList.find((s) => s.id === value)
      if (selectedStaff && !loggedInUser.find((w) => w.id === value)) {
        return [...loggedInUser, selectedStaff]
      }
    }
    
    return loggedInUser
  }, [value, staffList])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="w-36 h-10 rounded-xl border-border/50 bg-background/80 flex items-center pl-9">
        <User className="h-3.5 w-3.5 text-muted-foreground mr-2" />
        <span className="text-xs text-muted-foreground">Waiter</span>
      </div>
    )
  }

  // Ensure there's always a value selected (default to first waiter if none selected)
  const selectedValue = value || (waiters.length > 0 ? waiters[0].id : "")

  return (
    <div className="relative">
      <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      <Select value={selectedValue} onValueChange={onValueChange} disabled={waiters.length === 0}>
        <SelectTrigger className="w-36 sm:w-40 min-h-[44px] h-10 pl-9 rounded-xl border-border bg-background/80 shadow-sm hover:shadow-md transition-all">
          <SelectValue placeholder={waiters.length > 0 ? waiters[0].name : "Waiter"} />
        </SelectTrigger>
        <SelectContent>
          {waiters.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

