"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2, MessageSquareText } from "lucide-react"

interface SmsEventSettings {
  batchCreated: boolean
  packagingCreated: boolean
  distributionCreated: boolean
  distributionDelivered: boolean
}

function normalizeKenyaNumber(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "")
  if (!trimmed) return ""
  const noPlus = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed

  if (/^0\d{9}$/.test(noPlus)) return `+254${noPlus.slice(1)}`
  if (/^254\d{9}$/.test(noPlus)) return `+${noPlus}`
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed
  if (/^\d{8,15}$/.test(noPlus)) return `+${noPlus}`
  return ""
}

export default function SmsNotificationsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [numbers, setNumbers] = useState<string[]>([])
  const [newNumber, setNewNumber] = useState("")
  const [testMessage, setTestMessage] = useState("Jaba SMS test: Zettatel integration is working.")
  const [events, setEvents] = useState<SmsEventSettings>({
    batchCreated: true,
    packagingCreated: true,
    distributionCreated: true,
    distributionDelivered: false,
  })

  useEffect(() => {
    if (!session?.user) return
    if (session.user.role !== "super_admin") {
      router.push("/jaba/unauthorized")
      return
    }
    void fetchSettings()
  }, [session, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/jaba/sms-notifications")
      if (!res.ok) throw new Error("Failed to load SMS settings")
      const data = await res.json()
      setEnabled(Boolean(data.enabled))
      setNumbers(Array.isArray(data.numbers) ? data.numbers : [])
      setEvents({
        batchCreated: Boolean(data.events?.batchCreated),
        packagingCreated: Boolean(data.events?.packagingCreated),
        distributionCreated: Boolean(data.events?.distributionCreated),
        distributionDelivered: Boolean(data.events?.distributionDelivered),
      })
    } catch (error) {
      console.error(error)
      toast.error("Failed to load SMS settings")
    } finally {
      setLoading(false)
    }
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/jaba/sms-notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          numbers,
          events,
        }),
      })
      if (!res.ok) throw new Error("Failed to save SMS settings")
      toast.success("SMS settings saved")
    } catch (error) {
      console.error(error)
      toast.error("Failed to save SMS settings")
    } finally {
      setSaving(false)
    }
  }

  const setEvent = (key: keyof SmsEventSettings, value: boolean) => {
    setEvents((prev) => ({ ...prev, [key]: value }))
  }

  const addNumber = () => {
    const cleaned = normalizeKenyaNumber(newNumber)
    if (!cleaned) return
    if (numbers.includes(cleaned)) {
      toast.error("Number already added")
      return
    }
    setNumbers((prev) => [...prev, cleaned])
    setNewNumber("")
  }

  const removeNumber = (value: string) => {
    setNumbers((prev) => prev.filter((n) => n !== value))
  }

  const onTestSms = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/jaba/sms-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers,
          message: testMessage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test SMS")
      }
      toast.success(`Test SMS sent to ${data.sentTo || 0} number(s)`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to send test SMS")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-emerald-600" />
            SMS Notifications
          </h1>
          <p className="text-sm text-muted-foreground">Super admin control for Zettatel SMS alerts.</p>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Notification Controls</CardTitle>
            <CardDescription>
              Add recipient numbers with country code and choose which events should send SMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <Label className="text-base">Enable SMS notifications</Label>
                <p className="text-sm text-muted-foreground">Turn all Jaba SMS alerts on or off.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Phone numbers</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Textarea
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="+2547XXXXXXXX"
                  rows={2}
                />
                <Button type="button" onClick={addNumber} className="sm:w-36">
                  Add Number
                </Button>
              </div>
              <div className="space-y-2">
                {numbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No numbers added yet.</p>
                ) : (
                  numbers.map((num) => (
                    <div key={num} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">{num}</span>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeNumber(num)}>
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Only valid numbers are saved. Include country code for each number.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Events to notify</Label>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow title="Batch created" checked={events.batchCreated} onChange={(v) => setEvent("batchCreated", v)} />
                <ToggleRow title="Packaging session created" checked={events.packagingCreated} onChange={(v) => setEvent("packagingCreated", v)} />
                <ToggleRow title="Products distributed (delivery note created)" checked={events.distributionCreated} onChange={(v) => setEvent("distributionCreated", v)} />
                <ToggleRow title="Delivered only (status changed to Delivered)" checked={events.distributionDelivered} onChange={(v) => setEvent("distributionDelivered", v)} />
              </div>
            </div>

            <Button onClick={onSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save SMS Settings
            </Button>

            <div className="rounded-xl border p-4 space-y-3">
              <Label>Dummy SMS test</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter test SMS message"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Uses numbers entered above. If empty, saved numbers will be used.
              </p>
              <Button onClick={onTestSms} disabled={testing} variant="outline" className="gap-2">
                {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Test SMS
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  )
}

function ToggleRow({ title, checked, onChange }: { title: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <Label>{title}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
