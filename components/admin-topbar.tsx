"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { clearAdminAuthed } from "@/components/admin-guard"
import { ExternalLink, LogOut } from "lucide-react"

const titles: Record<string, string> = {
  dashboard: "Dashboard",
  control: "Control System",
  voters: "Voters",
  candidates: "Candidates",
  positions: "Positions",
  votes: "Votes",
  results: "Results",
  "live-results": "Live Results",
  reveal: "Reveal Show",
  analytics: "Analytics",
  reports: "Reports",
  settings: "Settings",
  headteacher: "Headteacher",
  chairperson: "Chairperson",
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  stopped: "bg-rose-50 text-rose-700 ring-rose-200",
  completed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
}

export function AdminTopbar() {
  const pathname = usePathname() || ""
  const { electionStatus } = useSchoolBranding()
  const segment = pathname.split("/").filter(Boolean)[1] || "dashboard"
  const title = titles[segment] || "Admin"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-slate-500" />
        <div className="h-5 w-px bg-slate-200" />
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className={`hidden rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ring-inset sm:inline ${statusStyles[electionStatus] || statusStyles.active}`}>
          {electionStatus}
        </span>
        <Link href="/" target="_blank" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">View site</span>
        </Link>
        <button
          onClick={() => {
            clearAdminAuthed()
            window.location.href = "/"
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  )
}
