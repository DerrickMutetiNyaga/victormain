import { getUserInitials } from "@/lib/order-utils"
import { cn } from "@/lib/utils"

interface UserChipProps {
  name?: string | null
  email?: string | null
  role?: string | null
  station?: string | null
  compact?: boolean
  className?: string
}

export function UserChip({ name, email, role, station, compact, className }: UserChipProps) {
  const initials = getUserInitials(name, email)
  const displayName = name || email?.split("@")[0] || "User"

  if (compact) {
    return (
      <div className={cn("flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white text-sm font-semibold shrink-0", className)}>
        {initials}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#e5e7eb]">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-semibold">
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#0f172a]">{displayName}</span>
          {role && <span className="text-xs text-[#64748b]">{role}</span>}
        </div>
      </div>
      {station && (
        <div className="px-3 py-1.5 rounded-lg bg-white border border-[#e5e7eb]">
          <span className="text-xs text-[#64748b]">Station: </span>
          <span className="text-xs font-medium text-[#0f172a]">{station}</span>
        </div>
      )}
    </div>
  )
}

