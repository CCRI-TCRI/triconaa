"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSchoolBranding } from "@/components/school-branding-provider"
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
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-rose-200">
            <img src={logoUrl} alt={schoolName} className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight">{schoolName}</h2>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
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

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <LogOut className="w-4 h-4" />
                <span>LogOut</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
