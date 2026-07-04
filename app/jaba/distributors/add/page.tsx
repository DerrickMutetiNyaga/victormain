"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Truck, Building2, User, Phone, Mail, MapPin, Package, TrendingUp, Calendar, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function AddDistributorPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    region: "",
    address: "",
    volumeMonthly: "",
    deliveryFrequency: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.name || !formData.contactPerson || !formData.phone) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/jaba/distributors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          contactPerson: formData.contactPerson.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || "",
          address: formData.address.trim() || "",
          region: formData.region.trim() || "",
          volumeMonthly: formData.volumeMonthly ? Number(formData.volumeMonthly) : 0,
          deliveryFrequency: formData.deliveryFrequency || "",
          notes: formData.notes.trim() || "",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create distributor')
      }

      toast.success(`Distributor "${formData.name}" created successfully!`)
      router.push('/jaba/distributors')
    } catch (error: any) {
      console.error('Error creating distributor:', error)
      toast.error(error.message || 'Failed to create distributor. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Distributor</h1>
            <p className="text-sm text-muted-foreground">Create a new distribution partner</p>
          </div>
        </div>
        <Link href="/jaba/distributors">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Distributor Information */}
          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-900/50">
              <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                  <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Distributor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="distributorName" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Distributor Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="distributorName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter distributor name"
                  required
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500"
                />
              </div>
            </CardContent>
          </Card>

        {/* Contact Information */}
        <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-blue-200 dark:border-blue-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                Contact Person *
              </Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Contact person name"
                required
                className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 555-0000"
                  required
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="region" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Region
                </Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="Region"
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Address
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this distributor..."
                className="min-h-[80px] border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Distribution Details */}
        <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-violet-50/30 dark:from-purple-950/20 dark:to-violet-950/10 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-b border-purple-200 dark:border-purple-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Distribution Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="volumeMonthly" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  Volume Purchased Monthly
                </Label>
                <Input
                  id="volumeMonthly"
                  type="number"
                  value={formData.volumeMonthly}
                  onChange={(e) => setFormData({ ...formData, volumeMonthly: e.target.value })}
                  placeholder="0"
                  min="0"
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Total units per month</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryFrequency" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  Delivery Frequency
                </Label>
                <Select value={formData.deliveryFrequency} onValueChange={(value) => setFormData({ ...formData, deliveryFrequency: value })}>
                  <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
            <Link href="/jaba/distributors">
              <Button 
                type="button"
                variant="outline" 
                disabled={isSubmitting}
                className="border-2 border-slate-300 dark:border-slate-700 h-11 px-6 font-semibold"
              >
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30 text-white h-11 px-6 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Distributor
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
