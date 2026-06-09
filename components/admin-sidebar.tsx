"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { clearAdminAuthed } from "@/components/admin-guard"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Trophy,
  BarChart3,
  FileText,
  Vote,
  Settings,
  Shield,
  LogOut,
  School,
  Briefcase,
  Sparkles,
} from "lucide-react"

const menuItems = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Control System",
        url: "/admin/control",
        icon: Shield,
      },
    ],
  },
  {
    title: "Election Management",
    items: [
      {
        title: "Positions",
        url: "/admin/positions",
        icon: Briefcase,
      },
      {
        title: "Voters",
        url: "/admin/voters",
        icon: Users,
      },
      {
        title: "Candidates",
        url: "/admin/candidates",
        icon: UserCheck,
      },
      {
        title: "Votes",
        url: "/admin/votes",
        icon: Vote,
      },
    ],
  },
  {
    title: "Results & Analytics",
    items: [
      {
        title: "Live Results",
        url: "/admin/results",
        icon: Trophy,
      },
      {
        title: "Reveal Show",
        url: "/admin/reveal",
        icon: Sparkles,
      },
      {
        title: "Analytics",
        url: "/admin/analytics",
        icon: BarChart3,
      },
      {
        title: "Reports",
        url: "/admin/reports",
        icon: FileText,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { schoolName, logoUrl } = useSchoolBranding()

  return (
    <Sidebar className="border-none [&_[data-sidebar=sidebar]]:bg-gradient-to-b [&_[data-sidebar=sidebar]]:from-[#4a0e1a] [&_[data-sidebar=sidebar]]:via-[#6b1226] [&_[data-sidebar=sidebar]]:to-[#2a0810] [&_[data-sidebar=sidebar]]:text-rose-50">
      <SidebarHeader className="p-2">
        <div className="glass-sheen liquid-glass-dark flex items-center gap-3 rounded-2xl px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-2 ring-amber-300/40">
            <img src={logoUrl} alt={schoolName} className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold leading-tight text-white">{schoolName}</h2>
            <p className="text-[11px] text-amber-200/70">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-widest text-amber-300/70">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="rounded-xl text-rose-100/75 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-amber-400 data-[active=true]:to-amber-500 data-[active=true]:font-semibold data-[active=true]:text-rose-950 data-[active=true]:shadow-lg"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="rounded-xl text-rose-100/75 hover:bg-red-500/20 hover:text-white"
              onClick={() => {
                clearAdminAuthed()
                window.location.href = "/"
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
