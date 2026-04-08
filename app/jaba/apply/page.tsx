"use client"

import Link from "next/link"
import { Sparkles, Store, ArrowRight } from "lucide-react"
import { EcommerceHeader } from "@/components/ecommerce/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function JabaApplyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#F0FDF4]">
      <EcommerceHeader cartCount={0} />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-gray-900">Apply to Partner with Infusion Jaba</h1>
            <p className="text-lg text-gray-700">
              Submit your application as a supplier or an official distributor.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border-[#10B981]/20 bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Store className="h-5 w-5 text-[#10B981]" />
                  Supplier Application
                </CardTitle>
                <CardDescription>
                  For businesses supplying products such as beverages, spirits, and bar items.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/supplier">
                  <Button className="w-full gap-2 rounded-xl bg-[#10B981] hover:bg-[#0E9F6E]">
                    Apply as Supplier
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#10B981]/20 bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Sparkles className="h-5 w-5 text-[#10B981]" />
                  Jaba Distributor Application
                </CardTitle>
                <CardDescription>
                  For partners interested in distributing Infusion Jaba products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/jaba-distributor">
                  <Button className="w-full gap-2 rounded-xl bg-[#10B981] hover:bg-[#0E9F6E]">
                    Apply as Distributor
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
