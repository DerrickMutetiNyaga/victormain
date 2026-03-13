"use client"

import { EcommerceHeader } from "@/components/ecommerce/header"
import { FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DistributorTermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4]">
      <EcommerceHeader cartCount={0} />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/jaba-distributor">
              <Button variant="ghost" className="mb-6 rounded-xl text-gray-700 hover:text-[#10B981] hover:bg-green-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Application
              </Button>
            </Link>
            <div className="text-center mb-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#0E9F6E] mb-4 shadow-lg shadow-[#10B981]/30">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-3 text-gray-900">Distributor Terms and Conditions</h1>
              <p className="text-lg text-gray-700">Last updated: January 2024</p>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-[#10B981]/20 p-6 sm:p-8 shadow-lg space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                1. Agreement to Terms
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                By submitting an application to become an Infusion Jaba Distributor, you agree to be bound by these Terms and Conditions. 
                These terms govern your relationship with Infusion Jaba regarding the distribution of our Infusion Jaba products.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                2. Distributor Eligibility
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                To be eligible as a distributor, you must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Have a valid business registration in Kenya</li>
                <li>Possess appropriate licenses for alcohol distribution (where applicable)</li>
                <li>Have adequate storage facilities meeting our quality standards</li>
                <li>Demonstrate financial stability and business experience</li>
                <li>Maintain a good reputation in the market</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                3. Distribution Rights and Territory
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Distribution rights are granted on an exclusive or non-exclusive basis as determined by Infusion Jaba. 
                Your assigned territory will be specified in your distributor agreement. You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Distribute products only within your assigned territory</li>
                <li>Not engage in parallel imports or unauthorized distribution</li>
                <li>Maintain minimum order quantities as specified</li>
                <li>Report sales and inventory data as required</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                4. Product Handling and Quality
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                You must maintain the highest standards in handling our products:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Store products in appropriate conditions (temperature, humidity, etc.)</li>
                <li>Follow first-in-first-out (FIFO) inventory management</li>
                <li>Maintain product integrity and prevent contamination</li>
                <li>Report any quality issues immediately</li>
                <li>Not alter, repackage, or modify products without authorization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                5. Pricing and Payment Terms
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Pricing will be established in your distributor agreement. Standard terms include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Wholesale pricing based on volume commitments</li>
                <li>Payment terms: Net 30 days from invoice date</li>
                <li>Minimum order quantities apply</li>
                <li>Prices subject to change with 30 days notice</li>
                <li>Late payment fees may apply</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                6. Marketing and Branding
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Use Infusion Jaba branding materials as provided</li>
                <li>Not create unauthorized marketing materials</li>
                <li>Maintain brand consistency and quality standards</li>
                <li>Participate in marketing activities as requested</li>
                <li>Report marketing activities and results</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                7. Training and Support
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Infusion Jaba will provide:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Initial product and sales training</li>
                <li>Ongoing support and resources</li>
                <li>Marketing materials and promotional items</li>
                <li>Regular communication and updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                8. Termination
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Either party may terminate this agreement:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>With 30 days written notice</li>
                <li>Immediately for breach of terms</li>
                <li>Upon failure to meet minimum sales requirements</li>
                <li>For violation of quality standards</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                9. Confidentiality
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                You agree to maintain confidentiality of:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Pricing information</li>
                <li>Business strategies and plans</li>
                <li>Customer data and information</li>
                <li>Product formulations and recipes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                10. Limitation of Liability
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Infusion Jaba's liability is limited to the value of products sold. We are not liable for indirect, 
                consequential, or incidental damages arising from distribution activities.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                11. Governing Law
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                These terms are governed by the laws of Kenya. Any disputes will be resolved through 
                arbitration in Nairobi, Kenya.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                12. Contact Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                For questions about these terms, please contact us at:
              </p>
              <div className="bg-[#10B981]/10 rounded-xl p-4 border border-[#10B981]/20">
                <p className="text-gray-900 font-semibold mb-2">Catha Lounge</p>
                <p className="text-gray-700">Email: jaba.infusion@gmail.com</p>
                <p className="text-gray-700">Phone: +254 757477664</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

