"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Plus, X, Loader2, Building2, Phone, Package } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function AddSupplierPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [supplierName, setSupplierName] = useState("")
  const [category, setCategory] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [items, setItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState("")

  const addItem = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      setItems([...items, newItem.trim()])
      setNewItem("")
    }
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const getCategoryOptions = () => {
    return ["Raw/Packaging Materials", "Raw Material", "Packaging", "Others"]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!supplierName || !category || !contactPerson || !phone) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/jaba/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: supplierName.trim(),
          category: category,
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim() || "",
          address: address.trim() || "",
          itemsSupplied: items,
        }),
      })

      // Clone response to read it multiple times if needed
      const responseClone = response.clone()
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await responseClone.text()
        console.error('Non-JSON response from suppliers API:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await responseClone.text()
        console.error('Failed to parse JSON response:', text.substring(0, 200))
        throw new Error('Invalid JSON response from server')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create supplier')
      }

      toast.success(`Supplier "${supplierName}" created successfully!`)
      router.push('/jaba/suppliers')
    } catch (error: any) {
      console.error('Error creating supplier:', error)
      toast.error(error.message || 'Failed to create supplier. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Supplier</h1>
            <p className="text-sm text-muted-foreground">Create a new supplier entry</p>
          </div>
        </div>
        <Link href="/jaba/suppliers">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-blue-200 dark:border-blue-900/50">
              <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="supplierName" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Supplier Name <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="supplierName"
                  placeholder="Enter supplier name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Category <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategoryOptions().map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

        {/* Contact Information */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-200 dark:border-green-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900/30">
                <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="contactPerson" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Contact Person <span className="text-red-600 dark:text-red-400 font-bold">*</span>
              </Label>
              <Input
                id="contactPerson"
                placeholder="Contact person name"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
                className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Phone Number <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                </Label>
                <Input
                  id="phone"
                  placeholder="+1 555-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Address</Label>
              <Textarea
                id="address"
                placeholder="Full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="min-h-[80px] border-2 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Materials/Items */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b border-purple-200 dark:border-purple-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Materials or Items They Provide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex gap-2">
              <Input
                placeholder="Enter item name"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addItem()}
                className="flex-1 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 h-11"
              />
              <Button 
                type="button"
                onClick={addItem} 
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30 h-11 px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {items.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-7 w-7 p-0 ml-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
            <Link href="/jaba/suppliers">
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
                  Save Supplier
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
