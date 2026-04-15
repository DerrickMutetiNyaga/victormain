import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import SessionProvider from "@/components/providers/session-provider"
import { ShopSessionProvider } from "@/components/providers/shop-session-provider"
import { CartProvider } from "@/components/providers/cart-provider"
import { ShopLoginModalProvider } from "@/components/providers/shop-login-modal-provider"
import { OrderNotificationsProvider } from "@/components/providers/order-notifications-provider"
import { GlobalErrorListener } from "@/components/providers/global-error-listener"
import "./globals.css"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.infusionjaba.co.ke"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Infusion Jaba",
    template: "%s | Infusion Jaba",
  },
  description:
    "Infusion Jaba – Premium spirits and house infusions. Order online for delivery or pickup at Catha Lounge.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
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
        <GlobalErrorListener />
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
