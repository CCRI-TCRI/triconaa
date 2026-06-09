import type React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminGuard } from "@/components/admin-guard"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <main className="admin-aura relative min-h-screen flex-1 p-6">
            {/* light-refraction orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-indigo-300/40 blur-3xl" />
              <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
            </div>
            <div className="relative z-10">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AdminGuard>
  )
}
