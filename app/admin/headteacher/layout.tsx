"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HeadteacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionStorage.getItem("headteacher_auth")
      if (!isAuthenticated) {
        router.push("/admin/headteacher/login")
      }
    }

    checkAuth()

    // Check auth on storage changes (e.g., logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "headteacher_auth" && !e.newValue) {
        router.push("/admin/headteacher/login")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [router])

  return <div className="min-h-screen bg-gray-50">{children}</div>
}
