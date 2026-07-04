"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, AlertTriangle, ArrowLeft, Home, RefreshCw, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UnauthorizedPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const routePermissions = (session?.user as { routePermissions?: string[] })?.routePermissions
  const firstAllowed = routePermissions?.[0] || "/jaba"
  const hasAllowedPages = routePermissions && routePermissions.length > 0
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (status !== "authenticated" || !hasAllowedPages) return
    if (countdown <= 0) {
      router.replace(firstAllowed)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [status, hasAllowedPages, countdown, firstAllowed, router])

  const handleLogout = () => {
    signOut({ callbackUrl: "/jaba/login" })
  }

  const handleReload = async () => {
    await update()
    router.replace(firstAllowed)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-red-50/30 to-emerald-50/80 dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-red-100 dark:bg-red-950/30 w-20 h-20 flex items-center justify-center">
            <Shield className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-emerald-900 dark:text-emerald-50">
            Access Denied
          </CardTitle>
          <CardDescription className="text-base mt-2 text-stone-600 dark:text-stone-400">
            You do not have permission to access this page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Insufficient Permissions
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                  Your account does not have the required permissions to access this page. Please contact your administrator if you believe this is an error.
                </p>
              </div>
            </div>

            {session?.user && (
              <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Signed in as: <span className="font-mono font-medium">{session.user.email}</span>
                </p>
                {session.user.role && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    Role: <span className="font-medium capitalize">{session.user.role}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {hasAllowedPages && countdown > 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-400 text-center">
              Redirecting to your dashboard in {countdown} second{countdown !== 1 ? "s" : ""}…
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-center pt-4">
            {hasAllowedPages && (
              <Button
                variant="default"
                className="gap-2"
                onClick={() => router.replace(firstAllowed)}
              >
                <Home className="h-4 w-4" />
                Go to My Dashboard
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleReload}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

