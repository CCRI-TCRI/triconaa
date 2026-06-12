import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { SchoolBrandingProvider } from "@/components/school-branding-provider"
import { EmergencyProvider } from "@/components/emergency-broadcast"

export const metadata: Metadata = {
  title: "Royal Ballot - St. Theresa S.S. Buloba-Kasero",
  description: "Digital voting platform for St. Theresa S.S. Buloba-Kasero elections of all kinds",
  Developer: "Unjovu",

  icons: {
    icon: "/favicon.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#168AAD",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <SchoolBrandingProvider>
          <EmergencyProvider>{children}</EmergencyProvider>
        </SchoolBrandingProvider>
      </body>
    </html>
  )
}
