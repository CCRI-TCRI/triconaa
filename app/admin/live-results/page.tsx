"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import type { Candidate } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Crown, Users, TrendingUp, BarChart3, CheckCircle2, Radio } from "lucide-react"

interface PositionResult {
  position_name: string
  category: string
  total_votes: number
  candidates: Candidate[] // sorted desc by vote_count
}

// Broadcast palette — gold leader, cool tones for the rest
const PALETTE = ["#38bdf8", "#818cf8", "#2dd4bf", "#a78bfa", "#f472b6", "#34d399", "#fb7185", "#60a5fa"]
const GOLD = "#f5c542"

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
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0e1a]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-white/10 border-t-amber-400" />
          <p className="text-2xl font-bold tracking-tight text-white">{schoolName}</p>
          <p className="mt-2 text-slate-400">Loading election night coverage…</p>
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
    fill: i === 0 && c.vote_count > 0 ? GOLD : PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0a0e1a] text-white">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_45%)]" />
      </div>

      {/* ── Header ─────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-amber-400/30">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight sm:text-xl">{schoolName}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Election Night · Live Results</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-sm text-slate-400 sm:inline">{clock}</span>
          <div className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1.5 shadow-lg shadow-red-600/30">
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
              <Radio className="h-4 w-4" />
            </motion.span>
            <span className="text-sm font-black uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      {/* ── KPI row ────────────────────────────────────── */}
      <div className="relative z-10 grid grid-cols-2 gap-3 px-8 py-4 sm:grid-cols-4">
        {[
          { label: "Votes Counted", value: <AnimatedNumber value={analytics.totalVotes} />, icon: BarChart3, color: "text-sky-400" },
          { label: "Turnout", value: <AnimatedNumber value={analytics.turnout} decimals={1} suffix="%" />, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Students Voted", value: <><AnimatedNumber value={analytics.votedCount} />/{analytics.totalVoters}</>, icon: Users, color: "text-indigo-400" },
          { label: "Races Reporting", value: <>{analytics.reporting}/{analytics.totalPositions}</>, icon: CheckCircle2, color: "text-amber-400" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Featured race ──────────────────────────────── */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-8 pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -20 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* race title */}
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">{current.category}</p>
                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{current.position_name}</h2>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-white sm:text-5xl">
                  <AnimatedNumber value={current.total_votes} />
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Votes</p>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Leader spotlight + runners up */}
              <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
                {/* spotlight */}
                <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.12] via-white/[0.02] to-transparent p-5">
                  <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0a0e1a]">
                    {hasVotes ? "Projected Leader" : "Awaiting Votes"}
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl ring-2 ring-amber-400 sm:h-28 sm:w-28">
                        {leader.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={leader.photo_url} alt={leader.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/5 text-3xl font-black text-amber-300">
                            {initials(leader.full_name)}
                          </div>
                        )}
                      </div>
                      {hasVotes && (
                        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 shadow-lg">
                          <Crown className="h-5 w-5 text-[#0a0e1a]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-2xl font-black sm:text-3xl">{leader.full_name}</h3>
                      <p className="text-sm text-slate-400">{leader.class}</p>
                      <div className="mt-2 flex items-end gap-3">
                        <span className="text-4xl font-black text-amber-400 sm:text-5xl">
                          <AnimatedNumber value={hasVotes ? (leader.vote_count / current.total_votes) * 100 : 0} decimals={1} suffix="%" />
                        </span>
                        <span className="mb-1.5 text-sm font-semibold text-slate-400">
                          <AnimatedNumber value={leader.vote_count} /> votes
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${hasVotes ? (leader.vote_count / current.total_votes) * 100 : 0}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* runners-up list */}
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {runnersUp.length === 0 && (
                    <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-slate-500">
                      Single candidate — running unopposed
                    </div>
                  )}
                  {runnersUp.map((candidate, idx) => {
                    const pct = hasVotes ? (candidate.vote_count / current.total_votes) * 100 : 0
                    const color = PALETTE[(idx + 1) % PALETTE.length]
                    return (
                      <motion.div
                        key={candidate.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                      >
                        <span className="w-5 text-center text-sm font-black text-slate-500">{idx + 2}</span>
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
                          {candidate.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-300">{initials(candidate.full_name)}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{candidate.full_name}</p>
                            <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                          </div>
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs text-slate-500">{candidate.vote_count}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Donut */}
              <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Vote Share</p>
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
                          <Tooltip contentStyle={{ background: "#0f1729", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} formatter={(value: any, _n: any, p: any) => [`${value} votes`, p?.payload?.name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black">
                          <AnimatedNumber value={current.total_votes} />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">votes</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Awaiting first votes…</div>
                  )}
                </div>
                {/* legend */}
                <div className="mt-3 max-h-24 space-y-1 overflow-y-auto">
                  {current.candidates.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: i === 0 && c.vote_count > 0 ? GOLD : PALETTE[i % PALETTE.length] }} />
                        <span className="truncate text-slate-300">{c.full_name}</span>
                      </div>
                      <span className="shrink-0 font-semibold text-slate-400">{c.vote_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Filmstrip footer ───────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 px-8 py-3">
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
                    active ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div>
                    <p className={`max-w-[120px] truncate text-xs font-semibold ${active ? "text-amber-300" : "text-slate-300"}`}>{r.position_name}</p>
                    <p className="max-w-[120px] truncate text-[10px] text-slate-500">
                      {top && r.total_votes > 0 ? `${top.full_name} · ${top.vote_count}` : "no votes yet"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="shrink-0 text-xs font-semibold text-slate-500">
            Race {currentIndex + 1}/{results.length} · next in {timeUntilNext}s
          </p>
        </div>
      </footer>
    </div>
  )
}
