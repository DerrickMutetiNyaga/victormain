"use client"

import { staff } from "@/lib/dummy-data"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StaffSelectorProps {
  type: "cashier" | "waiter"
  value: string
  onChange: (value: string) => void
}

export function StaffSelector({ type, value, onChange }: StaffSelectorProps) {
  const filteredStaff = staff.filter((s) =>
    type === "cashier" ? ["cashier", "manager", "admin"].includes(s.role) : s.role === "waiter",
  )

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={`Select ${type}`} />
      </SelectTrigger>
      <SelectContent>
        {filteredStaff.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-[10px]">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span>{member.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
