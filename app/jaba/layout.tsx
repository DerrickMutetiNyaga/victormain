"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  Plus,
  Truck,
  FileText,
  Users,
  BarChart3,
  Settings,
  Factory,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Boxes,
  ClipboardCheck,
  Warehouse,
  FileBarChart,
  List,
  CheckSquare,
  PackageSearch,
  TrendingUp,
  Home,
  Cog,
  MoreVertical,
  Circle,
  Menu,
  X,
  Shield,
  QrCode,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { canView, type JabaUserForPermissions } from "@/lib/jaba-permissions"

const navigationGroups = [
  {
    name: "Overview",
    icon: Home,
    items: [
      { name: "Dashboard", href: "/jaba", icon: LayoutDashboard, pageId: "dashboard" },
    ],
  },
  {
    name: "Production",
    icon: Cog,
    items: [
      { name: "Batch Production", href: "/jaba/batches", icon: List, pageId: "batches" },
      { name: "Packaging", href: "/jaba/packaging-output", icon: Boxes, pageId: "packaging" },
      { name: "Quality Control", href: "/jaba/qc/checklist", icon: CheckSquare, pageId: "qc-checklist" },
    ],
  },
  {
    name: "Inventory",
    icon: Package,
    items: [
      { name: "Raw Materials", href: "/jaba/raw-materials", icon: Package, pageId: "raw-materials" },
      { name: "Storage", href: "/jaba/storage/finished", icon: Warehouse, pageId: "storage-finished" },
      { name: "Distribution", href: "/jaba/distribution", icon: FileText, pageId: "distribution" },
    ],
  },
  {
    name: "Partners",
    icon: Users,
    items: [
      { name: "Suppliers & Distributors", href: "/jaba/suppliers", icon: Truck, pageId: "suppliers" },
    ],
  },
  {
    name: "Analytics",
    icon: BarChart3,
    items: [
      { name: "Reports", href: "/jaba/reports/batches", icon: FileBarChart, pageId: "reports-batches" },
      { name: "Barcode Labels", href: "/jaba/barcodes", icon: QrCode, pageId: "barcodes" },
    ],
  },
  {
    name: "System",
    icon: Settings,
    items: [
      { name: "User Management", href: "/jaba/users", icon: Shield, pageId: "users" },
      { name: "Settings", href: "/jaba/settings", icon: Settings, pageId: "settings" },
    ],
  },
]

// Map nav items to permission keys (from jaba-permissions)
const NAV_ITEM_PERMISSION_MAP: Record<string, string> = {
  '/jaba': 'system.dashboard',
  '/jaba/batches': 'production.batches',
  '/jaba/packaging-output': 'production.packaging',
  '/jaba/qc/checklist': 'production.qcChecklist',
  '/jaba/raw-materials': 'production.rawMaterials',
  '/jaba/storage/finished': 'storage.finished',
  '/jaba/distribution': 'distribution.main',
  '/jaba/suppliers': 'distribution.suppliers',
  '/jaba/reports/batches': 'reports.batches',
  '/jaba/barcodes': 'system.dashboard',
  '/jaba/users': 'system.users',
  '/jaba/settings': 'system.settings',
}

function canViewNavItem(href: string, user: JabaUserForPermissions | null): boolean {
  const key = NAV_ITEM_PERMISSION_MAP[href] ?? null
  return canView(key as import("@/lib/jaba-permissions").PermissionKey | null, user)
}

function JabaLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const [mounted, setMounted] = useState(false)
  const [sessionRefreshed, setSessionRefreshed] = useState(false)

  // Refresh session on mount to get latest role (e.g. after being promoted to super_admin)
  useEffect(() => {
    if (status === "authenticated" && !sessionRefreshed && pathname?.startsWith("/jaba") && !pathname?.startsWith("/jaba/login")) {
      updateSession().then(() => setSessionRefreshed(true))
    }
  }, [status, sessionRefreshed, pathname, updateSession])
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [checkingPermissions, setCheckingPermissions] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [meData, setMeData] = useState<JabaUserForPermissions | null>(null)

  const userForPermissions: JabaUserForPermissions | null = meData ?? (session?.user ? {
    role: session.user.role,
    status: (session.user as { status?: string }).status ?? 'active',
    approved: (session.user as { approved?: boolean }).approved ?? false,
    permissions: (session.user as { permissions?: any }).permissions,
  } : null)

  // Filter navigation groups based on permissions
  const filteredNavigationGroups = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canViewNavItem(item.href, userForPermissions)),
      }))
      .filter((group) => group.items.length > 0)
  }, [userForPermissions])

  // Fetch /api/jaba/auth/me on protected layout load for fresh role/status/permissions
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetch('/api/jaba/auth/me')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setMeData({
              role: data.role ?? 'pending',
              status: data.status ?? 'active',
              approved: data.approved ?? false,
              permissions: data.permissions ?? {},
            })
          }
        })
        .catch(() => {})
    }
  }, [status, session?.user?.email])

  // Check permissions on mount and when session changes
  useEffect(() => {
    const checkPermissions = async () => {
      if (status === 'loading') return

      // Allow access to login, signup, waiting, unauthorized, account-suspended
      if (
        pathname === "/jaba/login" ||
        pathname === "/jaba/signup" ||
        pathname === "/jaba/waiting" ||
        pathname === "/jaba/unauthorized" ||
        pathname === "/jaba/account-suspended"
      ) {
        setCheckingPermissions(false)
        setHasAccess(true)
        return
      }

      if (!session?.user) {
        router.push('/jaba/login')
        return
      }

      const role = (session.user.role ?? 'pending').toLowerCase()
      const userStatus = ((session.user as { status?: string }).status ?? 'active').toLowerCase()
      const approved = (session.user as { approved?: boolean }).approved ?? false

      if (userStatus === 'inactive') {
        router.push('/jaba/account-suspended')
        return
      }

      if (role === 'super_admin') {
        setCheckingPermissions(false)
        setHasAccess(true)
        return
      }

      if (role !== 'cashier_admin' && role !== 'manager_admin') {
        router.push('/jaba/waiting')
        return
      }

      if (!approved) {
        router.push('/jaba/waiting')
        return
      }

      try {
        const response = await fetch('/api/jaba/auth/me')
        if (!response.ok) {
          router.push('/jaba/waiting')
          return
        }
        const data = await response.json()
        setMeData({
          role: data.role ?? 'pending',
          status: data.status ?? 'active',
          approved: data.approved ?? false,
          permissions: data.permissions ?? {},
        })
        const perms = data.permissions ?? {}
        const hasViewPermission = Object.values(perms).some((p: any) => p?.view === true)
        if (!hasViewPermission) {
          router.push('/jaba/waiting')
          return
        }
        setHasAccess(true)
      } catch (error) {
        console.error('Error checking permissions:', error)
        router.push('/jaba/waiting')
        return
      } finally {
        setCheckingPermissions(false)
      }
    }

    checkPermissions()
  }, [session, status, pathname, router])

  useEffect(() => {
    if (hasAccess) {
      setMounted(true)
      // Auto-open groups that contain the current path (only on client)
      const initialOpenGroups = navigationGroups
        .filter((group) =>
          group.items.some((item) => pathname === item.href || (item.href !== "/jaba" && pathname.startsWith(item.href)))
        )
        .map((group) => group.name)
      setOpenGroups(initialOpenGroups)
    }
  }, [pathname, hasAccess])

  // Handle mobile/tablet responsiveness
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 1024) // lg breakpoint
      if (width >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [pathname, isMobile])

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) =>
      prev.includes(groupName) ? prev.filter((name) => name !== groupName) : [...prev, groupName]
    )
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/jaba/login" })
  }

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  // Hide sidebar on login, signup, waiting, unauthorized, and account-suspended pages
  const isAuthPage =
    pathname === "/jaba/login" ||
    pathname === "/jaba/signup" ||
    pathname === "/jaba/waiting" ||
    pathname === "/jaba/unauthorized" ||
    pathname === "/jaba/account-suspended"

  // Show loading state while checking permissions
  if (checkingPermissions || !hasAccess) {
    if (isAuthPage) {
      return (
        <div className="min-h-screen bg-background">
          {children}
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-50/90 to-emerald-50/80 dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-emerald-700 dark:text-emerald-300">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F1F5F9] dark:bg-slate-900 overflow-hidden">
      {/* Mobile Hamburger Button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          ) : (
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          )}
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-[rgba(15,23,42,0.45)] z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-transform duration-300 ease-out overflow-hidden",
        isMobile 
          ? (sidebarOpen 
              ? "translate-x-0 w-[80%] max-w-[360px] bg-gradient-to-b from-emerald-50/80 to-emerald-50/60 dark:bg-slate-900 rounded-r-[24px] shadow-[4px_0_24px_rgba(0,0,0,0.12)] border-r border-emerald-200/30 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-emerald-300/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent" 
              : "-translate-x-full")
          : "translate-x-0 w-64 bg-white dark:bg-[#0F172A] shadow-[2px_0_8px_rgba(0,0,0,0.04)]"
      )}>
        <div className="flex h-full flex-col overflow-hidden overflow-x-hidden">
          {/* Mobile Header Bar */}
          {isMobile && (
            <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-200/40 dark:border-slate-800/60 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:bg-slate-900">
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[18px] font-bold text-white truncate leading-tight">
                    Jaba Processing Plant
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20 text-white shrink-0">
                    <Circle className="h-1.5 w-1.5 fill-white text-white" />
                    Operational
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-white/90 truncate mt-0.5">
                  Manufacturing Ops
                </p>
              </div>
            </div>
          )}

          {/* Desktop Compact Plant Header */}
          {!isMobile && (
            <div className="px-4 pt-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <div className="w-full max-w-full box-border rounded-2xl bg-[#F0FDF4] dark:bg-emerald-950/20 p-4 border border-emerald-200/30 dark:border-emerald-800/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0E9F6E] to-emerald-700 shadow-sm border border-emerald-300/20 dark:border-emerald-800 shrink-0">
                    <Factory className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-[15px] font-semibold text-[#334155] dark:text-white leading-tight">
                        Jaba Processing Plant
                      </h1>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-[#0E9F6E] dark:text-emerald-400 shrink-0">
                        <Circle className="h-1.5 w-1.5 fill-[#0E9F6E] text-[#0E9F6E]" />
                        Operational
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] dark:text-slate-400 mt-0.5">
                      Manufacturing Operations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            isMobile ? "px-5 py-5 bg-gradient-to-b from-emerald-50/80 to-emerald-50/60 dark:bg-slate-900 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-emerald-300/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent" : "px-4 py-6"
          )}>
            {filteredNavigationGroups.map((group, index) => {
              const isGroupOpen = mounted && openGroups.includes(group.name)
              const hasActiveItem = group.items.some(
                (item) => pathname === item.href || (item.href !== "/jaba" && pathname.startsWith(item.href))
              )
              const hasMultipleItems = group.items.length > 1

              // Render static content on server, Collapsible on client to avoid hydration mismatch
              if (!mounted) {
                return (
                  <div key={`${group.name}-${index}`} className={cn(
                    "space-y-1.5",
                    index > 0 && (isMobile ? "mt-7 pt-7 border-t border-emerald-200/30 dark:border-slate-800/40" : "mt-6")
                  )}>
                    <div className={cn("px-2 py-2", !isMobile && "px-3 py-1.5")}>
                      <span className={cn(
                        "font-bold uppercase tracking-[0.08em] text-[#064E3B] dark:text-emerald-400",
                        isMobile ? "text-[13px]" : "text-[12px]"
                      )}>
                        {group.name}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={`${group.name}-${index}`} className={cn(
                  "space-y-2",
                  index > 0 && (isMobile ? "mt-7 pt-7 border-t border-emerald-200/30 dark:border-slate-800/40" : "mt-6")
                )}>
                  {hasMultipleItems ? (
                    <Collapsible
                      open={isGroupOpen}
                      onOpenChange={() => toggleGroup(group.name)}
                    >
                      <CollapsibleTrigger className="w-full group">
                        <div className={cn(
                          "flex items-center justify-between w-full rounded-lg transition-colors duration-150",
                          isMobile 
                            ? "px-2 py-2.5 active:bg-emerald-100/30 dark:active:bg-slate-800/30" 
                            : "px-3 py-1.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        )}>
                          <span className={cn(
                            "font-bold uppercase tracking-[0.08em] text-[#064E3B] dark:text-emerald-400 transition-colors",
                            isMobile ? "text-[13px]" : "text-[12px]",
                            !isMobile && "group-hover:text-emerald-700 dark:group-hover:text-emerald-300"
                          )}>
                            {group.name}
                          </span>
                          <ChevronRight 
                            className={cn(
                              "h-3.5 w-3.5 text-[#064E3B] dark:text-emerald-400 transition-all duration-200",
                              isGroupOpen && "rotate-90"
                            )} 
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <div className={cn("space-y-2", isMobile ? "pl-0" : "pl-1")}>
                          {group.items.map((item) => {
                            const isActive =
                              pathname === item.href || (item.href !== "/jaba" && pathname.startsWith(item.href))
                            return (
                              <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                  "group relative flex items-center gap-3 rounded-full transition-all duration-150 ease-out active:scale-[0.98]",
                                  isMobile 
                                    ? "min-h-[52px] px-4 py-3" 
                                    : "px-3 py-2.5",
                                  isActive
                                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg"
                                    : isMobile
                                      ? "text-[#064E3B] dark:text-emerald-300 active:bg-emerald-100/40 dark:active:bg-slate-800/20"
                                      : "text-[#334155] dark:text-slate-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 hover:text-[#0E9F6E] dark:hover:text-emerald-400 hover:translate-x-[2px]",
                                )}
                              >
                                {isActive && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-white/30" />
                                )}
                                <div className={cn(
                                  "flex items-center justify-center transition-colors shrink-0",
                                  isMobile ? "h-5 w-5" : "h-4 w-4",
                                  isActive && "text-white"
                                )}>
                                  <item.icon
                                    className={cn(
                                      "transition-colors",
                                      isMobile ? "h-5 w-5" : "h-4 w-4",
                                      isActive 
                                        ? "text-white" 
                                        : "text-[#064E3B] dark:text-emerald-400",
                                    )}
                                  />
                                </div>
                                <span className={cn(
                                  isMobile ? "text-[16px]" : "text-sm",
                                  "transition-colors flex-1 font-bold leading-snug tracking-[0.2px]",
                                  isActive ? "text-white font-bold" : "text-[#064E3B] dark:text-emerald-300"
                                )}>
                                  {item.name}
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <>
                      <div className={cn("px-2 py-2", !isMobile && "px-3 py-1.5")}>
                        <span className={cn(
                          "font-bold uppercase tracking-[0.08em] text-[#064E3B] dark:text-emerald-400",
                          isMobile ? "text-[13px]" : "text-[12px]"
                        )}>
                          {group.name}
                        </span>
                      </div>
                      <div className={cn("space-y-2", isMobile ? "pl-0" : "pl-1")}>
                        {group.items.map((item) => {
                          const isActive =
                            pathname === item.href || (item.href !== "/jaba" && pathname.startsWith(item.href))
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={cn(
                                "group relative flex items-center gap-3 rounded-full transition-all duration-150 ease-out active:scale-[0.98]",
                                isMobile 
                                  ? "min-h-[52px] px-4 py-3" 
                                  : "px-3 py-2.5",
                                isActive
                                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg"
                                  : isMobile
                                    ? "text-[#064E3B] dark:text-emerald-300 active:bg-emerald-100/40 dark:active:bg-slate-800/20"
                                    : "text-[#334155] dark:text-slate-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 hover:text-[#0E9F6E] dark:hover:text-emerald-400 hover:translate-x-[2px]",
                              )}
                            >
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-white/30" />
                              )}
                              <div className={cn(
                                "flex items-center justify-center transition-colors shrink-0",
                                isMobile ? "h-5 w-5" : "h-4 w-4",
                                isActive && "text-white"
                              )}>
                                <item.icon
                                  className={cn(
                                    "transition-colors",
                                    isMobile ? "h-5 w-5" : "h-4 w-4",
                                    isActive 
                                      ? "text-white" 
                                      : "text-[#064E3B] dark:text-emerald-400",
                                  )}
                                />
                              </div>
                              <span className={cn(
                                isMobile ? "text-[16px]" : "text-sm",
                                "transition-colors flex-1 font-bold leading-snug tracking-[0.2px]",
                                isActive ? "text-white font-bold" : "text-[#064E3B] dark:text-emerald-300"
                              )}>
                                {item.name}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User Profile Section */}
          <div className={cn(
            "border-t border-emerald-200/30 dark:border-slate-800/60",
            isMobile ? "p-5 bg-gradient-to-b from-emerald-50/80 to-emerald-50/60 dark:bg-slate-900 sticky bottom-0" : "p-4"
          )}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  suppressHydrationWarning
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl transition-all duration-150 active:scale-[0.98]",
                    isMobile 
                      ? "p-3 bg-white/80 dark:bg-slate-800/50 shadow-md border border-emerald-200/30 dark:border-slate-700/50"
                      : "p-3 bg-white dark:bg-slate-800/50 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50"
                  )}
                >
                  <Avatar className={cn(
                    "border-2 border-emerald-600/20 dark:border-emerald-500/30 shadow-sm ring-1 ring-emerald-200/30 dark:ring-slate-700/50 shrink-0",
                    isMobile ? "h-10 w-10" : "h-10 w-10"
                  )}>
                    <AvatarImage src={session?.user?.image || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn(
                      "font-bold text-[#064E3B] dark:text-white truncate",
                      isMobile ? "text-[15px]" : "text-sm"
                    )}>
                      {session?.user?.name || "User"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-[#064E3B] dark:text-emerald-400 uppercase tracking-[0.08em]",
                        isMobile ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
                      )}>
                        {session?.user?.role === 'super_admin' ? 'Super Admin' : session?.user?.role ? session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1) : "User"}
                      </span>
                    </div>
                  </div>
                  {!isMobile && (
                    <MoreVertical className="h-4 w-4 text-[#94A3B8] dark:text-slate-500 group-hover:text-[#64748B] dark:group-hover:text-slate-400 transition-colors shrink-0" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Users className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-w-0 w-0 transition-all duration-300",
        isMobile ? "pl-0" : "pl-64"
      )}>
        <div className="w-full h-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function JabaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // SessionProvider is already provided in root layout, no need to nest it
  return <JabaLayoutContent>{children}</JabaLayoutContent>
}
