import type React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminTopbar } from "@/components/admin-topbar"
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
        <SidebarInset className="bg-slate-50">
          <AdminTopbar />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AdminGuard>
  )
}
