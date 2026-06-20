"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { clearAdminAuthed, getAdminRole, getAdminName, roleCanAccess } from "@/components/admin-guard"
import type { AdminRole } from "@/lib/db"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccessibilityControls } from "@/components/accessibility-controls"
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
  Radio,
  KeyRound,
  UserCog,
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
        title: "Voting Codes",
        url: "/admin/anon-codes",
        icon: KeyRound,
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
        title: "Live Coverage",
        url: "/admin/broadcast",
        icon: Radio,
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
        title: "Accounts",
        url: "/admin/accounts",
        icon: UserCog,
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
    ],
  },
]

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  chairperson: "Electoral Commission",
  headteacher: "Head Teacher",
}

export function AdminSidebar() {
  const pathname = usePathname()
  const { schoolName, logoUrl } = useSchoolBranding()
  const [role, setRole] = useState<AdminRole | null>(null)
  const [name, setName] = useState("")

  useEffect(() => {
    setRole(getAdminRole())
    setName(getAdminName())
  }, [])

  // Only show menu items the signed-in role may access.
  const groups = menuItems
    .map((g) => ({ ...g, items: g.items.filter((it) => !role || roleCanAccess(role, it.url)) }))
    .filter((g) => g.items.length > 0)

  return (
    <Sidebar className="[&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-slate-200 [&_[data-sidebar=sidebar]]:bg-white [&_[data-sidebar=sidebar]]:text-slate-600 dark:[&_[data-sidebar=sidebar]]:border-white/10 dark:[&_[data-sidebar=sidebar]]:bg-slate-900 dark:[&_[data-sidebar=sidebar]]:text-slate-300">
      <SidebarHeader className="border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sky-50 ring-1 ring-sky-100">
            <img src={logoUrl} alt={schoolName} className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{schoolName}</h2>
            <p className="text-[11px] text-slate-400">{role ? ROLE_LABEL[role] : "Administration"}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 data-[active=true]:bg-sky-50 data-[active=true]:font-medium data-[active=true]:text-sky-700"
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

      <SidebarFooter className="border-t border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Dark mode</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Accessibility</span>
          <AccessibilityControls />
        </div>
        {name && (
          <div className="px-2 pb-1 text-[11px] text-slate-400 dark:text-slate-500">
            Signed in as <span className="font-semibold text-slate-600 dark:text-slate-300">{name}</span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-500/10"
              onClick={() => {
                clearAdminAuthed()
                window.location.href = "/"
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
