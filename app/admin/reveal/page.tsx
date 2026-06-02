"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Crown, Play, ChevronRight, Trophy, Users, Smartphone, Download, Sparkles, Loader2 } from "lucide-react"

// School show colours
const MAROON = "#7a1f2b"
const GOLD = "#f5c542"
const CONFETTI_COLORS = ["#7a1f2b", "#f5c542", "#ffffff", "#b91c1c", "#fbbf24", "#fde68a"]

interface Cand {
  id: string
  full_name: string
  photo_url?: string
  class?: string
  votes: number
}
interface Race {
  id: string
  name: string
  category: string
  total: number
  candidates: Cand[] // sorted desc
  photoFinish: boolean
}

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default
  const end = Date.now() + 1600
  confetti({ particleCount: 160, spread: 100, startVelocity: 45, origin: { y: 0.55 }, colors: CONFETTI_COLORS })
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: CONFETTI_COLORS })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: CONFETTI_COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

// Odometer-style rolling number
function Odometer({ value, className, suffix = "" }: { value: number; className?: string; suffix?: string }) {
  const mv = useMotionValue(0)
  const [d, setD] = useState("0")
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.8, ease: "easeOut", onUpdate: (v) => setD(Math.round(v).toLocaleString()) })
    return controls.stop
  }, [value, mv])
  return <span className={className}>{d}{suffix}</span>
}

function TurnoutRing({ pct }: { pct: number }) {
  const r = 86
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-56 w-56">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" />
        <motion.circle
          cx="100" cy="100" r={r} fill="none" stroke={GOLD} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Odometer value={pct} className="text-5xl font-black text-white" suffix="%" />
        <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-amber-200/80">Turnout</span>
      </div>
    </div>
  )
}

type Phase = "lobby" | "countdown" | "racing" | "drumroll" | "revealed" | "finale"

