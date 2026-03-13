"use client"

import { useState } from "react"
import Link from "next/link"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Store, Sparkles, Users, TrendingUp, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function SupplierPage() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    products: [] as string[],
    description: "",
    termsAccepted: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const productCategories = [
    "Infused Jaba",
    "Liquor",
    "Spirits",
    "Wines",
    "Soft Drinks",
    "Beer",
    "Whiskey",
    "Vodka",
    "Rum",
    "Gin",
  ]

  const handleProductToggle = (product: string) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.includes(product)
        ? prev.products.filter((p) => p !== product)
        : [...prev.products, product],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.termsAccepted) {
      toast.error("Please accept the terms and conditions")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "supplier",
          ...formData,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to submit application")
        return
      }
      setSubmitted(true)
      setFormData({
        name: "",
        phone: "",
        email: "",
        company: "",
        products: [],
        description: "",
        termsAccepted: false,
      })
    } catch {
      toast.error("Failed to submit. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4]">
      <EcommerceHeader cartCount={0} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#0E9F6E] mb-6 shadow-lg shadow-[#10B981]/30">
              <Store className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-3 text-gray-900">Become a Supplier</h1>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Join our network of trusted suppliers and reach thousands of customers across Kenya
            </p>
          </div>

          {/* Benefits Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <Users className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Reach More Customers</h3>
              <p className="text-sm text-gray-600">Access our growing customer base</p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Grow Your Business</h3>
              <p className="text-sm text-gray-600">Scale with our platform</p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Premium Partnership</h3>
              <p className="text-sm text-gray-600">Join a trusted network</p>
            </div>
          </div>

          {submitted ? (
            <div className="rounded-2xl border-2 border-[#10B981]/30 bg-white/95 backdrop-blur-sm p-10 sm:p-12 text-center shadow-xl">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#10B981]/20 mb-6">
                <CheckCircle2 className="h-12 w-12 text-[#10B981]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Application received</h2>
              <p className="text-lg text-gray-700 max-w-md mx-auto">
                Thank you for your interest in becoming a supplier. We will contact you soon.
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Full Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">Phone Number *</Label>
                  <Input
                    id="phone"
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="+254 700 000 000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email *</Label>
                  <Input
                    id="email"
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="supplier@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-sm font-semibold text-gray-700">Company Name</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="ABC Distributors Ltd"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                <h2 className="text-xl font-bold text-gray-900">Products You Supply</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {productCategories.map((product) => {
                  const isSelected = formData.products.includes(product)
                  return (
                    <div
                      key={product}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleProductToggle(product)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleProductToggle(product)
                        }
                      }}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                        isSelected
                          ? "border-[#10B981] bg-[#10B981]/10"
                          : "border-gray-200 bg-white hover:border-[#10B981]/50 hover:bg-[#10B981]/5"
                      )}
                    >
                      <div
                        role="presentation"
                        aria-hidden
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors",
                          isSelected
                            ? "border-[#10B981] bg-[#10B981] text-white"
                            : "border-gray-300 bg-white"
                        )}
                      >
                        {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold flex-1",
                          isSelected ? "text-[#10B981]" : "text-gray-700"
                        )}
                      >
                        {product}
                      </span>
                    </div>
                  )
                })}
              </div>

              {formData.products.length > 0 && (
                <div className="rounded-xl bg-gradient-to-r from-[#10B981]/10 to-[#0E9F6E]/10 p-4 border border-[#10B981]/20">
                  <p className="text-sm font-semibold text-[#10B981] mb-3">Selected Products:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.products.map((product) => (
                      <span
                        key={product}
                        className="inline-flex items-center rounded-full bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                      >
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                <h2 className="text-xl font-bold text-gray-900">Additional Information</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold text-gray-700">Tell us about your products and services</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                  placeholder="Describe your products, pricing, delivery capabilities, etc..."
                  rows={6}
                />
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 shadow-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, termsAccepted: checked === true })
                  }
                  className="accent-[#10B981] mt-0.5"
                />
                <label
                  htmlFor="terms"
                  className="text-sm leading-relaxed text-gray-700 cursor-pointer"
                >
                  I agree to the{" "}
                  <Link href="/distributor-terms" className="text-[#10B981] font-semibold hover:underline">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy-policy" className="text-[#10B981] font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl h-14 text-base font-bold bg-gradient-to-r from-[#10B981] to-[#0E9F6E] hover:from-[#0E9F6E] hover:to-[#10B981] text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-90 disabled:pointer-events-none"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </form>
          )}
        </div>
      </main>
    </div>
  )
}

