"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb, electionControl } from "@/lib/db"
import type { Candidate } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { useEmergency } from "@/components/emergency-broadcast"
import { LockdownScreen } from "@/components/lockdown-screen"
import { Users, TrendingUp, BarChart3, Vote, Activity } from "lucide-react"

interface PositionResult {
  id: string
  name: string
  category: string
  total: number
  candidates: Candidate[] // sorted desc by vote_count
}

const BLUE = ["#2563eb", "#3b82f6", "#0ea5e9", "#0284c7", "#38bdf8", "#60a5fa", "#6366f1", "#1d4ed8"]

const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState("0")
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()),
    })
    return controls.stop
  }, [value, decimals, mv])
  return <span className="tabular-nums">{display}{suffix}</span>
}

export default function LiveResultsPage() {
  const router = useRouter()
  const { schoolName, logoUrl } = useSchoolBranding()
  const { lockdown } = useEmergency()
  const [results, setResults] = useState<PositionResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [analytics, setAnalytics] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0 })
  const [clock, setClock] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (results.length > 0) {
      const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % results.length), 8000)
      return () => clearInterval(interval)
    }
  }, [results.length])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = async () => {
    try {
      // When the election is completed, jump straight to the reveal show
      const { status } = await electionControl.get()
      if (status === "completed") {
        router.push("/admin/reveal")
        return
      }

      const [positions, votes, users] = await Promise.all([getPositionsWithCandidates(), voteDb.getAll(), userDb.getAll()])
      const resultsData: PositionResult[] = positions.map((p) => {
        const pv = votes.filter((v) => v.position_id === p.id)
        const candidates = [...p.candidates]
          .map((c) => ({ ...c, vote_count: pv.filter((v) => v.candidate_id === c.id).length }))
          .sort((a, b) => b.vote_count - a.vote_count)
        return { id: p.id, name: p.name, category: p.category, total: pv.length, candidates }
      })
      const votedCount = users.filter((u) => u.has_voted).length
      setResults(resultsData)
      setAnalytics({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
      })
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  if (lockdown) return <LockdownScreen />

  if (loading || results.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white to-blue-50">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-2xl font-bold tracking-tight text-blue-900">{schoolName}</p>
          <p className="mt-2 text-slate-500">Loading live statistics…</p>
        </motion.div>
      </div>
    )
  }

  const current = results[currentIndex]
  const timeUntilNext = 8 - Math.floor((Date.now() / 1000) % 8)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-white via-blue-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-blue-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-blue-100">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-blue-900 sm:text-xl">{schoolName}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Live Statistics</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-sm text-slate-500 sm:inline">{clock}</span>
          <div className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 shadow-md shadow-blue-600/20">
            <motion.span animate={{ opacity: [1, 0.2, 1], scale: [1, 0.8, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="text-sm font-black uppercase tracking-widest text-white">Live</span>
          </div>
        </div>
      </header>
      <div className="h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-8 sm:grid-cols-4">
        {[
          { label: "Total Votes", value: <AnimatedNumber value={analytics.totalVotes} />, icon: Vote },
          { label: "Turnout", value: <AnimatedNumber value={analytics.turnout} decimals={1} suffix="%" />, icon: TrendingUp },
          { label: "Students Voted", value: <><AnimatedNumber value={analytics.votedCount} />/{analytics.totalVoters}</>, icon: Users },
          { label: "Positions", value: <>{results.length}</>, icon: BarChart3 },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-5 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
              <p className="text-2xl font-bold text-blue-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Slideshow of per-position candidate statistics */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* position header */}
            <div className="mb-4 flex items-end justify-between border-b border-blue-100 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">{current.category}</p>
                <h2 className="text-3xl font-black tracking-tight text-blue-950 sm:text-5xl">{current.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-blue-700 sm:text-5xl">
                  <AnimatedNumber value={current.total} />
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Votes Cast</p>
              </div>
            </div>

            {/* candidate statistics */}
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {current.candidates.map((c, idx) => {
                const pct = current.total > 0 ? (c.vote_count / current.total) * 100 : 0
                const color = BLUE[idx % BLUE.length]
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="w-5 text-center text-lg font-black text-slate-300">{idx + 1}</span>
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-blue-50 ring-1 ring-slate-200">
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base font-black text-blue-700">{initials(c.full_name)}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-900">{c.full_name}</p>
                          <p className="text-xs text-slate-400">{c.class}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-2xl font-black tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      <p className="text-lg font-black tabular-nums text-blue-900"><AnimatedNumber value={c.vote_count} /></p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">votes</p>
                    </div>
                  </motion.div>
                )
              })}
              {current.candidates.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">No candidates for this position.</div>
              )}
            </div>

            {/* slideshow controls */}
            <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3">
              <p className="text-sm font-semibold text-slate-500">{current.candidates.length} candidate{current.candidates.length === 1 ? "" : "s"}</p>
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {results.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${index === currentIndex ? "w-8 bg-blue-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-slate-400">Position {currentIndex + 1}/{results.length} · next in {timeUntilNext}s</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-blue-100 bg-white px-4 py-2.5 sm:px-8">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-4 w-4 text-blue-600" />
          Live candidate statistics · updates every 5 seconds
        </p>
        <p className="text-xs font-medium text-slate-400">Cycling through all positions</p>
      </div>
    </div>
  )
}