export default function RevealShowPage() {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
  const [races, setRaces] = useState<Race[]>([])
  const [classTurnout, setClassTurnout] = useState<{ cls: string; pct: number; voted: number; total: number }[]>([])
  const [turnout, setTurnout] = useState(0)
  const [totalVotes, setTotalVotes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>("lobby")
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(3)
  const [posterBusy, setPosterBusy] = useState(false)
  const phoneUrl = useRef("")

  useEffect(() => {
    phoneUrl.current = typeof window !== "undefined" ? `${window.location.origin}/admin/live-results` : ""
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [positions, votes, users] = await Promise.all([getPositionsWithCandidates(), voteDb.getAll(), userDb.getAll()])
      // Reveal order: grand finale (display_order 1) revealed LAST
      const ordered = [...positions].sort((a, b) => b.display_order - a.display_order)
      const built: Race[] = ordered.map((p) => {
        const pv = votes.filter((v) => v.position_id === p.id)
        const cands = p.candidates
          .map((c) => ({ id: c.id, full_name: c.full_name, photo_url: c.photo_url, class: c.class, votes: pv.filter((v) => v.candidate_id === c.id).length }))
          .sort((a, b) => b.votes - a.votes)
        const gap = cands.length >= 2 ? cands[0].votes - cands[1].votes : Infinity
        const photoFinish = pv.length > 0 && gap <= Math.max(2, Math.ceil(pv.length * 0.05))
        return { id: p.id, name: p.name, category: p.category, total: pv.length, candidates: cands, photoFinish }
      })
      setRaces(built)

      const voted = users.filter((u) => u.has_voted).length
      setTurnout(users.length > 0 ? (voted / users.length) * 100 : 0)
      setTotalVotes(votes.length)

      const byClass: Record<string, { voted: number; total: number }> = {}
      for (const u of users) {
        const cls = u.class || "Unspecified"
        byClass[cls] = byClass[cls] || { voted: 0, total: 0 }
        byClass[cls].total++
        if (u.has_voted) byClass[cls].voted++
      }
      setClassTurnout(
        Object.entries(byClass)
          .map(([cls, v]) => ({ cls, voted: v.voted, total: v.total, pct: v.total ? (v.voted / v.total) * 100 : 0 }))
          .sort((a, b) => b.pct - a.pct),
      )
    } catch (error) {
      console.error("Reveal data error:", error)
    } finally {
      setLoading(false)
    }
  }

  const race = races[index]

  // ── phase timers ──────────────────────────────────────────────
  useEffect(() => {
    if (phase === "countdown") {
      setCount(3)
      const t1 = setTimeout(() => setCount(2), 1000)
      const t2 = setTimeout(() => setCount(1), 2000)
      const t3 = setTimeout(() => setCount(0), 3000)
      const t4 = setTimeout(() => { setIndex(0); setPhase("racing") }, 4200)
      return () => [t1, t2, t3, t4].forEach(clearTimeout)
    }
    if (phase === "racing") {
      const t = setTimeout(() => setPhase("drumroll"), race?.photoFinish ? 7000 : 4500)
      return () => clearTimeout(t)
    }
    if (phase === "drumroll") {
      const t = setTimeout(() => setPhase("revealed"), 3000)
      return () => clearTimeout(t)
    }
  }, [phase, index, race?.photoFinish])

  useEffect(() => {
    if (phase === "revealed" || phase === "finale") fireConfetti()
  }, [phase, index])

  const goNext = useCallback(() => {
    if (index < races.length - 1) {
      setIndex((i) => i + 1)
      setPhase("racing")
    } else {
      setPhase("finale")
    }
  }, [index, races.length])

  const advance = useCallback(() => {
    if (phase === "lobby") setPhase("countdown")
    else if (phase === "racing") setPhase("drumroll")
    else if (phase === "drumroll") setPhase("revealed")
    else if (phase === "revealed") goNext()
  }, [phase, goNext])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [advance])

  // ── winner poster ─────────────────────────────────────────────
  const loadImg = (src: string, cross = false) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new window.Image()
      if (cross) img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })

  const downloadPoster = async (r: Race, winner: Cand): Promise<void> => {
    setPosterBusy(true)
    try {
      const W = 1080, H = 1350
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!
      // background
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, "#5c0f1f")
      g.addColorStop(0.5, "#7a1f2b")
      g.addColorStop(1, "#3b0a14")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      // gold border
      ctx.strokeStyle = GOLD
      ctx.lineWidth = 10
      ctx.strokeRect(36, 36, W - 72, H - 72)
      ctx.textAlign = "center"
      // crest
      const logo = await loadImg(logoUrl, !logoUrl.startsWith("data:"))
      if (logo) {
        const s = 150
        ctx.save()
        ctx.beginPath()
        ctx.arc(W / 2, 180, s / 2 + 10, 0, Math.PI * 2)
        ctx.fillStyle = "#fff"
        ctx.fill()
        ctx.closePath()
        ctx.drawImage(logo, W / 2 - s / 2, 180 - s / 2, s, s)
        ctx.restore()
      }
      ctx.fillStyle = "#fff"
      ctx.font = "bold 40px Helvetica, Arial, sans-serif"
      ctx.fillText(schoolName, W / 2, 320, W - 140)
      ctx.fillStyle = GOLD
      ctx.font = "italic 26px Helvetica, Arial, sans-serif"
      ctx.fillText(`"${motto}"`, W / 2, 360)
      // WINNER label
      ctx.fillStyle = GOLD
      ctx.font = "bold 30px Helvetica, Arial, sans-serif"
      ctx.fillText("★  WINNER  ★", W / 2, 470)
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.font = "bold 44px Helvetica, Arial, sans-serif"
      ctx.fillText(r.name.toUpperCase(), W / 2, 530, W - 140)
      // winner photo circle
      const cy = 760
      ctx.save()
      ctx.beginPath()
      ctx.arc(W / 2, cy, 170, 0, Math.PI * 2)
      ctx.closePath()
      ctx.lineWidth = 8
      ctx.strokeStyle = GOLD
      ctx.stroke()
      ctx.clip()
      let drewPhoto = false
      if (winner.photo_url) {
        const photo = await loadImg(winner.photo_url, true)
        if (photo) {
          ctx.drawImage(photo, W / 2 - 170, cy - 170, 340, 340)
          drewPhoto = true
        }
      }
      if (!drewPhoto) {
        ctx.fillStyle = "rgba(255,255,255,0.12)"
        ctx.fillRect(W / 2 - 170, cy - 170, 340, 340)
        ctx.fillStyle = GOLD
        ctx.font = "bold 130px Helvetica, Arial, sans-serif"
        ctx.fillText(initials(winner.full_name), W / 2, cy + 48)
      }
      ctx.restore()
      // name
      ctx.fillStyle = "#fff"
      ctx.font = "bold 72px Helvetica, Arial, sans-serif"
      ctx.fillText(winner.full_name, W / 2, 1040, W - 120)
      ctx.fillStyle = GOLD
      ctx.font = "bold 38px Helvetica, Arial, sans-serif"
      ctx.fillText(`${r.name} · ${new Date().getFullYear()}`, W / 2, 1100)
      ctx.fillStyle = "rgba(255,255,255,0.7)"
      ctx.font = "26px Helvetica, Arial, sans-serif"
      ctx.fillText(`${winner.votes} votes`, W / 2, 1150)
      ctx.fillStyle = "rgba(255,255,255,0.55)"
      ctx.font = "22px Helvetica, Arial, sans-serif"
      ctx.fillText(schoolName, W / 2, H - 70)

      let url: string
      try {
        url = canvas.toDataURL("image/png")
      } catch {
        // photo tainted the canvas — redraw without it
        await downloadPoster({ ...r }, { ...winner, photo_url: undefined })
        return
      }
      const a = document.createElement("a")
      a.href = url
      a.download = `${winner.full_name.replace(/\s+/g, "-")}-${r.name.replace(/\s+/g, "-")}.png`
      a.click()
    } catch (error) {
      console.error("Poster error:", error)
    } finally {
      setPosterBusy(false)
    }
  }

  // ── render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0610] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-amber-400" />
          <p className="text-slate-400">Preparing the reveal…</p>
        </div>
      </div>
    )
  }

  const winner = race?.candidates[0]
  const revealed = phase === "revealed"

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-[#0a0610] via-[#1a0a14] to-[#0a0610] text-white" onClick={() => phase !== "revealed" && phase !== "finale" && advance()}>
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#7a1f2b]/30 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 h-[34rem] w-[34rem] rounded-full bg-amber-500/15 blur-[140px]" />
      </div>

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 flex h-full flex-col items-center justify-center px-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-amber-300/40">
                <img src={logoUrl} alt={schoolName} className="h-14 w-14 object-contain" />
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-black sm:text-4xl">{schoolName}</h1>
                <p className="text-sm italic text-amber-200/80">"{motto}" · Election Results {new Date().getFullYear()}</p>
              </div>
            </div>

            <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-3">
              <div className="flex flex-col items-center lg:col-span-1">
                <TurnoutRing pct={turnout} />
                <p className="mt-3 text-center text-sm text-slate-400">
                  <Odometer value={totalVotes} className="font-bold text-white" /> votes cast
                </p>
              </div>

              {/* class leaderboard */}
              <div className="lg:col-span-2">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-300">
                  <Users className="h-4 w-4" /> Turnout by Class
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {classTurnout.map((c, i) => (
                    <motion.div key={c.cls} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2">
                      <span className="w-6 text-center text-sm font-black text-amber-300">{i + 1}</span>
                      <span className="w-20 shrink-0 font-semibold">{c.cls}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.05 }} className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" />
                      </div>
                      <span className="w-16 text-right text-sm font-bold tabular-nums">{c.pct.toFixed(0)}%</span>
                    </motion.div>
                  ))}
                  {classTurnout.length === 0 && <p className="text-sm text-slate-500">No voter data yet.</p>}
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); setPhase("countdown") }}
                className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-4 text-lg font-black uppercase tracking-wider text-[#3b0a14] shadow-2xl shadow-amber-500/30 transition hover:scale-105"
              >
                <Play className="h-6 w-6 fill-current" /> Begin the Reveal
              </button>
              <p className="text-xs text-slate-500">Press Space or tap anywhere to advance · {races.length} positions</p>
            </div>

            {/* QR for phones */}
            {phoneUrl.current && (
              <div className="absolute bottom-6 right-6 flex items-center gap-3 rounded-xl bg-white/5 p-3">
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={phoneUrl.current} size={84} />
                </div>
                <div className="max-w-[140px] text-xs text-slate-300">
                  <p className="flex items-center gap-1 font-semibold text-amber-300"><Smartphone className="h-3.5 w-3.5" /> Watch live</p>
                  <p className="text-slate-400">Scan to follow the standings on your phone</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── COUNTDOWN ── */}
        {phase === "countdown" && (
          <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 flex h-full flex-col items-center justify-center">
            <p className="mb-4 text-lg font-semibold uppercase tracking-[0.4em] text-amber-300">Results in</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={count}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-[12rem] font-black leading-none text-white drop-shadow-[0_0_40px_rgba(245,197,66,0.5)]"
              >
                {count === 0 ? "GO" : count}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── RACE (racing / drumroll / revealed) ── */}
        {race && (phase === "racing" || phase === "drumroll" || phase === "revealed") && (
          <motion.div key={`race-${index}-${phase === "revealed" ? "r" : "x"}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4 }} className="relative z-10 flex h-full flex-col px-8 py-6">
            {/* header */}
            <div className="mb-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">{race.category}</p>
              <h2 className="text-4xl font-black tracking-tight sm:text-6xl">{race.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Position {index + 1} of {races.length} · <Odometer value={race.total} className="font-bold text-white" /> votes
                {race.photoFinish && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-white">Photo Finish</span>}
              </p>
            </div>

            {/* candidates */}
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col justify-center gap-3">
              {race.candidates.map((c, i) => {
                const pct = race.total > 0 ? (c.votes / race.total) * 100 : 0
                const isWinner = i === 0 && c.votes > 0
                const dim = revealed && !isWinner
                return (
                  <motion.div
                    key={c.id}
                    animate={{ opacity: dim ? 0.35 : 1, scale: revealed && isWinner ? 1.04 : 1 }}
                    transition={{ duration: 0.5 }}
                    className={`relative flex items-center gap-4 rounded-2xl border p-3 sm:p-4 ${
                      revealed && isWinner ? "border-amber-400 bg-amber-400/10 shadow-2xl shadow-amber-500/20" : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    {/* photo */}
                    <div className="relative">
                      <div className={`overflow-hidden rounded-xl ${revealed && isWinner ? "h-24 w-24 ring-4 ring-amber-400 sm:h-28 sm:w-28" : "h-16 w-16 ring-1 ring-white/15"}`}>
                        {c.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/5 text-2xl font-black text-amber-300">{initials(c.full_name)}</div>
                        )}
                      </div>
                      {revealed && isWinner && (
                        <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }} className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 shadow-lg">
                          <Crown className="h-6 w-6 text-[#3b0a14]" />
                        </motion.div>
                      )}
                    </div>
                    {/* name + bar */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`truncate font-bold ${revealed && isWinner ? "text-2xl text-amber-200 sm:text-3xl" : "text-lg"}`}>{c.full_name}</p>
                          {c.class && <p className="text-xs text-slate-400">{c.class}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`font-black tabular-nums ${revealed && isWinner ? "text-3xl text-amber-300" : "text-xl"}`}>
                            <Odometer value={pct} suffix="%" />
                          </span>
                        </div>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: race.photoFinish ? 5.5 : 2, ease: race.photoFinish ? "easeInOut" : "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: isWinner ? `linear-gradient(90deg, ${MAROON}, ${GOLD})` : "rgba(255,255,255,0.3)" }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500"><Odometer value={c.votes} className="font-semibold text-slate-300" /> votes</p>
                    </div>
                  </motion.div>
                )
              })}
              {race.candidates.length === 0 && <p className="text-center text-slate-500">No candidates for this position.</p>}
            </div>

            {/* drumroll overlay */}
            <AnimatePresence>
              {phase === "drumroll" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                  <p className="text-2xl font-semibold text-slate-200 sm:text-4xl">And the <span className="text-amber-300">{race.name}</span> is…</p>
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="mt-6 flex gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} animate={{ y: [0, -14, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} className="h-4 w-4 rounded-full bg-amber-400" />
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* winner banner + controls */}
            {revealed && winner && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mt-4 flex items-center justify-center gap-3">
                <button onClick={(e) => { e.stopPropagation(); downloadPoster(race, winner) }} disabled={posterBusy} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20">
                  {posterBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Winner Poster
                </button>
                <button onClick={(e) => { e.stopPropagation(); goNext() }} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-2.5 text-sm font-black uppercase tracking-wider text-[#3b0a14] shadow-lg transition hover:scale-105">
                  {index < races.length - 1 ? <>Next Position <ChevronRight className="h-4 w-4" /></> : <>Grand Finale <Sparkles className="h-4 w-4" /></>}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── FINALE ── */}
        {phase === "finale" && (
          <motion.div key="finale" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex h-full flex-col items-center justify-center px-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400">
              <Trophy className="h-9 w-9 text-[#3b0a14]" />
            </motion.div>
            <h1 className="text-4xl font-black sm:text-6xl">Congratulations!</h1>
            <p className="mt-2 text-amber-200/80">{schoolName} · Prefects {new Date().getFullYear()}</p>
            <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
              {[...races].reverse().map((r) => {
                const w = r.candidates[0]
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-400/40">
                      {w?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.photo_url} alt={w.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-sm font-black text-amber-300">{w ? initials(w.full_name) : "—"}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-amber-300">{r.name}</p>
                      <p className="truncate font-bold">{w && w.votes > 0 ? w.full_name : "No winner"}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={(e) => { e.stopPropagation(); fireConfetti() }} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-2 text-sm font-semibold hover:bg-white/20">
              <Sparkles className="h-4 w-4 text-amber-300" /> More confetti
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
