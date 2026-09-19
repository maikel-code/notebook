import type { Metadata } from "next"
import { Archivo_Black, Space_Grotesk } from "next/font/google"
import type { ReactNode } from "react"

import "./globals.css"

const headingFont = Archivo_Black({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-head",
  weight: "400",
})

const bodyFont = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  description: "Private, source-grounded notebook question answering.",
  title: "Notebook",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  )
}
