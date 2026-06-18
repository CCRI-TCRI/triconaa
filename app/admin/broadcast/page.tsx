"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb, electionControl } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { useEmergency } from "@/components/emergency-broadcast"
import { LockdownScreen } from "@/components/lockdown-screen"
import { Radio, ChevronLeft, ChevronRight, Pause, Play, Crown, BarChart3, Maximize, Minimize } from "lucide-react"

// ── Broadcast palette (election-night studio) ──────────────────
const RED = "#e11d2a"
const GOLD = "#f5c542"

interface Cand {
  id: string
  full_name: string
  photo_url?: string | null
  class?: string
  votes: number
}
interface Race {
  id: string
  name: string
  category: string
  total: number
  candidates: Cand[] // sorted desc by votes
}

const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

const DWELL_MS = 11000 // time spent covering each position before auto-advancing

// Rolling odometer-style number
function Rolling({ value, className = "", suffix = "" }: { value: number; className?: string; suffix?: string }) {
  const mv = useMotionValue(0)
  const [d, setD] = useState("0")
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setD(Math.round(v).toLocaleString()) })
    return c.stop
  }, [value, mv])
  return <span className={`tabular-nums ${className}`}>{d}{suffix}</span>
}

function Pct({ value, className = "" }: { value: number; className?: string }) {
  const mv = useMotionValue(0)
  const [d, setD] = useState("0.0")
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setD(v.toFixed(1)) })
    return c.stop
  }, [value, mv])
  return <span className={`tabular-nums ${className}`}>{d}%</span>
}

