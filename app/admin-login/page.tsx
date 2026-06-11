"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { setAdminAuthed } from "@/components/admin-guard"

const ADMIN_USERNAME = "admin"
const ADMIN_PASSWORD = "Lavender"

export default function AdminLoginPage() {
  const router = useRouter()
  const { schoolName, logoUrl } = useSchoolBranding()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    await new Promise((r) => setTimeout(r, 600))
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setAdminAuthed()
      router.push("/admin/dashboard")
    } else {
      setError("Invalid credentials. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#160d2e] px-4 py-10">
      {/* colourful blurred backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div className="absolute left-[12%] top-[10%] h-96 w-96 rounded-full bg-blue-600/50 blur-[120px]" animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute right-[8%] top-[6%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/45 blur-[130px]" animate={{ scale: [1, 1.2, 1], opacity: [0.45, 0.7, 0.45] }} transition={{ duration: 11, repeat: Infinity, delay: 1 }} />
        <motion.div className="absolute bottom-[4%] left-[30%] h-96 w-96 rounded-full bg-violet-600/45 blur-[120px]" animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }} transition={{ duration: 10, repeat: Infinity, delay: 2 }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(236,72,153,0.25),transparent_55%)]" />
      </div>

      {/* heading */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mb-7 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{schoolName}</h1>
        <p className="mt-1 text-blue-200/80">Administration · Onboarding…</p>
      </motion.div>

      {/* split card */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative z-10 grid w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2"
      >
        {/* left greeting panel */}
        <div className="relative hidden flex-col justify-end overflow-hidden p-8 text-white md:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1f4d] via-[#10246b] to-[#06122e]" />
          <div className="absolute inset-0 opacity-80" style={{ background: "linear-gradient(125deg, transparent 30%, rgba(56,189,248,0.45) 55%, rgba(99,102,241,0.5) 70%, transparent 90%)" }} />
          <div className="absolute -right-10 top-10 h-48 w-48 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/90">
              <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
            </div>
            <h2 className="text-3xl font-bold">Hello~</h2>
            <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-blue-100/80">
              Welcome to the {schoolName} election management system.
            </p>
          </div>
        </div>

        {/* right form panel */}
        <div className="bg-white p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="text-xs font-medium text-slate-500">Username</label>
              <div className="relative mt-1">
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm outline-none ring-indigo-200 focus:border-indigo-400 focus:ring-2"
                  autoFocus
                  required
                />
                {username && <CheckCircle2 className="absolute right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500" />}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-medium text-slate-500">Password</label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm outline-none ring-indigo-200 focus:border-indigo-400 focus:ring-2"
                  required
                />
                {password && <CheckCircle2 className="absolute right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500" />}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-500">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Remember me
              </label>
              <span className="cursor-default text-slate-400">Forgot password?</span>
            </div>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 font-semibold tracking-wide text-white shadow-lg transition hover:from-blue-600 hover:to-indigo-700 disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
