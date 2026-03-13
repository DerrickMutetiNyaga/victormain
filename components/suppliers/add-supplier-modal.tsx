"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Building2, User, Mail, Phone, MapPin, DollarSign, Tag, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Supplier {
  id: string
  name: string
  category: string
  contact: string
  email: string
  phone: string
  address: string
  balance: number
  status: "active" | "inactive"
  lastDelivery: string | Date | null
  notes?: string
}

interface AddSupplierModalProps {
  supplier?: Supplier | null
  onSuccess?: () => void
  onClose?: () => void
  showTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddSupplierModal({ supplier, onSuccess, onClose, showTrigger = true, open: controlledOpen, onOpenChange }: AddSupplierModalProps) {
  const isEditing = !!supplier
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
    balance: "",
    notes: "",
    status: "active" as "active" | "inactive",
  })

  // Populate form when editing
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        category: supplier.category,
        contact: supplier.contact,
        email: supplier.email || "",
        phone: supplier.phone,
        address: supplier.address || "",
        balance: (supplier.balance || 0).toString(),
        notes: supplier.notes || "",
        status: supplier.status,
      })
      setOpen(true)
    }
  }, [supplier])

  const handleSubmit = async () => {
    if (!formData.name || !formData.category || !formData.contact || !formData.phone) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsSaving(true)
      const url = '/api/catha/suppliers'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(isEditing && { id: supplier.id }),
          name: formData.name,
          category: formData.category,
          contact: formData.contact,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          balance: formData.balance || 0,
          notes: formData.notes,
          status: formData.status,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'create'} supplier`)
      }

      const data = await response.json()
      if (data.success) {
        toast.success(`Supplier ${isEditing ? 'updated' : 'added'} successfully`, {
          description: `${formData.name} has been ${isEditing ? 'updated' : 'added to your suppliers list'}.`,
        })
        
        // Reset form
        setFormData({
          name: "",
          category: "",
          contact: "",
          email: "",
          phone: "",
          address: "",
          balance: "",
          notes: "",
          status: "active",
        })
        setOpen(false)
        
        // Refresh suppliers list
        if (onSuccess) {
          onSuccess()
        }
        if (onClose) {
          onClose()
        }
      }
    } catch (error: any) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} supplier:`, error)
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} supplier`, {
        description: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && !isEditing && (
        <DialogTrigger asChild>
          <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm h-10 text-xs md:text-sm flex-1 sm:flex-none">
            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Add Supplier</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto w-[calc(100%-2rem)] md:w-full rounded-xl">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</div>
              <DialogDescription className="text-sm font-normal mt-1">
                {isEditing ? 'Update supplier information' : 'Create a new supplier entry in your system'}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Company Information Section */}
          <Card className="border-2 border-sky-200/50 bg-gradient-to-br from-sky-50/50 to-blue-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-sky-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Company Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Building2 className="h-4 w-4 text-sky-600" />
                    Company Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Premium Spirits Ltd"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="rounded-lg border-2 focus:border-sky-500 h-11"
                  />
            </div>
            <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Tag className="h-4 w-4 text-sky-600" />
                    Category *
                  </Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="rounded-lg border-2 focus:border-sky-500 h-11">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spirits">Spirits</SelectItem>
                  <SelectItem value="wine">Wine & Champagne</SelectItem>
                  <SelectItem value="beer">Beer</SelectItem>
                  <SelectItem value="soft-drinks">Soft Drinks</SelectItem>
                  <SelectItem value="cocktails">Cocktail Supplies</SelectItem>
                  <SelectItem value="artisan">Artisan/Jaba</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
            </CardContent>
          </Card>

          {/* Contact Information Section */}
          <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50/50 to-pink-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-purple-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Contact Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="contact" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 text-purple-600" />
                    Contact Person *
                  </Label>
                  <Input
                    id="contact"
                    placeholder="Full name"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="rounded-lg border-2 focus:border-purple-500 h-11"
                  />
            </div>
            <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 text-purple-600" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="rounded-lg border-2 focus:border-purple-500 h-11"
                  />
            </div>
          </div>

            <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Phone className="h-4 w-4 text-purple-600" />
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="rounded-lg border-2 focus:border-purple-500 h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Location & Financial Section */}
          <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-amber-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Location & Financial</h3>
            </div>

            <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-amber-600" />
                  Business Address *
                </Label>
                <Textarea
                  id="address"
                  placeholder="Full business address including street, city, and postal code"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="rounded-lg border-2 focus:border-amber-500 min-h-[100px] resize-none"
                />
          </div>

          <div className="space-y-2">
                <Label htmlFor="balance" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  Opening Balance (Ksh)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Ksh</span>
                  <Input
                    id="balance"
                    type="number"
                    placeholder="0.00"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="rounded-lg border-2 focus:border-amber-500 h-11 pl-14"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter any outstanding balance owed to this supplier
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes Section */}
          <Card className="border-2 border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-gray-50/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-slate-700" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Additional Notes</h3>
          </div>

          <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-slate-600" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Payment terms, delivery schedule, special agreements, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="rounded-lg border-2 focus:border-slate-500 min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add any important information about payment terms, delivery schedules, or special agreements
                </p>
          </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent -mx-6 px-6 pb-6">
          <Button variant="outline" onClick={() => {
            setOpen(false)
            setFormData({
              name: "",
              category: "",
              contact: "",
              email: "",
              phone: "",
              address: "",
              balance: "",
              notes: "",
              status: "active",
            })
            if (onClose) onClose()
          }} className="rounded-xl h-11 font-semibold">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 h-11 font-semibold shadow-lg disabled:opacity-50">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Supplier' : 'Add Supplier'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
