import { cn } from "@/lib/utils"

interface OrderMetaRowProps {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}

export function OrderMetaRow({ left, right, className }: OrderMetaRowProps) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-[#64748b]">{left}</span>
      <span className="text-[#0f172a] font-medium">{right}</span>
    </div>
  )
}

