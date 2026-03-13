"use client"

import { useState, useMemo, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  UserPlus2,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Phone,
  Mail,
  Package,
  Calendar,
  MapPin,
  FileText,
  Eye,
  Clock,
  Check,
  X,
} from "lucide-react"

export interface DistributorRequest {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address?: string
  products: string
  status: "pending" | "approved" | "rejected"
  submittedAt: Date
  reviewedAt?: Date
  notes?: string
}

const defaultRequests: DistributorRequest[] = [
  {
    id: "1",
    name: "Premium Spirits Ltd",
    contact: "John Mwangi",
    email: "sales@premiumspirits.co.ke",
    phone: "0722 111 333",
    address: "Westlands, Nairobi",
    products: "Whisky, Vodka, Gin",
    status: "pending",
    submittedAt: new Date("2024-12-15"),
    notes: "Specializes in premium imported spirits",
  },
  {
    id: "2",
    name: "Craft Beer Co.",
    contact: "Sarah Wanjiku",
    email: "info@craftbeer.co.ke",
    phone: "0700 222 444",
    address: "Kilimani, Nairobi",
    products: "Craft Beer, Local Brews",
    status: "approved",
    submittedAt: new Date("2024-12-10"),
    reviewedAt: new Date("2024-12-12"),
    notes: "Local craft brewery with excellent quality",
  },
  {
    id: "3",
    name: "Soft Drinks Distributors",
    contact: "Peter Ochieng",
    email: "support@softdrinks.co.ke",
    phone: "0799 555 777",
    address: "Industrial Area, Nairobi",
    products: "Mixers, Energy Drinks, Juices",
    status: "rejected",
    submittedAt: new Date("2024-12-05"),
    reviewedAt: new Date("2024-12-07"),
    notes: "Does not meet quality standards",
  },
  {
    id: "4",
    name: "Wine Importers Kenya",
    contact: "Mary Kamau",
    email: "contact@wineimporters.co.ke",
    phone: "0711 888 999",
    address: "Karen, Nairobi",
    products: "Premium Wines, Champagne",
    status: "pending",
    submittedAt: new Date("2024-12-18"),
    notes: "Exclusive wine distributor",
  },
  {
    id: "5",
    name: "Bar Supplies Pro",
    contact: "David Kipchoge",
    email: "sales@barsupplies.co.ke",
    phone: "0723 444 555",
    address: "Parklands, Nairobi",
    products: "Bar Equipment, Glassware, Accessories",
    status: "pending",
    submittedAt: new Date("2024-12-20"),
    notes: "Complete bar supply solutions",
  },
]

export default function DistributorRequestsPage() {
  const [requests, setRequests] = useState<DistributorRequest[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("distributorRequests")
      if (saved) {
        return JSON.parse(saved).map((r: any) => ({
          ...r,
          submittedAt: new Date(r.submittedAt),
          reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : undefined,
        }))
      }
    }
    return defaultRequests
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | DistributorRequest["status"]>("all")
  const [viewingRequest, setViewingRequest] = useState<DistributorRequest | null>(null)

  // Save to localStorage whenever requests change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("distributorRequests", JSON.stringify(requests))
    }
  }, [requests])

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.products.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || req.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [requests, searchQuery, statusFilter])

  const handleApprove = (id: string) => {
    if (confirm("Are you sure you want to approve this distributor request?")) {
      setRequests(
        requests.map((req) =>
          req.id === id
            ? {
                ...req,
                status: "approved" as const,
                reviewedAt: new Date(),
              }
            : req,
        ),
      )
    }
  }

  const handleReject = (id: string) => {
    if (confirm("Are you sure you want to reject this distributor request?")) {
      setRequests(
        requests.map((req) =>
          req.id === id
            ? {
                ...req,
                status: "rejected" as const,
                reviewedAt: new Date(),
              }
            : req,
        ),
      )
    }
  }

  const getStatusBadgeColor = (status: DistributorRequest["status"]) => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-300"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-300"
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }
  }, [requests])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Distributor Requests" subtitle="Review and manage supplier partnership requests" />

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center">
                    <UserPlus2 className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.pending}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.approved}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.rejected}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Card */}
          <Card className="border-border/60 bg-gradient-to-br from-white via-white to-violet-50/30 shadow-lg rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Incoming Requests</CardTitle>
                  <CardDescription className="mt-1">Review and approve distributors before they can supply you</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by company name, contact, email, or products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-border/70 bg-background/60"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border/70 bg-background/60">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Requests Table */}
              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/40">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/70">
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Company</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Contact</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Products</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Submitted</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider">Status</TableHead>
                      <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((req) => (
                        <TableRow key={req.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-5 w-5 text-violet-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-foreground">{req.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Mail className="h-3 w-3" />
                                  {req.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-foreground font-medium">{req.contact}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {req.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-foreground">{req.products}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              {req.submittedAt.toLocaleDateString()}
                              <br />
                              <span className="text-[10px]">{req.submittedAt.toLocaleTimeString()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusBadgeColor(req.status)} border text-xs font-medium capitalize`}>
                              {req.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                              {req.status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {req.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                              {req.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingRequest(req)}
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {req.status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleApprove(req.id)}
                                    className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReject(req.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Request Details Modal */}
        <Dialog open={!!viewingRequest} onOpenChange={() => setViewingRequest(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-violet-600" />
                {viewingRequest?.name}
              </DialogTitle>
              <DialogDescription>Distributor request details and information</DialogDescription>
            </DialogHeader>
            {viewingRequest && (
              <div className="space-y-6 py-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge className={`${getStatusBadgeColor(viewingRequest.status)} border text-sm font-medium capitalize px-3 py-1`}>
                    {viewingRequest.status === "pending" && <Clock className="h-4 w-4 mr-1.5" />}
                    {viewingRequest.status === "approved" && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    {viewingRequest.status === "rejected" && <XCircle className="h-4 w-4 mr-1.5" />}
                    {viewingRequest.status}
                  </Badge>
                  {viewingRequest.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleReject(viewingRequest.id)
                          setViewingRequest(null)
                        }}
                        className="gap-1.5 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleApprove(viewingRequest.id)
                          setViewingRequest(null)
                        }}
                        className="gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>

                {/* Company Information */}
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Company Name</p>
                        <p className="text-sm font-medium text-foreground">{viewingRequest.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Contact Person</p>
                        <p className="text-sm font-medium text-foreground">{viewingRequest.contact}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{viewingRequest.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{viewingRequest.phone}</span>
                      </div>
                      {viewingRequest.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{viewingRequest.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Products */}
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Products
                    </h3>
                    <p className="text-sm text-foreground">{viewingRequest.products}</p>
                  </div>

                  {/* Dates */}
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Timeline
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                        <p className="text-sm font-medium text-foreground">
                          {viewingRequest.submittedAt.toLocaleDateString()} at {viewingRequest.submittedAt.toLocaleTimeString()}
                        </p>
                      </div>
                      {viewingRequest.reviewedAt && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Reviewed</p>
                          <p className="text-sm font-medium text-foreground">
                            {viewingRequest.reviewedAt.toLocaleDateString()} at {viewingRequest.reviewedAt.toLocaleTimeString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewingRequest.notes && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notes
                      </h3>
                      <p className="text-sm text-foreground">{viewingRequest.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setViewingRequest(null)} className="rounded-lg">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
