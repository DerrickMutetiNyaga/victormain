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

export default function SmsNotificationsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [numbers, setNumbers] = useState("")
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
      setNumbers(Array.isArray(data.numbers) ? data.numbers.join(", ") : "")
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
              Add comma-separated numbers (with country code) and choose which events should send SMS.
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
              <Textarea
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                placeholder="+2547XXXXXXXX, +2547YYYYYYYY"
                rows={4}
              />
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
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Environment Variables (.env)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>`ZETTATEL_API_URL` (optional, default is official API URL)</p>
            <p>`ZETTATEL_API_KEY` (optional header auth)</p>
            <p>`ZETTATEL_USER_ID` (required)</p>
            <p>`ZETTATEL_PASSWORD` (required)</p>
            <p>`ZETTATEL_SENDER_ID` (required)</p>
            <p>`ZETTATEL_MSG_TYPE` (optional: `text` or `unicode`, default `text`)</p>
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
