import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface ActionButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "primary" | "secondary" | "danger"
  icon?: LucideIcon
  children: React.ReactNode
}

export function ActionButton({ variant = "secondary", icon: Icon, className, children, ...props }: ActionButtonProps) {
  const variantClasses = {
    primary: "bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold",
    secondary: "bg-white border border-[#e5e7eb] text-[#0f172a] hover:bg-[#f3f4f6] font-medium",
    danger: "bg-white border border-[#e5e7eb] text-[#dc2626] hover:bg-red-50 hover:border-red-200 font-medium",
  }

  return (
    <Button
      variant="outline"
      className={cn("h-10 rounded-xl", variantClasses[variant], className)}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 mr-1.5" />}
      {children}
    </Button>
  )
}

