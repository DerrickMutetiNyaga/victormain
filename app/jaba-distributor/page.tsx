"use client"

import { useState } from "react"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Sparkles, TrendingUp, Package, Users, Award, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function JabaDistributorPage() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    location: "",
    distributionArea: "",
    currentBusiness: "",
    monthlyCapacity: "",
    experience: "",
    description: "",
    termsAccepted: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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
          type: "distributor",
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
        location: "",
        distributionArea: "",
        currentBusiness: "",
        monthlyCapacity: "",
        experience: "",
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
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-3 text-gray-900">Become an Infusion Jaba Distributor</h1>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Partner with us to distribute our premium handcrafted Infusion Jaba products across Kenya
            </p>
          </div>

          {/* Benefits Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <Package className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Premium Products</h3>
              <p className="text-sm text-gray-600">Distribute our handcrafted Infusion Jaba</p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Exclusive Territory</h3>
              <p className="text-sm text-gray-600">Protected distribution areas</p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-[#10B981]/20 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center mb-3">
                <Award className="h-5 w-5 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Training & Support</h3>
              <p className="text-sm text-gray-600">Comprehensive distributor support</p>
            </div>
          </div>

          {submitted ? (
            <div className="rounded-2xl border-2 border-[#10B981]/30 bg-white/95 backdrop-blur-sm p-10 sm:p-12 text-center shadow-xl">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#10B981]/20 mb-6">
                <CheckCircle2 className="h-12 w-12 text-[#10B981]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Application received</h2>
              <p className="text-lg text-gray-700 max-w-md mx-auto">
                Thank you for your interest in becoming an Infusion Jaba distributor. We will contact you soon.
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
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
                    placeholder="distributor@example.com"
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

            {/* Business Information */}
            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                <h2 className="text-xl font-bold text-gray-900">Business Information</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-semibold text-gray-700">Location *</Label>
                  <Input
                    id="location"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="Nairobi, Kenya"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distributionArea" className="text-sm font-semibold text-gray-700">Preferred Distribution Area *</Label>
                  <Input
                    id="distributionArea"
                    required
                    value={formData.distributionArea}
                    onChange={(e) => setFormData({ ...formData, distributionArea: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="Westlands, Kilimani, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentBusiness" className="text-sm font-semibold text-gray-700">Current Business Type</Label>
                  <Input
                    id="currentBusiness"
                    value={formData.currentBusiness}
                    onChange={(e) => setFormData({ ...formData, currentBusiness: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="Retail, Wholesale, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyCapacity" className="text-sm font-semibold text-gray-700">Monthly Distribution Capacity</Label>
                  <Input
                    id="monthlyCapacity"
                    value={formData.monthlyCapacity}
                    onChange={(e) => setFormData({ ...formData, monthlyCapacity: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="e.g., 500 units/month"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="experience" className="text-sm font-semibold text-gray-700">Distribution Experience</Label>
                  <Input
                    id="experience"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                    placeholder="Years of experience in distribution"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="rounded-2xl border-2 border-[#10B981]/20 bg-white/90 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                <h2 className="text-xl font-bold text-gray-900">Additional Information</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold text-gray-700">Tell us about your distribution capabilities</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl border-[#10B981]/30 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 bg-white"
                  placeholder="Describe your distribution network, storage facilities, delivery capabilities, target market, etc..."
                  rows={6}
                />
              </div>
            </div>

            {/* Terms */}
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
                    Distributor Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy-policy" className="text-[#10B981] font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            {/* Submit Button */}
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
                  Submit Distributor Application
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

