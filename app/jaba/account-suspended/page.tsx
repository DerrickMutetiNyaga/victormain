"use client"

import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function AccountSuspendedPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-50/90 to-emerald-50/80 dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-50/90 to-emerald-50/80 dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-rose-100 dark:bg-rose-950/30 w-20 h-20 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-rose-900 dark:text-rose-50">
            Account suspended
          </CardTitle>
          <CardDescription className="text-base mt-2 text-stone-600 dark:text-stone-400">
            Your account has been suspended. Please contact an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {session?.user && (
            <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Signed in as: <span className="font-mono font-medium">{session.user.email}</span>
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/jaba/login" })}
            >
              Sign out
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/jaba/login">Back to login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
