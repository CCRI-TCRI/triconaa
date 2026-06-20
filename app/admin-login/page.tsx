"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { setAdminSession, ROLE_HOME } from "@/components/admin-guard"
import { accountDb } from "@/lib/db"

export default function AdminLoginPage() {
  const router = useRouter()
  const { schoolName, logoUrl } = useSchoolBranding()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"login" | "reset">("login")
  const [resetUser, setResetUser] = useState("")
  const [resetQuestion, setResetQuestion] = useState<string | null>(null)
  const [resetAnswer, setResetAnswer] = useState("")
  const [resetNew, setResetNew] = useState("")
  const [resetMsg, setResetMsg] = useState("")

  const lookupQuestion = async () => {
    setResetMsg("")
    const q = await accountDb.getSecurityQuestion(resetUser)
    if (!q) { setResetMsg("No security question is set for that username."); setResetQuestion(null); return }
    setResetQuestion(q)
  }
  const doReset = async () => {
    const ok = await accountDb.resetPassword(resetUser, resetAnswer, resetNew)
    if (ok) { setResetMsg("Password updated — you can sign in now."); setTimeout(() => { setMode("login"); setResetQuestion(null) }, 1200) }
    else setResetMsg("Incorrect answer, or reset isn't available for this account.")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const account = await accountDb.authenticate(username, password)
      if (account) {
        setAdminSession(account.role, account.full_name || account.username)
        router.push(ROLE_HOME[account.role])
      } else {
        setError("Invalid credentials. Please try again.")
        setLoading(false)
      }
    } catch {
      setError("Could not sign in. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#2b303b] px-4 py-10">
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{schoolName}</h1>
        <p className="mt-1 text-slate-300">Administration · Onboarding…</p>
      </div>

      <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2">
        {/* left greeting panel */}
        <div className="hidden flex-col justify-end bg-[#1b1f29] p-8 text-white md:flex">
          <div className="mb-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <h2 className="text-3xl font-bold">Hello~</h2>
          <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-slate-400">
            Welcome to the {schoolName} election management system.
          </p>
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
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
              <button type="button" onClick={() => setMode("reset")} className="cursor-pointer text-indigo-600 hover:underline">Forgot password?</button>
            </div>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 py-2.5 font-semibold tracking-wide text-white transition hover:bg-indigo-700 disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
        </div>
      </div>

      {mode === "reset" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMode("login")}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">Reset password</h3>
            <p className="mt-1 text-xs text-slate-500">Answer your security question to set a new password.</p>
            <div className="mt-4 space-y-3">
              <input
                value={resetUser}
                onChange={(e) => setResetUser(e.target.value)}
                placeholder="Username"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
              {!resetQuestion ? (
                <button onClick={lookupQuestion} className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Continue</button>
              ) : (
                <>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{resetQuestion}</p>
                  <input value={resetAnswer} onChange={(e) => setResetAnswer(e.target.value)} placeholder="Your answer" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200" />
                  <input type="password" value={resetNew} onChange={(e) => setResetNew(e.target.value)} placeholder="New password" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200" />
                  <button onClick={doReset} className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Update password</button>
                </>
              )}
              {resetMsg && <p className="text-sm text-slate-600">{resetMsg}</p>}
              <button onClick={() => { setMode("login"); setResetQuestion(null); setResetMsg("") }} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">Back to sign in</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
