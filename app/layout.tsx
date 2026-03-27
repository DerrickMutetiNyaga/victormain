import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import SessionProvider from "@/components/providers/session-provider"
import { ShopSessionProvider } from "@/components/providers/shop-session-provider"
import { CartProvider } from "@/components/providers/cart-provider"
import { ShopLoginModalProvider } from "@/components/providers/shop-login-modal-provider"
import { OrderNotificationsProvider } from "@/components/providers/order-notifications-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Catha Lounge",
    template: "%s | Catha Lounge",
  },
  description: "Catha Lounge – Restaurant & Bar. Order premium spirits and house infusions online. Where good taste meets your doorstep.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SessionProvider>
          <ShopSessionProvider>
            <ShopLoginModalProvider>
              <CartProvider>
                <OrderNotificationsProvider>
                  {children}
                </OrderNotificationsProvider>
              </CartProvider>
            </ShopLoginModalProvider>
          </ShopSessionProvider>
        </SessionProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
