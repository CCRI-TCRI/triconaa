"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  CartesianGrid,
} from "recharts"
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

// Professional, election-board colour palette
const PALETTE = ["#3b82f6", "#0ea5e9", "#14b8a6", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#a855f7"]
const LEADER_COLOR = "#f59e0b"

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export default function LiveResultsPage() {
  const { schoolName, logoUrl } = useSchoolBranding()
  const [results, setResults] = useState<PositionResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState("")
  const [analytics, setAnalytics] = useState({
    totalVotes: 0,
    turnout: 0,
    totalVoters: 0,
    votedCount: 0,
    totalPositions: 0,
    reporting: 0,
  })
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
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const fetchResults = async () => {
    try {
      const [positionsWithCandidates, votes, users] = await Promise.all([
        getPositionsWithCandidates(),
        voteDb.getAll(),
        userDb.getAll(),
      ])

      const resultsData: PositionResult[] = positionsWithCandidates.map((position) => {
        const positionVotes = votes.filter((v) => v.position_id === position.id)
        const candidates = [...position.candidates]
          .map((c) => ({ ...c, vote_count: positionVotes.filter((v) => v.candidate_id === c.id).length }))
          .sort((a, b) => b.vote_count - a.vote_count)
        return {
          position_name: position.name,
          category: position.category,
          total_votes: positionVotes.length,
          candidates,
        }
      })

      const votedCount = users.filter((u) => u.has_voted).length
      const reporting = resultsData.filter((r) => r.total_votes > 0).length

      setResults(resultsData)
      setAnalytics({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
        totalPositions: resultsData.length,
        reporting,
      })
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || results.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-slate-700 border-t-sky-400"
          />
          <p className="text-2xl font-bold tracking-tight text-white">{schoolName}</p>
          <p className="mt-2 text-slate-400">Loading live election results…</p>
        </motion.div>
      </div>
    )
  }

  const current = results[currentIndex]
  const leader = current.candidates[0]
  const timeUntilNext = 9 - Math.floor((Date.now() / 1000) % 9)

  const chartData = current.candidates.map((c, i) => ({
    name: c.full_name.split(" ")[0],
    fullName: c.full_name,
    votes: c.vote_count,
    fill: i === 0 && c.vote_count > 0 ? LEADER_COLOR : PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg">
              <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight sm:text-xl">{schoolName}</h1>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">Live Election Results</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-sm text-slate-400 sm:inline">{clock}</span>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/30">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="h-2.5 w-2.5 rounded-full bg-emerald-400"
              />
              <span className="text-sm font-bold uppercase tracking-widest text-emerald-300">Live</span>
            </div>
          </div>
        </div>
        {/* accent line */}
        <div className="h-0.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />
      </header>

      {/* ── Stats strip ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
        {[
          { label: "Votes Counted", value: analytics.totalVotes.toLocaleString(), icon: BarChart3, color: "text-sky-400" },
          { label: "Turnout", value: `${analytics.turnout.toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Students Voted", value: `${analytics.votedCount}/${analytics.totalVoters}`, icon: Users, color: "text-indigo-400" },
          { label: "Races Reporting", value: `${analytics.reporting}/${analytics.totalPositions}`, icon: CheckCircle2, color: "text-amber-400" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 bg-slate-900 px-6 py-3">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
              <p className="text-xl font-bold tabular-nums sm:text-2xl">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Slide ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden px-8 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Position header */}
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">{current.category}</p>
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{current.position_name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{current.total_votes}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Votes</p>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-5 overflow-hidden lg:grid-cols-5">
              {/* Leaderboard */}
              <div className="flex flex-col gap-2.5 overflow-y-auto lg:col-span-3">
                {current.candidates.map((candidate, idx) => {
                  const pct = current.total_votes > 0 ? (candidate.vote_count / current.total_votes) * 100 : 0
                  const isLeader = idx === 0 && candidate.vote_count > 0
                  const color = isLeader ? LEADER_COLOR : PALETTE[idx % PALETTE.length]
                  return (
                    <motion.div
                      key={candidate.id}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                        isLeader ? "border-amber-500/40 bg-amber-500/10" : "border-slate-800 bg-slate-900/60"
                      }`}
                    >
                      <span className="w-5 text-center text-lg font-black tabular-nums text-slate-500">{idx + 1}</span>
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
                        style={{ borderColor: color }}
                      >
                        {candidate.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-slate-200">{initials(candidate.full_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <p className="truncate text-base font-bold sm:text-lg">{candidate.full_name}</p>
                          <span className="truncate text-xs text-slate-500">{candidate.class}</span>
                          {isLeader && (
                            <span className="ml-1 flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                              <Crown className="h-3 w-3" />
                              Leading
                            </span>
                          )}
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <p className="text-xl font-black tabular-nums">{pct.toFixed(1)}%</p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          {candidate.vote_count} vote{candidate.vote_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Charts */}
              <div className="flex flex-col gap-4 overflow-hidden lg:col-span-2">
                {/* Bar chart: votes per candidate */}
                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Votes by Candidate</p>
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(148,163,184,0.08)" }}
                          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                          formatter={(value: any) => [`${value} votes`, "Votes"]}
                          labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                        />
                        <Bar dataKey="votes" radius={[4, 4, 0, 0]} isAnimationActive>
                          {chartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut: vote share */}
                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Vote Share</p>
                  <div className="relative min-h-0 flex-1">
                    {current.total_votes > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="votes"
                              nameKey="fullName"
                              innerRadius="60%"
                              outerRadius="90%"
                              paddingAngle={2}
                              stroke="none"
                            >
                              {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                              formatter={(value: any, _n: any, p: any) => [`${value} votes`, p?.payload?.fullName]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black tabular-nums">{current.total_votes}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">votes</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Awaiting first votes…
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Projection + slideshow controls */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
              <p className="text-sm font-semibold text-slate-400">
                {leader && leader.vote_count > 0 ? (
                  <>
                    <span className="font-black text-amber-400">PROJECTED LEADER:</span>{" "}
                    <span className="text-white">{leader.full_name}</span>
                    <span className="text-slate-500"> · {leader.vote_count} votes</span>
                  </>
                ) : (
                  <span className="text-slate-500">Awaiting first votes in this race…</span>
                )}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {results.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentIndex ? "w-8 bg-sky-400" : "w-1.5 bg-slate-700 hover:bg-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  Race {currentIndex + 1}/{results.length} · next in {timeUntilNext}s
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 px-8 py-2.5">
        <p className="text-xs text-slate-500">{schoolName} · Live election coverage</p>
        <p className="text-xs text-slate-500">Auto-updating every 5 seconds</p>
      </div>
    </div>
  )
}
