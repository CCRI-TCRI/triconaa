"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ShieldX, ArrowLeft } from "lucide-react"
import { useSchoolBranding } from "@/components/school-branding-provider"

export const ADMIN_AUTH_KEY = "tricona_admin_authed"

// Login pages + the public assembly/broadcast screens (shown on projectors and
// watched on phones via QR) stay reachable without being signed in.
const PUBLIC_ADMIN_ROUTES = [
  "/admin/headteacher/login",
  "/admin/chairperson/login",
  "/admin/live-results",
  "/admin/broadcast",
  "/admin/reveal",
]

export function setAdminAuthed() {
  try {
    localStorage.setItem(ADMIN_AUTH_KEY, "1")
  } catch {
    /* ignore */
  }
}

export function clearAdminAuthed() {
  try {
    localStorage.removeItem(ADMIN_AUTH_KEY)
  } catch {
    /* ignore */
  }
}

function AccessDenied() {
  const router = useRouter()
  const { schoolName, logoUrl } = useSchoolBranding()
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a0610] via-[#1a0a14] to-[#0a0610] px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-red-600/25 blur-[130px]"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 13 }}
        className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-red-600 shadow-[0_0_50px_rgba(220,38,38,0.6)]"
      >
        <ShieldX className="h-16 w-16 text-white" strokeWidth={2.2} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 mt-8 text-3xl font-black tracking-tight sm:text-5xl"
      >
        Access Denied
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="relative z-10 mt-4 max-w-lg text-lg text-rose-100/90"
      >
        Hey — do not try to access what doesn&apos;t belong to you.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="relative z-10 mt-2 max-w-md text-sm text-slate-400"
      >
        This is a restricted administration area. You must sign in through the proper channel to continue.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        onClick={() => router.push("/")}
        className="relative z-10 mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[#3b0a14] transition hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to safety
      </motion.button>

      <div className="relative z-10 mt-10 flex items-center gap-2 opacity-70">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white">
          <img src={logoUrl} alt={schoolName} className="h-7 w-7 object-contain" />
        </div>
        <span className="text-xs font-semibold text-slate-400">{schoolName}</span>
      </div>
    </div>
  )
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking")

  useEffect(() => {
    if (PUBLIC_ADMIN_ROUTES.some((r) => pathname?.startsWith(r))) {
      setState("ok")
      return
    }
    const authed = typeof window !== "undefined" && localStorage.getItem(ADMIN_AUTH_KEY) === "1"
    setState(authed ? "ok" : "denied")
  }, [pathname])

  if (state === "checking") return <div className="min-h-screen bg-slate-100" />
  if (state === "denied") return <AccessDenied />
  return <>{children}</>
}
