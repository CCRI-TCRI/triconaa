"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import type { Candidate } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Crown, Users, TrendingUp, BarChart3, CheckCircle2 } from "lucide-react"

interface PositionResult {
  position_name: string
  category: string
  total_votes: number
  candidates: Candidate[] // sorted desc by vote_count
}

// White & blue professional palette
const BLUE = ["#2563eb", "#3b82f6", "#0ea5e9", "#0284c7", "#38bdf8", "#60a5fa", "#6366f1", "#1d4ed8"]
const LEADER = "#1e3a8a" // navy

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

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
  return (
    <span className="tabular-nums">
      {display}
      {suffix}
    </span>
  )
}

export default function LiveResultsPage() {
  const { schoolName, logoUrl } = useSchoolBranding()
  const [results, setResults] = useState<PositionResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState("")
  const [analytics, setAnalytics] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0, totalPositions: 0, reporting: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (results.length > 0) {
      const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % results.length), 9000)
      return () => clearInterval(interval)
    }
  }, [results.length])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const fetchResults = async () => {
    try {
      const [positionsWithCandidates, votes, users] = await Promise.all([getPositionsWithCandidates(), voteDb.getAll(), userDb.getAll()])
      const resultsData: PositionResult[] = positionsWithCandidates.map((position) => {
        const positionVotes = votes.filter((v) => v.position_id === position.id)
        const candidates = [...position.candidates]
          .map((c) => ({ ...c, vote_count: positionVotes.filter((v) => v.candidate_id === c.id).length }))
          .sort((a, b) => b.vote_count - a.vote_count)
        return { position_name: position.name, category: position.category, total_votes: positionVotes.length, candidates }
      })
      const votedCount = users.filter((u) => u.has_voted).length
      setResults(resultsData)
      setAnalytics({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
        totalPositions: resultsData.length,
        reporting: resultsData.filter((r) => r.total_votes > 0).length,
      })
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || results.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white to-blue-50">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-2xl font-bold tracking-tight text-blue-900">{schoolName}</p>
          <p className="mt-2 text-slate-500">Loading live election results…</p>
        </motion.div>
      </div>
    )
  }

  const current = results[currentIndex]
  const leader = current.candidates[0]
  const runnersUp = current.candidates.slice(1)
  const hasVotes = current.total_votes > 0
  const timeUntilNext = 9 - Math.floor((Date.now() / 1000) % 9)
  const chartData = current.candidates.map((c, i) => ({
    name: c.full_name,
    value: c.vote_count,
    fill: i === 0 && c.vote_count > 0 ? LEADER : BLUE[i % BLUE.length],
  }))

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-white via-blue-50 to-slate-100 text-slate-900">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-blue-100 bg-white px-8 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-blue-100">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-blue-900 sm:text-xl">{schoolName}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Live Election Results</p>
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

      {/* ── KPI row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 px-8 py-4 sm:grid-cols-4">
        {[
          { label: "Votes Counted", value: <AnimatedNumber value={analytics.totalVotes} />, icon: BarChart3 },
          { label: "Turnout", value: <AnimatedNumber value={analytics.turnout} decimals={1} suffix="%" />, icon: TrendingUp },
          { label: "Students Voted", value: <><AnimatedNumber value={analytics.votedCount} />/{analytics.totalVoters}</>, icon: Users },
          { label: "Races Reporting", value: <>{analytics.reporting}/{analytics.totalPositions}</>, icon: CheckCircle2 },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-5 py-3 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
              <p className="text-2xl font-bold text-blue-900">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Featured race ──────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col px-8 pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* race title */}
            <div className="mb-4 flex items-end justify-between border-b border-blue-100 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">{current.category}</p>
                <h2 className="text-3xl font-black tracking-tight text-blue-950 sm:text-5xl">{current.position_name}</h2>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-blue-700 sm:text-5xl">
                  <AnimatedNumber value={current.total_votes} />
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Votes</p>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Leader spotlight + runners up */}
              <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
                {/* spotlight */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                  <div className="absolute right-0 top-0 rounded-bl-xl bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    {hasVotes ? "Projected Leader" : "Awaiting Votes"}
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl ring-2 ring-blue-600 sm:h-28 sm:w-28">
                        {leader.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={leader.photo_url} alt={leader.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-blue-50 text-3xl font-black text-blue-700">
                            {initials(leader.full_name)}
                          </div>
                        )}
                      </div>
                      {hasVotes && (
                        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 shadow-lg">
                          <Crown className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-2xl font-black text-slate-900 sm:text-3xl">{leader.full_name}</h3>
                      <p className="text-sm text-slate-500">{leader.class}</p>
                      <div className="mt-2 flex items-end gap-3">
                        <span className="text-4xl font-black text-blue-700 sm:text-5xl">
                          <AnimatedNumber value={hasVotes ? (leader.vote_count / current.total_votes) * 100 : 0} decimals={1} suffix="%" />
                        </span>
                        <span className="mb-1.5 text-sm font-semibold text-slate-500">
                          <AnimatedNumber value={leader.vote_count} /> votes
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${hasVotes ? (leader.vote_count / current.total_votes) * 100 : 0}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* runners-up list */}
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {runnersUp.length === 0 && (
                    <div className="flex h-full items-center justify-center rounded-xl border border-blue-100 bg-white text-sm text-slate-400 shadow-sm">
                      Single candidate — running unopposed
                    </div>
                  )}
                  {runnersUp.map((candidate, idx) => {
                    const pct = hasVotes ? (candidate.vote_count / current.total_votes) * 100 : 0
                    const color = BLUE[(idx + 1) % BLUE.length]
                    return (
                      <motion.div
                        key={candidate.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <span className="w-5 text-center text-sm font-black text-slate-300">{idx + 2}</span>
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-blue-50 ring-1 ring-slate-200">
                          {candidate.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-blue-700">{initials(candidate.full_name)}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{candidate.full_name}</p>
                            <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                          </div>
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs text-slate-400">{candidate.vote_count}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Donut */}
              <div className="flex min-h-0 flex-col rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Vote Share</p>
                <div className="relative min-h-0 flex-1">
                  {hasVotes ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 8, color: "#1e293b" }} formatter={(value: any, _n: any, p: any) => [`${value} votes`, p?.payload?.name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-blue-900">
                          <AnimatedNumber value={current.total_votes} />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">votes</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Awaiting first votes…</div>
                  )}
                </div>
                {/* legend */}
                <div className="mt-3 max-h-24 space-y-1 overflow-y-auto">
                  {current.candidates.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: i === 0 && c.vote_count > 0 ? LEADER : BLUE[i % BLUE.length] }} />
                        <span className="truncate text-slate-600">{c.full_name}</span>
                      </div>
                      <span className="shrink-0 font-semibold text-slate-500">{c.vote_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Filmstrip footer ───────────────────────────── */}
      <footer className="border-t border-blue-100 bg-white px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {results.map((r, index) => {
              const top = r.candidates[0]
              const active = index === currentIndex
              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-all ${
                    active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div>
                    <p className={`max-w-[130px] truncate text-xs font-semibold ${active ? "text-blue-700" : "text-slate-600"}`}>{r.position_name}</p>
                    <p className="max-w-[130px] truncate text-[10px] text-slate-400">
                      {top && r.total_votes > 0 ? `${top.full_name} · ${top.vote_count}` : "no votes yet"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="shrink-0 text-xs font-semibold text-slate-400">
            Race {currentIndex + 1}/{results.length} · next in {timeUntilNext}s
          </p>
        </div>
      </footer>
    </div>
  )
}