export default function BroadcastPage() {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
  const { lockdown } = useEmergency()
  const [races, setRaces] = useState<Race[]>([])
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0 })
  const [completed, setCompleted] = useState(false)
  const [clock, setClock] = useState("")
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [isFs, setIsFs] = useState(false)

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  // Auto-enter fullscreen on open (works when navigation came from a click gesture,
  // e.g. the dashboard "Live Coverage" button), and track fullscreen state.
  useEffect(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
    const onChange = () => setIsFs(!!document.fullscreenElement)
    onChange()
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // ── live data ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [{ status }, positions, votes, users] = await Promise.all([
        electionControl.get(),
        getPositionsWithCandidates(),
        voteDb.getAll(),
        userDb.getAll(),
      ])
      // A stopped or completed election is final — leaders become winners.
      setCompleted(status === "completed" || status === "stopped")
      const data: Race[] = positions.map((p) => {
        const pv = votes.filter((v) => v.position_id === p.id)
        const candidates: Cand[] = p.candidates
          .map((c) => ({
            id: c.id,
            full_name: c.full_name,
            photo_url: c.photo_url,
            class: c.class,
            votes: pv.filter((v) => v.candidate_id === c.id).length,
          }))
          .sort((a, b) => b.votes - a.votes)
        return { id: p.id, name: p.name, category: p.category, total: pv.length, candidates }
      })
      const votedCount = users.filter((u) => u.has_voted).length
      setRaces(data)
      setStats({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
      })
    } catch (e) {
      console.error("Broadcast data error:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 5000)
    return () => clearInterval(t)
  }, [fetchData])

  // clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // auto-advance post by post
  useEffect(() => {
    if (paused || races.length <= 1) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % races.length), DWELL_MS)
    return () => clearTimeout(t)
  }, [paused, races.length, index])

  const go = useCallback((dir: number) => {
    setRaces((r) => {
      if (r.length) setIndex((i) => (i + dir + r.length) % r.length)
      return r
    })
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") go(1)
      else if (e.code === "ArrowLeft") go(-1)
      else if (e.code === "Space") { e.preventDefault(); setPaused((p) => !p) }
      else if (e.key === "f" || e.key === "F") toggleFullscreen()
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [go, toggleFullscreen])

  if (lockdown) return <LockdownScreen />

  if (loading || races.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b14] text-white">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }} className="mx-auto mb-5 h-14 w-14 rounded-full border-4 border-white/10 border-t-[#e11d2a]" />
          <p className="text-xl font-black uppercase tracking-[0.3em] text-white/90">{schoolName}</p>
          <p className="mt-2 text-sm text-white/40">Bringing you live election coverage…</p>
        </div>
      </div>
    )
  }

  const race = races[index]
  const leaderTag = completed ? "WINNER" : "LEADING"

  // ── ticker headlines ─────────────────────────────────────────
  const tickerItems: string[] = [
    `${completed ? "FINAL RESULTS" : "LIVE COVERAGE"} — ${schoolName.toUpperCase()}`,
    `TURNOUT ${stats.turnout.toFixed(1)}%  (${stats.votedCount.toLocaleString()} of ${stats.totalVoters.toLocaleString()} students voted)`,
    `${stats.totalVotes.toLocaleString()} TOTAL VOTES COUNTED ACROSS ${races.length} POSITIONS`,
    ...races.map((r) => {
      const top = r.candidates[0]
      if (!top || top.total === 0 || top.votes === 0) return `${r.name.toUpperCase()}: AWAITING FIRST VOTES`
      const pct = r.total > 0 ? (top.votes / r.total) * 100 : 0
      return `${r.name.toUpperCase()}: ${(completed ? "WINNER " : "")}${top.full_name.toUpperCase()} ${pct.toFixed(0)}%`
    }),
  ]

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#070b14] text-white">
      {/* studio glow */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#e11d2a]/15 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-[#1d4ed8]/15 blur-[120px]" />
      </div>

      {/* ── Top bar ───────────────────────────────────────────── */}
      <header className="relative z-10 flex flex-none items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-[#ffffff] shadow ring-2 ring-[#f5c542]/50">
            <img src={logoUrl} alt={schoolName} className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-black uppercase tracking-wide sm:text-lg">{schoolName}</h1>
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.35em] text-[#f5c542]">Decision {new Date().getFullYear()}</p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3 sm:gap-5">
          <span className="hidden font-mono text-sm text-white/50 sm:inline">{clock}</span>
          <div className="flex items-center gap-2 rounded-md bg-[#e11d2a] px-3 py-1.5 shadow-lg shadow-[#e11d2a]/30">
            <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.3, repeat: Infinity }}>
              <Radio className="h-4 w-4" />
            </motion.span>
            <span className="text-sm font-black uppercase tracking-widest">{completed ? "Results" : "Live"}</span>
          </div>
        </div>
      </header>

      {/* breaking-news strip */}
      <div className="relative z-10 flex flex-none items-stretch border-b border-white/10 bg-gradient-to-r from-[#b3121f] via-[#e11d2a] to-[#b3121f]">
        <div className="flex items-center bg-black px-3 text-xs font-black uppercase tracking-widest text-[#f5c542] sm:px-4">
          {completed ? "Final" : "Breaking"}
        </div>
        <div className="flex flex-1 items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide">
          <span className="truncate">Election Night Coverage · "{motto}"</span>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div className="relative z-10 grid flex-none grid-cols-3 gap-px border-b border-white/10 bg-white/5 text-center">
        {[
          { label: "Votes Counted", node: <Rolling value={stats.totalVotes} /> },
          { label: "Turnout", node: <Pct value={stats.turnout} /> },
          { label: "Positions", node: <span className="tabular-nums">{races.length}</span> },
        ].map((k) => (
          <div key={k.label} className="bg-black/30 px-3 py-2">
            <p className="text-2xl font-black sm:text-3xl">{k.node}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 sm:text-[10px]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main stage: post by post ──────────────────────────── */}
      <div className="relative z-10 min-h-0 flex-1 px-3 py-3 sm:px-7 sm:py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={race.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full min-h-0 flex-col"
          >
            {/* lower-third style headline */}
            <div className="mb-3 flex flex-none items-end justify-between gap-3 border-l-4 border-[#e11d2a] pl-3 sm:mb-4 sm:pl-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#f5c542] sm:text-xs">{race.category}</p>
                <h2 className="truncate text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">{race.name}</h2>
              </div>
              <div className="flex-none text-right">
                <p className="text-3xl font-black text-white sm:text-5xl"><Rolling value={race.total} /></p>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 sm:text-[10px]">Votes Cast</p>
              </div>
            </div>

            {/* candidate callouts */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 sm:space-y-2.5">
              {race.candidates.map((c, i) => {
                const pct = race.total > 0 ? (c.votes / race.total) * 100 : 0
                const isLeader = i === 0 && c.votes > 0
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={`relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3 ${
                      isLeader ? "border-[#e11d2a]/60 bg-[#e11d2a]/10 shadow-lg shadow-[#e11d2a]/10" : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <span className={`w-5 text-center text-lg font-black sm:text-xl ${isLeader ? "text-[#f5c542]" : "text-white/30"}`}>{i + 1}</span>
                    <div className={`h-12 w-12 flex-none overflow-hidden rounded-full ring-2 sm:h-14 sm:w-14 ${isLeader ? "ring-[#f5c542]" : "ring-white/15"}`}>
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-base font-black text-[#f5c542]">{initials(c.full_name)}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-base font-bold sm:text-lg">{c.full_name}</p>
                          {isLeader && (
                            <span className="flex flex-none items-center gap-1 rounded-full bg-[#e11d2a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white sm:text-[10px]">
                              {completed ? <Crown className="h-3 w-3" /> : null}{leaderTag}
                            </span>
                          )}
                        </div>
                        <span className={`flex-none text-xl font-black tabular-nums sm:text-2xl ${isLeader ? "text-[#f5c542]" : "text-white/80"}`}>
                          <Pct value={pct} />
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: isLeader ? `linear-gradient(90deg, ${RED}, ${GOLD})` : "linear-gradient(90deg, #3b82f6, #60a5fa)" }}
                        />
                      </div>
                    </div>
                    <div className="w-14 flex-none text-right sm:w-16">
                      <p className="text-base font-black tabular-nums sm:text-lg"><Rolling value={c.votes} /></p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">votes</p>
                    </div>
                  </motion.div>
                )
              })}
              {race.candidates.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-white/40">No candidates for this position.</div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls + position dots ──────────────────────────── */}
      <div className="relative z-10 flex flex-none items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-4 py-2 sm:px-7">
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(-1)} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => setPaused((p) => !p)} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={paused ? "Play" : "Pause"}>
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button onClick={() => go(1)} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
          <button onClick={toggleFullscreen} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}>
            {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
        <div className="hidden flex-1 items-center justify-center gap-1.5 sm:flex">
          {races.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-[#e11d2a]" : "w-1.5 bg-white/20 hover:bg-white/40"}`}
              aria-label={`Go to position ${i + 1}`}
            />
          ))}
        </div>
        <p className="flex-none text-[11px] font-bold uppercase tracking-widest text-white/40">
          {index + 1} / {races.length}{paused ? " · paused" : ""}
        </p>
      </div>

      {/* ── News ticker ───────────────────────────────────────── */}
      <div className="relative z-10 flex flex-none items-stretch overflow-hidden border-t border-white/10 bg-black">
        <div className="flex flex-none items-center gap-1.5 bg-[#e11d2a] px-3 text-xs font-black uppercase tracking-widest sm:px-4">
          <BarChart3 className="h-3.5 w-3.5" /> Results
        </div>
        <div className="relative flex-1 overflow-hidden">
          <motion.div
            className="flex whitespace-nowrap py-2"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: Math.max(28, tickerItems.join("").length / 5), ease: "linear", repeat: Infinity }}
          >
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0">
                {tickerItems.map((t, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center text-sm font-semibold uppercase tracking-wide text-white/80">
                    <span className="px-5">{t}</span>
                    <span className="text-[#f5c542]">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
