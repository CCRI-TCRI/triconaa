import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { SchoolBrandingProvider } from "@/components/school-branding-provider"

export const metadata: Metadata = {
  title: "Royal Ballot - St. Theresa S.S. Buloba-Kasero",
  description: "Digital voting platform for St. Theresa S.S. Buloba-Kasero elections of all kinds",
  Developer: "Unjovu",
  
  icons: {
    icon: "/favicon.ico",
  },
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
        <SchoolBrandingProvider>{children}</SchoolBrandingProvider>
      </body>
    </html>
  )
}
