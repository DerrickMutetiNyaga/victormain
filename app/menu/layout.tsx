import type React from "react"
import { Playfair_Display, Inter } from "next/font/google"
import { MenuFontScope } from "./menu-font-scope"
import styles from "./menu.module.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--menu-font-display",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--menu-font-sans",
  display: "swap",
})

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const fontVars = `${playfair.variable} ${inter.variable}`

  return (
    <MenuFontScope className={fontVars}>
      <div className={`${fontVars} ${styles.menuRoot}`}>{children}</div>
    </MenuFontScope>
  )
}
