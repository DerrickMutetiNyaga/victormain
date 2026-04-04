"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Eye, Truck, Package, Search, Filter, LayoutGrid, List, Loader2, Calendar, Hash, FileText, DollarSign, CheckCircle2, Edit, Trash2, MoreVertical, Printer, Download } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface DeliveryNote {
  _id: string
  id: string
  noteId: string
  distributorId: string
  distributorName: string
  items: Array<{
    finishedGoodId: string
    productName: string
    flavor: string
    productType: string
    size: "250ml" | "500ml" | "1L" | "2L"
    batchNumber: string
    packageNumber: string
    quantity: number
    pricePerUnit?: number
    totalCost?: number
  }>
  totalCost?: number
  vehicle?: string
  driver?: string
  driverPhone?: string
  notes?: string
  date: string | Date
  status: "Pending" | "In Transit" | "Delivered"
  paymentStatus?: "Unpaid" | "Partial" | "Paid"
  paymentDate?: string | Date
  createdAt: string | Date
  updatedAt: string | Date
}

export default function DistributionPage() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [viewingNote, setViewingNote] = useState<DeliveryNote | null>(null)
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null)
  const [deletingNote, setDeletingNote] = useState<DeliveryNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editChoiceNote, setEditChoiceNote] = useState<DeliveryNote | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Fetch delivery notes from API
  useEffect(() => {
    fetchDeliveryNotes()
  }, [])

  const fetchDeliveryNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/jaba/delivery-notes')
      const data = await response.json()
      
      if (response.ok && data.deliveryNotes) {
        setDeliveryNotes(data.deliveryNotes)
      } else {
        toast.error('Failed to load delivery notes')
      }
    } catch (error) {
      console.error('Error fetching delivery notes:', error)
      toast.error('Failed to load delivery notes')
    } finally {
      setLoading(false)
    }
  }

  // Filter and search delivery notes
  const filteredNotes = useMemo(() => {
    return deliveryNotes.filter((note) => {
      const matchesSearch = 
        note.noteId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.distributorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.items.some(item => 
          item.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.productName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      const matchesStatus = statusFilter === "all" || note.status === statusFilter
      const matchesPayment = paymentFilter === "all" || (note.paymentStatus || "Unpaid") === paymentFilter
      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [deliveryNotes, searchQuery, statusFilter, paymentFilter])

  // Calculate statistics
  const pendingNotes = deliveryNotes.filter((dn) => dn.status === "Pending")
  const inTransitNotes = deliveryNotes.filter((dn) => dn.status === "In Transit")
  const deliveredNotes = deliveryNotes.filter((dn) => dn.status === "Delivered")
  const totalItems = deliveryNotes.reduce((sum, note) => 
    sum + note.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  )
  const unpaidNotes = deliveryNotes.filter((dn) => (dn.paymentStatus || "Unpaid") === "Unpaid")
  const paidNotes = deliveryNotes.filter((dn) => (dn.paymentStatus || "Unpaid") === "Paid")
  const totalOutstanding = deliveryNotes
    .filter((dn) => (dn.paymentStatus || "Unpaid") !== "Paid")
    .reduce((sum, note) => sum + (note.totalCost || 0), 0)
  const totalPaid = deliveryNotes
    .filter((dn) => (dn.paymentStatus || "Unpaid") === "Paid")
    .reduce((sum, note) => sum + (note.totalCost || 0), 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      case "In Transit":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      case "Pending":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      default:
        return "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
    }
  }

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    })
  }

  const handleMarkAsPaid = async (noteId: string) => {
    try {
      const response = await fetch('/api/jaba/delivery-notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: noteId,
          paymentStatus: 'Paid',
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Payment marked as received!')
        fetchDeliveryNotes() // Refresh the list
      } else {
        toast.error(data.error || 'Failed to update payment status')
      }
    } catch (error) {
      console.error('Error updating payment status:', error)
      toast.error('Failed to update payment status')
    }
  }

  const handleDelete = async () => {
    if (!deletingNote) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/jaba/delivery-notes?id=${deletingNote._id || deletingNote.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Delivery note deleted successfully!')
        setDeletingNote(null)
        fetchDeliveryNotes() // Refresh the list
      } else {
        toast.error(data.error || 'Failed to delete delivery note')
      }
    } catch (error) {
      console.error('Error deleting delivery note:', error)
      toast.error('Failed to delete delivery note')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStatusUpdate = async (newStatus: "Pending" | "In Transit" | "Delivered") => {
    if (!editChoiceNote) return

    try {
      setUpdatingStatus(true)
      const response = await fetch('/api/jaba/delivery-notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editChoiceNote._id || editChoiceNote.id,
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`Status updated to ${newStatus}!`)
        setEditChoiceNote(null)
        fetchDeliveryNotes() // Refresh the list
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handlePrintDeliveryNote = (note: DeliveryNote) => {
    const totalQuantity = note.items.reduce((sum, item) => sum + item.quantity, 0)
    const noteTotalCost = note.totalCost || note.items.reduce((sum, item) => sum + (item.totalCost || (item.quantity * (item.pricePerUnit || 0))), 0)
    const paymentStatus = note.paymentStatus || "Unpaid"
    const statusColor = note.status === "Delivered" ? "#10b981" : note.status === "In Transit" ? "#3b82f6" : "#f59e0b"

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to print delivery notes')
      return
    }

    const itemsHtml = note.items.map((item) => {
      const displayName = item.productName || 
        (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
        (item.flavor ? item.flavor : 'Product'))
      const itemCost = item.quantity * (item.pricePerUnit || 0)
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${displayName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.size}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.batchNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.packageNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity.toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">KES ${(item.pricePerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">KES ${itemCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Note ${note.noteId}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: white;
              padding: 30px;
              color: #1f2937;
            }
            .header {
              border-bottom: 3px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
            }
            .company-info h1 {
              font-size: 28px;
              color: #10b981;
              font-weight: 800;
              margin-bottom: 5px;
            }
            .company-info p {
              font-size: 12px;
              color: #6b7280;
            }
            .note-info {
              text-align: right;
            }
            .note-id {
              font-size: 24px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 5px;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              background: ${statusColor}15;
              color: ${statusColor};
              border: 1px solid ${statusColor}40;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-box {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #10b981;
            }
            .info-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: 700;
              margin-bottom: 5px;
            }
            .info-value {
              font-size: 14px;
              font-weight: 600;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background: #10b981;
              color: white;
              padding: 12px 10px;
              text-align: left;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
            }
            th:last-child {
              text-align: right;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .total-section {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 2px solid #10b981;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .grand-total {
              font-size: 20px;
              font-weight: 800;
              color: #10b981;
              padding-top: 10px;
              border-top: 2px solid #e5e7eb;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            .signature-section {
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
            }
            .signature-box {
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
            .signature-label {
              font-size: 11px;
              color: #6b7280;
              margin-top: 50px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="company-info">
                <h1>JABA JUICE</h1>
                <p>Delivery Note</p>
              </div>
              <div class="note-info">
                <div class="note-id">${note.noteId}</div>
                <div class="status-badge">${note.status}</div>
                <p style="margin-top: 10px; font-size: 11px; color: #6b7280;">Date: ${formatDate(note.date)}</p>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Distributor</div>
              <div class="info-value">${note.distributorName}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Payment Status</div>
              <div class="info-value">${paymentStatus}</div>
            </div>
            ${note.vehicle ? `
            <div class="info-box">
              <div class="info-label">Vehicle</div>
              <div class="info-value">${note.vehicle}</div>
            </div>
            ` : ''}
            ${note.driver ? `
            <div class="info-box">
              <div class="info-label">Driver</div>
              <div class="info-value">${note.driver}${note.driverPhone ? ` (${note.driverPhone})` : ''}</div>
            </div>
            ` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Size</th>
                <th style="text-align: center;">Batch</th>
                <th style="text-align: center;">Package</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span style="font-weight: 600;">Total Items:</span>
              <span style="font-weight: 700;">${totalQuantity.toLocaleString()} bottles</span>
            </div>
            ${noteTotalCost > 0 ? `
            <div class="grand-total">
              <div class="total-row">
                <span>Grand Total:</span>
                <span>KES ${noteTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            ` : ''}
          </div>

          ${note.notes ? `
          <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; margin-bottom: 5px;">Notes</div>
            <div style="font-size: 13px; color: #1f2937;">${note.notes}</div>
          </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Prepared By:</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Received By:</div>
            </div>
          </div>

          <div class="footer">
            <p>This is a computer-generated delivery note. No signature required.</p>
            <p style="margin-top: 5px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleDownloadDeliveryNote = (note: DeliveryNote) => {
    const totalQuantity = note.items.reduce((sum, item) => sum + item.quantity, 0)
    const noteTotalCost = note.totalCost || note.items.reduce((sum, item) => sum + (item.totalCost || (item.quantity * (item.pricePerUnit || 0))), 0)
    const paymentStatus = note.paymentStatus || "Unpaid"
    const statusColor = note.status === "Delivered" ? "#10b981" : note.status === "In Transit" ? "#3b82f6" : "#f59e0b"

    const itemsHtml = note.items.map((item) => {
      const displayName = item.productName || 
        (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
        (item.flavor ? item.flavor : 'Product'))
      const itemCost = item.quantity * (item.pricePerUnit || 0)
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${displayName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.size}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.batchNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.packageNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity.toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">KES ${(item.pricePerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">KES ${itemCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Note ${note.noteId}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: white;
              padding: 30px;
              color: #1f2937;
            }
            .header {
              border-bottom: 3px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
            }
            .company-info h1 {
              font-size: 28px;
              color: #10b981;
              font-weight: 800;
              margin-bottom: 5px;
            }
            .company-info p {
              font-size: 12px;
              color: #6b7280;
            }
            .note-info {
              text-align: right;
            }
            .note-id {
              font-size: 24px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 5px;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              background: ${statusColor}15;
              color: ${statusColor};
              border: 1px solid ${statusColor}40;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-box {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #10b981;
            }
            .info-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: 700;
              margin-bottom: 5px;
            }
            .info-value {
              font-size: 14px;
              font-weight: 600;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background: #10b981;
              color: white;
              padding: 12px 10px;
              text-align: left;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
            }
            th:last-child {
              text-align: right;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .total-section {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 2px solid #10b981;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .grand-total {
              font-size: 20px;
              font-weight: 800;
              color: #10b981;
              padding-top: 10px;
              border-top: 2px solid #e5e7eb;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            .signature-section {
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
            }
            .signature-box {
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
            .signature-label {
              font-size: 11px;
              color: #6b7280;
              margin-top: 50px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="company-info">
                <h1>JABA JUICE</h1>
                <p>Delivery Note</p>
              </div>
              <div class="note-info">
                <div class="note-id">${note.noteId}</div>
                <div class="status-badge">${note.status}</div>
                <p style="margin-top: 10px; font-size: 11px; color: #6b7280;">Date: ${formatDate(note.date)}</p>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Distributor</div>
              <div class="info-value">${note.distributorName}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Payment Status</div>
              <div class="info-value">${paymentStatus}</div>
            </div>
            ${note.vehicle ? `
            <div class="info-box">
              <div class="info-label">Vehicle</div>
              <div class="info-value">${note.vehicle}</div>
            </div>
            ` : ''}
            ${note.driver ? `
            <div class="info-box">
              <div class="info-label">Driver</div>
              <div class="info-value">${note.driver}${note.driverPhone ? ` (${note.driverPhone})` : ''}</div>
            </div>
            ` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Size</th>
                <th style="text-align: center;">Batch</th>
                <th style="text-align: center;">Package</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span style="font-weight: 600;">Total Items:</span>
              <span style="font-weight: 700;">${totalQuantity.toLocaleString()} bottles</span>
            </div>
            ${noteTotalCost > 0 ? `
            <div class="grand-total">
              <div class="total-row">
                <span>Grand Total:</span>
                <span>KES ${noteTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            ` : ''}
          </div>

          ${note.notes ? `
          <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; margin-bottom: 5px;">Notes</div>
            <div style="font-size: 13px; color: #1f2937;">${note.notes}</div>
          </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Prepared By:</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Received By:</div>
            </div>
          </div>

          <div class="footer">
            <p>This is a computer-generated delivery note. No signature required.</p>
            <p style="margin-top: 5px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Delivery_Note_${note.noteId}_${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('Delivery note downloaded successfully!')
  }

  const getPaymentStatusColor = (status?: string) => {
    switch (status || "Unpaid") {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      case "Partial":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      case "Unpaid":
        return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800"
      default:
        return "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
    }
  }

  if (loading) {
    return (
      <>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Distribution Management</h1>
            <p className="text-sm text-muted-foreground">Manage deliveries and distribution</p>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="text-muted-foreground">Loading delivery notes...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Distribution Management</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Manage deliveries and distribution</p>
        </div>
        <Link href="/jaba/distribution/create">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
            <Plus className="mr-2 h-4 w-4" />
            Create Delivery Note
          </Button>
        </Link>
      </header>

      <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Pending Distribution</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-2">{pendingNotes.length}</p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Package className="h-3 w-3" />
                    <span>Awaiting dispatch</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">In Transit</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">{inTransitNotes.length}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Truck className="h-3 w-3" />
                    <span>Currently shipping</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50">
                  <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Delivered</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">{deliveredNotes.length}</p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <Truck className="h-3 w-3" />
                    <span>Completed deliveries</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50">
                  <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Total Items</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">{totalItems.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <Package className="h-3 w-3" />
                    <span>Bottles distributed</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50">
                  <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary Cards */}
          <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Unpaid</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100 mb-1">{unpaidNotes.length}</p>
                  <p className="text-lg font-semibold text-red-800 dark:text-red-200">
                    KES {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50">
                  <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Paid</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 mb-1">{paidNotes.length}</p>
                  <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                    KES {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl p-3 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800/50">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Toggle */}
        <Card className="border-0 bg-white dark:bg-slate-900 shadow-md">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-1 gap-3 w-full md:w-auto">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by note ID, distributor, batch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500">
                    <Filter className="mr-2 h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-[180px] h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500">
                    <DollarSign className="mr-2 h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "h-9",
                    viewMode === "table" 
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-50" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
                  )}
                >
                  <List className="mr-2 h-4 w-4" />
                  Table
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "h-9",
                    viewMode === "grid" 
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-50" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
                  )}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Grid
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Notes List */}
        {filteredNotes.length === 0 ? (
          <Card className="border-0 bg-white dark:bg-slate-900 shadow-md">
            <CardContent className="p-12 text-center">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Truck className="h-10 w-10 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">No delivery notes found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your filters" 
                  : "Create your first delivery note to get started"}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <Card className="border-0 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Delivery Notes ({filteredNotes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Note ID</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Distributor</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Items</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Quantity</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Date</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Vehicle/Driver</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Cost</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Payment</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5">Status</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide py-3.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotes.map((note, index) => {
                      const totalQuantity = note.items.reduce((sum, item) => sum + item.quantity, 0)
                      const noteTotalCost = note.totalCost || note.items.reduce((sum, item) => sum + (item.totalCost || (item.quantity * (item.pricePerUnit || 0))), 0)
                      const paymentStatus = note.paymentStatus || "Unpaid"
                      const isEven = index % 2 === 0
                      return (
                        <TableRow 
                          key={note._id || note.id} 
                          className={cn(
                            "transition-colors border-b border-slate-200 dark:border-slate-700",
                            isEven 
                              ? "bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20" 
                              : "bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                          )}
                        >
                          <TableCell className="py-5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <FileText className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-50">{note.noteId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-50">{note.distributorName}</span>
                              {note.notes && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{note.notes}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col gap-1.5 max-w-xs">
                              {note.items.slice(0, 2).map((item, idx) => {
                                const displayName = item.productName || 
                                  (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
                                  (item.flavor ? item.flavor : 'Product'))
                                return (
                                  <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                      {item.size}
                                    </span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{displayName}</span>
                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-50">{item.quantity}</span>
                                  </div>
                                )
                              })}
                              {note.items.length > 2 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2">+{note.items.length - 2} more</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                              <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">{totalQuantity.toLocaleString()}</span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-500">bottles</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(note.date)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col gap-1 text-xs">
                              {note.vehicle && (
                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                  <Truck className="h-3 w-3" />
                                  <span>{note.vehicle}</span>
                                </div>
                              )}
                              {note.driver && (
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500">
                                  <span>{note.driver}</span>
                                  {note.driverPhone && (
                                    <span className="text-slate-400 dark:text-slate-600">• {note.driverPhone}</span>
                                  )}
                                </div>
                              )}
                              {!note.vehicle && !note.driver && (
                                <span className="text-slate-400 dark:text-slate-600">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            {noteTotalCost > 0 ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-50">
                                  KES {noteTotalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col gap-1.5">
                              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold w-fit", getPaymentStatusColor(paymentStatus))}>
                                {paymentStatus}
                              </Badge>
                              {paymentStatus !== "Paid" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(note._id || note.id)}
                                  className="h-6 text-[10px] px-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold", getStatusColor(note.status))}>
                              {note.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                >
                                  <MoreVertical className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => setViewingNote(note)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditChoiceNote(note)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeletingNote(note)}
                                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredNotes.map((note) => {
              const totalQuantity = note.items.reduce((sum, item) => sum + item.quantity, 0)
              const noteTotalCost = note.totalCost || note.items.reduce((sum, item) => sum + (item.totalCost || (item.quantity * (item.pricePerUnit || 0))), 0)
              const paymentStatus = note.paymentStatus || "Unpaid"
              return (
                <Card 
                  key={note._id || note.id}
                  className="relative overflow-hidden border-0 bg-white dark:bg-slate-900 shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                >
                  {/* Status Indicator Bar */}
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    note.status === "Pending" && "bg-amber-500",
                    note.status === "In Transit" && "bg-blue-500",
                    note.status === "Delivered" && "bg-emerald-500"
                  )} />
                  
                  <CardHeader className="pb-4 pt-5 px-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <FileText className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 truncate leading-tight">{note.noteId}</CardTitle>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{note.distributorName}</p>
                          </div>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold uppercase tracking-wide flex-shrink-0", getStatusColor(note.status))}>
                        {note.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(note.date)}</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="px-5 pb-5 space-y-4">
                    {/* Key Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Items</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{totalQuantity.toLocaleString()}</p>
                      </div>
                      {noteTotalCost > 0 ? (
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Cost</p>
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                            KES {(noteTotalCost / 1000).toFixed(0)}K
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Items</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{totalQuantity.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Payment Status */}
                    {noteTotalCost > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold", getPaymentStatusColor(paymentStatus))}>
                          {paymentStatus}
                        </Badge>
                        {paymentStatus !== "Paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsPaid(note._id || note.id)
                            }}
                            className="h-6 text-[10px] px-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Items Preview */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Products</p>
                      <div className="space-y-1.5">
                        {note.items.slice(0, 2).map((item, idx) => {
                          const displayName = item.productName || 
                            (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
                            (item.flavor ? item.flavor : 'Product'))
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-slate-50 dark:bg-slate-800/30">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                  {item.size}
                                </span>
                                <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{displayName}</span>
                              </div>
                              <span className="font-bold text-slate-900 dark:text-slate-50 ml-2">{item.quantity}</span>
                            </div>
                          )
                        })}
                        {note.items.length > 2 && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center py-1">
                            +{note.items.length - 2} more
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setViewingNote(note)}
                          className="h-8 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setEditChoiceNote(note)}
                          className="h-8 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeletingNote(note)}
                          className="h-8 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* View Details Modal */}
        <Dialog open={!!viewingNote} onOpenChange={() => setViewingNote(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Delivery Note Details</DialogTitle>
                    <DialogDescription>Complete information about this delivery note</DialogDescription>
                  </div>
                </div>
                {viewingNote && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintDeliveryNote(viewingNote)}
                      className="h-9"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDeliveryNote(viewingNote)}
                      className="h-9"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>
            {viewingNote && (() => {
              const totalQuantity = viewingNote.items.reduce((sum, item) => sum + item.quantity, 0)
              const noteTotalCost = viewingNote.totalCost || viewingNote.items.reduce((sum, item) => sum + (item.totalCost || (item.quantity * (item.pricePerUnit || 0))), 0)
              const paymentStatus = viewingNote.paymentStatus || "Unpaid"
              return (
                <div className="space-y-6 py-4">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Note ID</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{viewingNote.noteId}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Distributor</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{viewingNote.distributorName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Date</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{formatDate(viewingNote.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</p>
                      <Badge className={cn("text-xs px-2 py-0.5 font-semibold", getStatusColor(viewingNote.status))}>
                        {viewingNote.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Items ({viewingNote.items.length})</h3>
                      <div className="px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{totalQuantity.toLocaleString()} bottles</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {viewingNote.items.map((item, idx) => {
                        const displayName = item.productName || 
                          (item.productType && item.flavor ? `${item.productType} of ${item.flavor}` : 
                          (item.flavor ? item.flavor : 'Product'))
                        return (
                          <div key={idx} className="p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
                                  {item.size}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{displayName}</span>
                              </div>
                              <span className="text-base font-bold text-slate-900 dark:text-slate-50">× {item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                <span>Batch: {item.batchNumber || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                <span>PKG: {item.packageNumber && item.packageNumber.startsWith('PKG-') ? item.packageNumber : (item.packageNumber || 'N/A')}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Payment & Cost */}
                  {noteTotalCost > 0 && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Cost</p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                          KES {noteTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={cn("text-xs px-2 py-0.5 font-semibold", getPaymentStatusColor(paymentStatus))}>
                          {paymentStatus}
                        </Badge>
                        {paymentStatus !== "Paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleMarkAsPaid(viewingNote._id || viewingNote.id)
                              setViewingNote(null)
                            }}
                            className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark as Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Vehicle & Driver */}
                  {(viewingNote.vehicle || viewingNote.driver) && (
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-3">Delivery Information</h3>
                      <div className="space-y-2 text-sm">
                        {viewingNote.vehicle && (
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Truck className="h-4 w-4" />
                            <span className="font-medium">Vehicle:</span>
                            <span>{viewingNote.vehicle}</span>
                          </div>
                        )}
                        {viewingNote.driver && (
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <span className="font-medium">Driver:</span>
                            <span>{viewingNote.driver}</span>
                            {viewingNote.driverPhone && (
                              <span className="text-slate-500 dark:text-slate-400">({viewingNote.driverPhone})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewingNote.notes && (
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-2">Notes</h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{viewingNote.notes}</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Choice Dialog */}
        <Dialog open={!!editChoiceNote} onOpenChange={(open) => !open && setEditChoiceNote(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Edit className="h-5 w-5 text-emerald-600" />
                Edit Delivery Note
              </DialogTitle>
              <DialogDescription>
                Choose what you want to edit for <strong>{editChoiceNote?.noteId}</strong>
              </DialogDescription>
            </DialogHeader>
            {editChoiceNote && (
              <div className="space-y-3 py-4">
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-start gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700"
                  onClick={() => {
                    window.location.href = `/jaba/distribution/create?edit=${editChoiceNote._id || editChoiceNote.id}`
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-slate-900 dark:text-slate-50">Edit Delivery Details</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Modify items, distributor, vehicle, driver, or notes
                      </div>
                    </div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-start gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-700"
                  onClick={() => {
                    setEditingNote(editChoiceNote)
                    setEditChoiceNote(null)
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-slate-900 dark:text-slate-50">Update Status</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Change delivery status (Current: <strong>{editChoiceNote.status}</strong>)
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                Update Delivery Status
              </DialogTitle>
              <DialogDescription>
                Change the status for delivery note <strong>{editingNote?.noteId}</strong>
              </DialogDescription>
            </DialogHeader>
            {editingNote && (
              <div className="space-y-4 py-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Status</p>
                  <Badge className={cn("text-xs px-2 py-0.5 font-semibold", getStatusColor(editingNote.status))}>
                    {editingNote.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Select New Status</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(["Pending", "In Transit", "Delivered"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={editingNote.status === status ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start h-auto py-3",
                          editingNote.status === status 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                        onClick={() => handleStatusUpdate(status)}
                        disabled={editingNote.status === status || updatingStatus}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {status === "Pending" && <Package className="h-4 w-4" />}
                          {status === "In Transit" && <Truck className="h-4 w-4" />}
                          {status === "Delivered" && <CheckCircle2 className="h-4 w-4" />}
                          <span className="font-medium">{status}</span>
                          {editingNote.status === status && (
                            <span className="ml-auto text-xs">(Current)</span>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                
                {updatingStatus && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating status...</span>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete delivery note <strong>{deletingNote?.noteId}</strong> for <strong>{deletingNote?.distributorName}</strong>.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingNote(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  )
}
