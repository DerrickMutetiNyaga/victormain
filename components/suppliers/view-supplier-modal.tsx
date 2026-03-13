"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, User, Mail, Phone, MapPin, DollarSign, Calendar, FileText, CheckCircle2, XCircle } from "lucide-react"

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

interface ViewSupplierModalProps {
  supplier: Supplier | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ViewSupplierModal({ supplier, open, onOpenChange }: ViewSupplierModalProps) {
  if (!supplier) return null

  const lastDeliveryDate = supplier.lastDelivery 
    ? (typeof supplier.lastDelivery === 'string' ? new Date(supplier.lastDelivery) : supplier.lastDelivery)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            Supplier Details
          </DialogTitle>
          <DialogDescription>View complete supplier information</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Company Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600" />
                Company Information
              </h3>
              <Badge
                className={
                  supplier.status === "active"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-medium"
                    : "bg-gray-100 text-gray-800 border-gray-300 text-xs font-medium"
                }
              >
                {supplier.status === "active" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </>
                )}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name</p>
                <p className="text-sm font-medium text-foreground">{supplier.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</p>
                <Badge variant="outline" className="text-xs border-border/70">
                  <Building2 className="h-3 w-3 mr-1" />
                  {supplier.category}
                </Badge>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2 pb-3 border-b">
              <User className="h-4 w-4 text-purple-600" />
              Contact Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Contact Person
                </p>
                <p className="text-sm font-medium text-foreground">{supplier.contact}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Phone Number
                </p>
                <p className="text-sm font-medium text-foreground">{supplier.phone}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email Address
                </p>
                <p className="text-sm font-medium text-foreground">{supplier.email || 'Not provided'}</p>
              </div>
              {supplier.address && (
                <div className="space-y-1 col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Business Address
                  </p>
                  <p className="text-sm font-medium text-foreground">{supplier.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Information */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2 pb-3 border-b">
              <DollarSign className="h-4 w-4 text-amber-600" />
              Financial Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding Balance</p>
                <p className="text-2xl font-bold text-amber-700">
                  Ksh {(supplier.balance || 0).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last Delivery
                </p>
                <p className="text-sm font-medium text-foreground">
                  {lastDeliveryDate 
                    ? lastDeliveryDate.toLocaleDateString("en-KE", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : 'No deliveries yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          {supplier.notes && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2 pb-3 border-b">
                <FileText className="h-4 w-4 text-slate-600" />
                Additional Notes
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

