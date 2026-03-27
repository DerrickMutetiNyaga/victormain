"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Category } from "@/lib/ecommerce-data"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: Category
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/shop?category=${category.id}`}
      className="group relative flex flex-col rounded-xl sm:rounded-2xl overflow-hidden hover-lift bg-white border border-[#E2E8F0] shadow-sm sm:shadow-md active:scale-[0.98] transition-all duration-200 touch-manipulation"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#B91C1C]/20 via-[#8B1A26]/10 to-[#10B981]/20">
        <Image
          src={category.image}
          alt={category.name}
          fill
          className="object-cover transition-all duration-300 group-hover:scale-110 group-active:scale-105"
          sizes="(max-width: 640px) 85vw, (max-width: 768px) 50vw, (max-width: 1200px) 50vw, 25vw"
        />
        
        {/* Gradient Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
        
        {/* Hover overlay with brand colors */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#B91C1C]/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-20">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg sm:text-xl font-bold text-white font-heading drop-shadow-lg">{category.name}</h3>
        </div>
        <p className="text-xs sm:text-sm text-white/90 mb-2 font-medium drop-shadow">
          {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
        </p>
        <div className="flex items-center text-white font-semibold text-xs sm:text-sm group-hover:translate-x-1 transition-transform">
          Shop now <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
        </div>
      </div>
    </Link>
  )
}

