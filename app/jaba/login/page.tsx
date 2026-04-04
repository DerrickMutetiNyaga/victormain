"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { useState, Suspense, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Factory, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

const SESSION_LOAD_TIMEOUT_MS = 2500

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [sessionLoadTimedOut, setSessionLoadTimedOut] = useState(false)
  const callbackUrl = searchParams.get("callbackUrl") || "/jaba"
  const error = searchParams.get("error")
  const hasRedirected = useRef(false)

  // Set auth context to Jaba so NextAuth uses jaba_users only (separate from Catha bar_users)
  useEffect(() => {
    // Set both client-side and server-side cookies
    fetch('/api/auth/jaba-setup').catch(console.error)
    document.cookie = "auth_context=jaba; path=/; max-age=3600"
  }, [])

  // If session check hangs (e.g. provider/endpoint issue), show login form after timeout so user isn't stuck
  useEffect(() => {
    if (status !== "loading") return
    const t = setTimeout(() => setSessionLoadTimedOut(true), SESSION_LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [status])

  // Only redirect if session is for Jaba. Bar (Catha) users would otherwise loop: /jaba -> middleware -> /jaba/login -> redirect /jaba -> ...
  useEffect(() => {
    // Prevent redirect loop: don't redirect if already redirected, if there's an error, or if callbackUrl is login page
    if (hasRedirected.current) {
      console.log(`[Login Jaba] Already redirected, skipping`)
      return
    }
    if (error) {
      console.log(`[Login Jaba] Error present (${error}), not redirecting`)
      return
    }
    if (status === "loading" && !sessionLoadTimedOut) {
      console.log(`[Login Jaba] Session still loading, waiting...`)
      return
    }
    
    // Only proceed if we have a fully loaded session
    if (status === "authenticated" && session?.user) {
      const userCollection = (session.user as { userCollection?: string }).userCollection
      console.log(`[Login Jaba] Session authenticated - userCollection: ${userCollection}, email: ${session.user.email}, role: ${session.user.role}`)
      
      // Only Jaba users can access Jaba. Others are signed out and stay on Jaba login (no cross-app redirect).
      if (userCollection !== "jaba") {
        console.log(`[Login Jaba] Not a Jaba user, clearing session.`)
        signOut({ callbackUrl: "/jaba/login" })
        return
      }
      
      // Only redirect if userCollection is explicitly "jaba"
      if (userCollection === "jaba") {
        let url = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`
        if (url === "/jaba/login" || url.startsWith("/jaba/login?")) {
          url = "/jaba"
        }
        // Redirect to first allowed page if user doesn't have permission for callbackUrl
        const routePermissions = (session.user as { routePermissions?: string[] })?.routePermissions
        const role = session.user.role
        const hasAccess = role === "super_admin" || (routePermissions && routePermissions.some(
          (r) => url === r || url.startsWith(r + "/")
        ))
        if (!hasAccess && routePermissions && routePermissions.length > 0) {
          url = routePermissions[0]
          console.log(`[Login Jaba] CallbackUrl not permitted, redirecting to first allowed: ${url}`)
        } else if (!hasAccess) {
          url = "/jaba"
        }
        if (!hasRedirected.current) {
          hasRedirected.current = true
          console.log(`[Login Jaba] ✅ Redirecting authenticated Jaba user to: ${url}`)
          router.replace(url)
        }
      } else {
        // If userCollection is not "jaba" and not "bar", it might be undefined
        // In this case, don't redirect - let the middleware handle it
        console.log(`[Login Jaba] ⚠️ User collection is "${userCollection}" (not "jaba"), not redirecting. Middleware will handle.`)
        // If userCollection is undefined, the session might not be fully loaded yet
        // Wait a bit and let the session callback set it
        if (!userCollection && status === "authenticated") {
          console.log(`[Login Jaba] ⚠️ Session authenticated but userCollection is undefined. This might be a timing issue.`)
        }
      }
    } else if (status === "unauthenticated") {
      console.log(`[Login Jaba] User is not authenticated, showing login form`)
    }
  }, [session, status, sessionLoadTimedOut, callbackUrl, router, error])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn("google", {
        callbackUrl,
        redirect: true,
      })
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  // Show redirecting only when we have a Jaba session (avoid redirect loop for bar users)
  const userCollection = session?.user ? (session.user as { userCollection?: string }).userCollection : null
  const isJabaSession = session?.user && (userCollection === "jaba" || (!userCollection && session.user.role))
  const showRedirecting = isJabaSession
  const showForm = !showRedirecting && (status !== "loading" || sessionLoadTimedOut)

  if (showRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const getErrorMessage = () => {
    switch (error) {
      case "AccessDenied":
        return "Sign-in blocked: MongoDB connection failed. Users cannot be saved to the database. Please fix the MongoDB connection before signing in."
      case "Configuration":
        return "There is a problem with the server configuration. Please contact support."
      case "Verification":
        return "The verification token has expired or has already been used."
      default:
        return "An error occurred during sign in. Please check the server logs for details."
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-full p-3 bg-red-600/10">
              <Factory className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Jaba Production System
          </CardTitle>
          <CardDescription className="text-gray-600">
            Sign in to access the production dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Sign In Error</h3>
                  <p className="text-sm text-red-700">{getErrorMessage()}</p>
                  {error === "AccessDenied" && (
                    <div className="mt-3 text-xs text-red-600 space-y-1">
                      <p className="font-semibold">⚠️ MongoDB Connection Issue:</p>
                      <p className="mt-1">Sign-in is blocked until MongoDB connection is fixed. Check your server logs for details.</p>
                      <p className="mt-2 font-semibold">To fix:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Check MongoDB Atlas → Network Access (IP whitelist)</li>
                        <li>Verify cluster is running (not paused)</li>
                        <li>Get Standard Connection String (non-SRV) from MongoDB Atlas</li>
                        <li>Update MONGODB_URI in .env file</li>
                        <li>Restart dev server</li>
                        <li>Run: <code className="bg-red-100 px-1 rounded">npm run test-db</code> to verify</li>
                      </ol>
                      <p className="mt-2 text-xs text-gray-600">
                        See <code className="bg-gray-100 px-1 rounded">MONGODB_CONNECTION_FIX.md</code> for detailed instructions.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-[#10B981] to-[#0E9F6E] hover:from-[#0E9F6E] hover:to-[#10B981] text-white font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </span>
            )}
          </Button>
          <div className="text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/jaba/signup" className="text-[#10B981] hover:underline font-semibold">
              Sign up
            </Link>
          </div>
          <p className="text-xs text-center text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
