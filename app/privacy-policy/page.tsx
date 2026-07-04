"use client"

import { EcommerceHeader } from "@/components/ecommerce/header"
import { Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PrivacyPolicyPage() {
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
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-3 text-gray-900">Privacy Policy</h1>
              <p className="text-lg text-gray-700">Last updated: January 2024</p>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-[#10B981]/20 p-6 sm:p-8 shadow-lg space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                1. Introduction
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Infusion Jaba ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains 
                how we collect, use, disclose, and safeguard your information when you use our services, including 
                our website, distributor applications, and business relationships.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                2. Information We Collect
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Personal Information:</strong> Name, email address, phone number, postal address</li>
                <li><strong>Business Information:</strong> Company name, business registration, tax identification numbers</li>
                <li><strong>Financial Information:</strong> Payment details, bank account information (for distributors)</li>
                <li><strong>Application Data:</strong> Information submitted in distributor or supplier applications</li>
                <li><strong>Usage Data:</strong> How you interact with our website and services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                3. How We Use Your Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Process and evaluate distributor/supplier applications</li>
                <li>Manage business relationships and agreements</li>
                <li>Process orders, payments, and deliveries</li>
                <li>Communicate with you about our services</li>
                <li>Improve our products and services</li>
                <li>Comply with legal obligations</li>
                <li>Prevent fraud and ensure security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                4. Information Sharing and Disclosure
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Service Providers:</strong> Third-party vendors who assist in our operations</li>
                <li><strong>Business Partners:</strong> When necessary for business operations</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                5. Data Security
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We implement appropriate technical and organizational measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Encryption of sensitive data</li>
                <li>Secure servers and databases</li>
                <li>Access controls and authentication</li>
                <li>Regular security assessments</li>
                <li>Employee training on data protection</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                6. Your Rights
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your information</li>
                <li>Object to processing of your information</li>
                <li>Request restriction of processing</li>
                <li>Data portability</li>
                <li>Withdraw consent where applicable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                7. Cookies and Tracking Technologies
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Remember your preferences</li>
                <li>Analyze website traffic and usage</li>
                <li>Improve user experience</li>
                <li>Provide personalized content</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                You can control cookies through your browser settings, though this may affect website functionality.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                8. Data Retention
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We retain your information for as long as necessary to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Fulfill the purposes outlined in this policy</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce agreements</li>
                <li>Maintain business records</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                9. Children's Privacy
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Our services are not intended for individuals under the age of 18. We do not knowingly collect 
                personal information from children. If we become aware that we have collected information from 
                a child, we will take steps to delete it.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                10. International Data Transfers
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Your information may be transferred to and processed in countries other than your country of residence. 
                We ensure appropriate safeguards are in place to protect your information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                11. Changes to This Policy
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Posting the updated policy on our website</li>
                <li>Sending an email notification</li>
                <li>Updating the "Last updated" date</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                12. Contact Us
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
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

