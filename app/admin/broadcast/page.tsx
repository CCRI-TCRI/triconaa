"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb, electionControl, broadcastSlidesDb, type BroadcastSlide } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { useManagedElection } from "@/lib/use-managed-election"
import { useEmergency } from "@/components/emergency-broadcast"
import { LockdownScreen } from "@/components/lockdown-screen"
import { Radio, ChevronLeft, ChevronRight, Pause, Play, Crown, BarChart3, Maximize, Minimize, Volume2, VolumeX, Sun, Moon } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { supabase } from "@/lib/supabase"

// ── Broadcast palette (election-night studio) ────────────────
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
  const global = useSchoolBranding()
  const managed = useManagedElection()
  // Live Coverage broadcasts whichever election the admin is currently managing
  // (Elections page / dashboard switcher) — never assume the primary/global
  // school. Falls back to the global branding only when on the primary election.
  const schoolName = managed.election?.name || global.schoolName
  const motto = managed.election?.motto || global.motto
  const logoUrl = managed.election?.logo_url || global.logoUrl
  const { lockdown } = useEmergency()
  const [races, setRaces] = useState<Race[]>([])
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0 })
  const [completed, setCompleted] = useState(false)
  const [clock, setClock] = useState("")
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [pageUrl, setPageUrl] = useState("")
  const [muted, setMuted] = useState(false)
  const [classTurnout, setClassTurnout] = useState<{ cls: string; voted: number; total: number; pct: number }[]>([])
  const [customSlides, setCustomSlides] = useState<BroadcastSlide[]>([])
  const [light, setLight] = useState(false)

  useEffect(() => { setLight(localStorage.getItem("broadcast-light") === "1") }, [])
  const toggleLight = () => setLight((v) => { const n = !v; localStorage.setItem("broadcast-light", n ? "1" : "0"); return n })

  useEffect(() => {
    if (typeof window !== "undefined") setPageUrl(window.location.href)
  }, [])

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

  // ── live data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [{ status }, positions, votes, users, slides] = await Promise.all([
        electionControl.get(),
        getPositionsWithCandidates(),
        voteDb.getAll(),
        userDb.getAll(),
        broadcastSlidesDb.get(),
      ])
      setCustomSlides(slides)
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
      // Per-class turnout leaderboard
      const byClass: Record<string, { voted: number; total: number }> = {}
      for (const u of users) {
        const cls = (u.class || "").trim()
        if (!cls || cls === "—") continue
        byClass[cls] = byClass[cls] || { voted: 0, total: 0 }
        byClass[cls].total++
        if (u.has_voted) byClass[cls].voted++
      }
      setClassTurnout(
        Object.entries(byClass)
          .map(([cls, v]) => ({ cls, voted: v.voted, total: v.total, pct: v.total ? (v.voted / v.total) * 100 : 0 }))
          .sort((a, b) => b.pct - a.pct || b.total - a.total)
          .slice(0, 8),
      )
    } catch (e) {
      console.error("Broadcast data error:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 5000)
    // Realtime: refresh instantly when votes are cast or voters update.
    const channel = supabase
      .channel("broadcast-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "election_settings" }, () => fetchData())
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(channel) }
  }, [fetchData])

  // Subtle audio cue when the coverage moves to a new slide.
  const playCue = useCallback(() => {
    if (muted || typeof window === "undefined") return
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext)
      if (!AC) return
      const ctx = new AC()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.setValueAtTime(660, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12)
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      o.start()
      o.stop(ctx.currentTime + 0.36)
      o.onended = () => ctx.close()
    } catch { /* ignore */ }
  }, [muted])

  useEffect(() => { if (!loading) playCue() }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  // clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // auto-advance through positions, then turnout, then any custom slides
  useEffect(() => {
    if (paused || races.length === 0) return
    const slides = races.length + 1 + customSlides.length
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides), DWELL_MS)
    return () => clearTimeout(t)
  }, [paused, races.length, customSlides.length, index])

  const go = useCallback((dir: number) => {
    const n = races.length + 1 + customSlides.length
    setIndex((i) => (i + dir + n) % n)
  }, [races.length, customSlides.length])

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

  if (loading || !managed.ready || races.length === 0) {
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

  const onTurnout = index === races.length
  const customIdx = index - races.length - 1
  const customSlide = customIdx >= 0 ? customSlides[customIdx] : null
  const race = races[index]
  const slides = races.length + 1 + customSlides.length
  const leaderTag = completed ? "WINNER" : "LEADING"

  // ── ticker headlines ──────────────────────────────────
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

  // Per-page theme — broadcast defaults to the dark studio look; light mode for
  // bright halls / daytime projection. Accent colours (red, gold, blue) stay.
  const T = {
    root: light ? "bg-slate-100 text-slate-900" : "bg-[#070b14] text-white",
    glow: light ? "opacity-25" : "opacity-70",
    bar: light ? "border-slate-200 bg-white/90" : "border-white/10 bg-black/40",
    muted: light ? "text-slate-500" : "text-white/50",
    faint: light ? "text-slate-400" : "text-white/40",
    kpiStrip: light ? "border-slate-200 bg-slate-200/50" : "border-white/10 bg-white/5",
    kpiTile: light ? "bg-white" : "bg-black/30",
    card: light ? "border-slate-200 bg-white shadow-sm" : "border-white/10 bg-white/[0.04]",
    leaderCard: light ? "border-[#e11d2a]/40 bg-[#e11d2a]/5 shadow-sm" : "border-[#e11d2a]/60 bg-[#e11d2a]/10 shadow-lg shadow-[#e11d2a]/10",
    track: light ? "bg-slate-200" : "bg-white/10",
    ctrlBtn: light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-white/60 hover:bg-white/10 hover:text-white",
    name: light ? "text-slate-900" : "text-white",
    dim: light ? "text-slate-400" : "text-white/30",
    leaderText: "text-[#e11d2a]",
    dot: light ? "bg-slate-300 hover:bg-slate-400" : "bg-white/20 hover:bg-white/40",
    leaderAccent: light ? "text-[#e11d2a]" : "text-[#f5c542]",
    ring: light ? "ring-slate-200" : "ring-white/15",
    avatarFallback: light ? "bg-slate-100 text-[#e11d2a]" : "bg-white/5 text-[#f5c542]",
    strong: light ? "text-slate-700" : "text-white/80",
  }
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col overflow-hidden ${T.root}`}>
      {/* studio glow */}
      <div className={`pointer-events-none absolute inset-0 ${T.glow}`}>
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#e11d2a]/15 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-[#1d4ed8]/15 blur-[120px]" />
      </div>

      {/* ── Top bar ────────────────────────────────── */}
      <header className={`relative z-10 flex flex-none items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:px-7 ${T.bar}`}>
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
          {pageUrl && (
            <div className="hidden items-center gap-1.5 rounded-lg bg-white/95 px-1.5 py-1 sm:flex">
              <QRCodeSVG value={pageUrl} size={34} bgColor="#ffffff" fgColor="#070b14" />
              <span className="text-[9px] font-black uppercase leading-none tracking-wider text-[#070b14]">Watch<br />live</span>
            </div>
          )}
          <span className={`hidden font-mono text-sm sm:inline ${T.muted}`}>{clock}</span>
          <div className="flex items-center gap-2 rounded-md bg-[#e11d2a] px-3 py-1.5 text-white shadow-lg shadow-[#e11d2a]/30">
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
        <div className="flex flex-1 items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white">
          <span className="truncate">Election Night Coverage · "{motto}"</span>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────── */}
      <div className={`relative z-10 grid flex-none grid-cols-3 gap-px border-b text-center ${T.kpiStrip}`}>
        {[
          { label: "Votes Counted", node: <Rolling value={stats.totalVotes} /> },
          { label: "Turnout", node: <Pct value={stats.turnout} /> },
          { label: "Positions", node: <span className="tabular-nums">{races.length}</span> },
        ].map((k) => (
          <div key={k.label} className={`px-3 py-2 ${T.kpiTile}`}>
            <p className="text-2xl font-black sm:text-3xl">{k.node}</p>
            <p className={`text-[9px] font-bold uppercase tracking-[0.25em] sm:text-[10px] ${T.faint}`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main stage: post by post ──────────────────────── */}
      <div className="relative z-10 min-h-0 flex-1 px-3 py-3 sm:px-7 sm:py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={customSlide ? customSlide.id : onTurnout ? "turnout" : race.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full min-h-0 flex-col"
          >
            {customSlide ? (
              customSlide.type === "message" ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#ffffff] shadow-lg ring-4 ring-[#f5c542]/40">
                    <img src={logoUrl} alt={schoolName} className="h-14 w-14 object-contain" />
                  </div>
                  <h2 className="max-w-4xl text-4xl font-black uppercase leading-tight tracking-tight sm:text-6xl">{customSlide.title}</h2>
                  {customSlide.subtitle && <p className={`mt-4 max-w-2xl text-lg sm:text-2xl ${T.strong}`}>{customSlide.subtitle}</p>}
                  <div className="mt-8 h-1.5 w-40 rounded-full bg-gradient-to-r from-[#e11d2a] via-[#f5c542] to-[#1d4ed8]" />
                </div>
              ) : (() => {
                const r = races.find((x) => x.id === customSlide.positionId)
                const a = r?.candidates[0]
                const b = r?.candidates[1]
                const pct = (c?: Cand) => (r && r.total > 0 && c ? (c.votes / r.total) * 100 : 0)
                const lead = a && b ? a.votes - b.votes : 0
                const reporting = stats.totalVoters > 0 ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0
                return (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="mb-4 flex-none text-center">
                      <h2 className="text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">{r?.name || "Head to head"}</h2>
                      <span className="mt-2 inline-block rounded bg-black px-3 py-1 text-xs font-black uppercase tracking-widest text-white">Vote in: {reporting}%</span>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
                      {/* Left — blue */}
                      <div className={`relative flex overflow-hidden rounded-2xl bg-[#1d4ed8] text-white shadow-xl ${lead > 0 ? "ring-4 ring-[#f5c542]" : ""}`}>
                        <div className="w-2/5 flex-none overflow-hidden bg-black/20">
                          {a?.photo_url ? <img src={a.photo_url} alt={a.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/40">{a ? initials(a.full_name) : "—"}</div>}
                        </div>
                        <div className="flex flex-1 flex-col justify-center p-4">
                          <p className="truncate text-lg font-bold uppercase sm:text-2xl">{a?.full_name || "—"}</p>
                          <p className="text-5xl font-black leading-none sm:text-7xl">{pct(a).toFixed(1)}%</p>
                          <p className="mt-1 text-sm font-semibold text-white/80 sm:text-base">{(a?.votes ?? 0).toLocaleString()} votes</p>
                          {lead > 0 && <p className="mt-1 text-xs font-black uppercase tracking-wider text-[#f5c542]">▶ Lead: {lead.toLocaleString()}</p>}
                        </div>
                      </div>
                      {/* Right — red */}
                      <div className={`relative flex overflow-hidden rounded-2xl bg-[#dc2626] text-white shadow-xl ${lead < 0 ? "ring-4 ring-[#f5c542]" : ""}`}>
                        <div className="flex flex-1 flex-col justify-center p-4 text-right">
                          <p className="truncate text-lg font-bold uppercase sm:text-2xl">{b?.full_name || "—"}</p>
                          <p className="text-5xl font-black leading-none sm:text-7xl">{pct(b).toFixed(1)}%</p>
                          <p className="mt-1 text-sm font-semibold text-white/80 sm:text-base">{(b?.votes ?? 0).toLocaleString()} votes</p>
                          {lead < 0 && <p className="mt-1 text-xs font-black uppercase tracking-wider text-[#f5c542]">Lead: {Math.abs(lead).toLocaleString()} ◀</p>}
                        </div>
                        <div className="w-2/5 flex-none overflow-hidden bg-black/20">
                          {b?.photo_url ? <img src={b.photo_url} alt={b.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/40">{b ? initials(b.full_name) : "—"}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : onTurnout ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-4 flex flex-none items-end justify-between gap-3 border-l-4 border-[#f5c542] pl-3 sm:pl-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#f5c542] sm:text-xs">Participation</p>
                    <h2 className="text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">Voter Turnout</h2>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-3xl font-black sm:text-5xl"><Pct value={stats.turnout} /></p>
                    <p className={`text-[9px] font-bold uppercase tracking-[0.25em] sm:text-[10px] ${T.faint}`}>{stats.votedCount.toLocaleString()} / {stats.totalVoters.toLocaleString()}</p>
                  </div>
                </div>
                {/* Thermometer */}
                <div className="mb-5 flex-none">
                  <div className={`h-7 w-full overflow-hidden rounded-full ${T.track}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, stats.turnout)}%` }}
                      transition={{ duration: 1.1, ease: "easeOut" }}
                      className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-[#e11d2a] via-[#f59e0b] to-[#f5c542] pr-3 text-xs font-black text-[#070b14]"
                    >
                      {stats.turnout >= 8 ? `${stats.turnout.toFixed(0)}%` : ""}
                    </motion.div>
                  </div>
                </div>
                {/* Class leaderboard */}
                <p className="mb-2 flex-none text-[11px] font-black uppercase tracking-[0.3em] text-[#f5c542]">Turnout by class</p>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {classTurnout.length === 0 && <div className={`flex h-full items-center justify-center text-sm ${T.faint}`}>No class data yet.</div>}
                  {classTurnout.map((c, i) => (
                    <div key={c.cls} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 ${i === 0 ? (light ? "border-[#e11d2a]/40 bg-[#e11d2a]/5" : "border-[#f5c542]/60 bg-[#f5c542]/10") : T.card}`}>
                      <span className={`w-5 text-center text-lg font-black ${i === 0 ? T.leaderAccent : T.dim}`}>{i + 1}</span>
                      <span className="w-16 flex-none font-black uppercase">{c.cls}</span>
                      <div className={`h-2.5 flex-1 overflow-hidden rounded-full ${T.track}`}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full" style={{ background: i === 0 ? "linear-gradient(90deg,#e11d2a,#f5c542)" : "linear-gradient(90deg,#3b82f6,#60a5fa)" }} />
                      </div>
                      <span className={`w-12 flex-none text-right text-lg font-black tabular-nums ${i === 0 ? T.leaderAccent : T.strong}`}>{c.pct.toFixed(0)}%</span>
                      <span className={`w-16 flex-none text-right text-[11px] ${T.faint}`}>{c.voted}/{c.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <>
            {/* lower-third style headline */}
            <div className="mb-3 flex flex-none items-end justify-between gap-3 border-l-4 border-[#e11d2a] pl-3 sm:mb-4 sm:pl-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#f5c542] sm:text-xs">{race.category}</p>
                <h2 className="truncate text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">{race.name}</h2>
              </div>
              <div className="flex-none text-right">
                <p className={`text-3xl font-black sm:text-5xl ${T.name}`}><Rolling value={race.total} /></p>
                <p className={`text-[9px] font-bold uppercase tracking-[0.25em] sm:text-[10px] ${T.faint}`}>Votes Cast</p>
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
                      isLeader ? T.leaderCard : T.card
                    }`}
                  >
                    <span className={`w-5 text-center text-lg font-black sm:text-xl ${isLeader ? T.leaderAccent : T.dim}`}>{i + 1}</span>
                    <div className={`h-12 w-12 flex-none overflow-hidden rounded-full ring-2 sm:h-14 sm:w-14 ${isLeader ? "ring-[#f5c542]" : T.ring}`}>
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-base font-black ${T.avatarFallback}`}>{initials(c.full_name)}</div>
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
                        <span className={`flex-none text-xl font-black tabular-nums sm:text-2xl ${isLeader ? T.leaderAccent : T.strong}`}>
                          <Pct value={pct} />
                        </span>
                      </div>
                      <div className={`h-2.5 w-full overflow-hidden rounded-full ${T.track}`}>
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
                <div className={`flex h-full items-center justify-center text-sm ${T.faint}`}>No candidates for this position.</div>
              )}
            </div>
            </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls + position dots ──────────────────────── */}
      <div className={`relative z-10 flex flex-none items-center justify-between gap-3 border-t px-4 py-2 sm:px-7 ${T.bar}`}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(-1)} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => setPaused((p) => !p)} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label={paused ? "Play" : "Pause"}>
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button onClick={() => go(1)} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
          <button onClick={() => setMuted((m) => !m)} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={toggleLight} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label={light ? "Dark mode" : "Light mode"}>
            {light ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <button onClick={toggleFullscreen} className={`rounded-md p-1.5 ${T.ctrlBtn}`} aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}>
            {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
        <div className="hidden flex-1 items-center justify-center gap-1.5 sm:flex">
          {Array.from({ length: slides }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-[#e11d2a]" : `w-1.5 ${T.dot}`} ${i === races.length && i !== index ? "bg-[#f5c542]/60" : ""}`}
              aria-label={i === races.length ? "Turnout slide" : `Go to position ${i + 1}`}
            />
          ))}
        </div>
        <p className={`flex-none text-[11px] font-bold uppercase tracking-widest ${T.faint}`}>
          {index + 1} / {slides}{paused ? " · paused" : ""}
        </p>
      </div>

      {/* ── News ticker ────────────────────────────────── */}
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
