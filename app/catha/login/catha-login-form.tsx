'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Mode = 'admin' | 'cashier'

export function CathaLoginForm({ callbackUrl, error }: { callbackUrl: string; error?: string }) {
  const [mode, setMode] = useState<Mode>('admin')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pinInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (mode === 'cashier' && pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }, [mode])

  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl })
  }

  const validatePin = (value: string): string | null => {
    if (!/^\d{4}$/.test(value)) {
      return 'PIN must be exactly 4 digits'
    }
    return null
  }

  const handlePinChange = (value: string) => {
    const numeric = value.replace(/\D/g, '').slice(0, 4)
    setPin(numeric)
    setPinError(null)
  }

  const handleCashierSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const err = validatePin(pin)
    if (err) {
      setPinError(err)
      return
    }
    setSubmitting(true)
    try {
      await signIn('catha-pin', {
        pin,
        callbackUrl,
        redirect: true,
      })
    } catch (e) {
      setSubmitting(false)
      setPinError('Invalid PIN')
    }
  }

  const showError =
    error &&
    (mode === 'admin' ||
      (mode === 'cashier' && !pinError))

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 rounded-xl">
          <TabsTrigger value="admin" className="text-xs sm:text-sm">
            Admin / Staff
          </TabsTrigger>
          <TabsTrigger value="cashier" className="text-xs sm:text-sm">
            Cashier
          </TabsTrigger>
        </TabsList>

        {showError && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">
            {error === 'OAuthAccountNotLinked'
              ? 'This email is already linked to another account.'
              : 'Sign-in failed. Try again.'}
          </p>
        )}

        <TabsContent value="admin" className="mt-0 space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
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
            Sign in with Google
          </button>
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Use your Google account for full admin and staff access.
          </p>
        </TabsContent>

        <TabsContent value="cashier" className="mt-0">
          <form
            onSubmit={handleCashierSubmit}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Cashier PIN
              </label>
              <Input
                ref={pinInputRef}
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                autoComplete="one-time-code"
                className="h-12 text-center text-2xl tracking-[0.35em] caret-transparent rounded-xl"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
              />
              {pinError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {pinError}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-semibold"
            >
              {submitting ? 'Signing in…' : 'Quick Access'}
            </Button>
            <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
              PIN access is restricted to active Catha cashiers.
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
