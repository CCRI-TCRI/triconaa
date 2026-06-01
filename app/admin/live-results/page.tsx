"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import type { Candidate } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { CheckCircle2, Circle } from "lucide-react"

interface PositionResult {
  position_name: string
  category: string
  total_votes: number
  candidates: Candidate[] // sorted desc by vote_count
}

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
      const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % results.length), 8000)
      return () => clearInterval(interval)
    }
  }, [results.length])

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      )
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
          .map((c) => ({
            ...c,
            vote_count: positionVotes.filter((v) => v.candidate_id === c.id).length,
          }))
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
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-red-900 border-t-red-500"
          />
          <p className="text-2xl font-black uppercase tracking-wider text-white">{schoolName}</p>
          <p className="mt-2 text-neutral-400">Gathering live results…</p>
        </motion.div>
      </div>
    )
  }

  const current = results[currentIndex]
  const leader = current.candidates[0]
  const timeUntilNext = 8 - Math.floor((Date.now() / 1000) % 8)

  // Ticker entries: leader of every race
  const tickerItems = results.map((r) => {
    const top = r.candidates[0]
    return top && r.total_votes > 0
      ? `${r.position_name.toUpperCase()}: ${top.full_name} LEADS WITH ${top.vote_count} VOTE${top.vote_count === 1 ? "" : "S"}`
      : `${r.position_name.toUpperCase()}: AWAITING FIRST VOTES`
  })

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-neutral-800 bg-[#111]">
        <div className="flex items-center gap-3 bg-red-600 px-6 py-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
            <img src={logoUrl} alt={schoolName} className="h-9 w-9 object-contain" />
          </div>
          <div className="max-w-[220px] leading-none">
            <p className="truncate text-sm font-black uppercase tracking-tight">{schoolName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-100">Election Center</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between px-6">
          <h1 className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
            Election Center <span className="text-red-500">·</span> Live Results
          </h1>
          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-sm text-neutral-400 sm:inline">{clock}</span>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex items-center gap-2 rounded-sm bg-red-600 px-3 py-1.5"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
              <span className="text-sm font-black uppercase tracking-widest">Live</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-neutral-800 border-b border-neutral-800 bg-[#141414] sm:grid-cols-4">
        {[
          { label: "Votes Counted", value: analytics.totalVotes.toLocaleString() },
          { label: "Turnout", value: `${analytics.turnout.toFixed(1)}%` },
          { label: "Students Voted", value: `${analytics.votedCount}/${analytics.totalVoters}` },
          { label: "Races Reporting", value: `${analytics.reporting}/${analytics.totalPositions}` },
        ].map((item) => (
          <div key={item.label} className="px-6 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{item.label}</p>
            <p className="mt-0.5 text-2xl font-black tabular-nums text-white sm:text-3xl">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main race board ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden px-6 py-5 sm:px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5 }}
            className="flex flex-1 flex-col"
          >
            {/* Race header — CNN "Key Race Alert" lower-third style */}
            <div className="mb-5 flex items-center gap-4">
              <div className="bg-red-600 px-3 py-1.5">
                <span className="text-xs font-black uppercase tracking-widest">Key Race</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-500">{current.category}</p>
                <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-5xl">
                  {current.position_name}
                </h2>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{current.total_votes}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Votes Cast</p>
              </div>
            </div>

            {/* Candidate rows */}
            <div className="flex flex-1 flex-col justify-center gap-3">
              {current.candidates.map((candidate, idx) => {
                const pct = current.total_votes > 0 ? (candidate.vote_count / current.total_votes) * 100 : 0
                const isLeader = idx === 0 && candidate.vote_count > 0
                return (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`relative flex items-center gap-4 overflow-hidden rounded-sm border px-4 py-3 ${
                      isLeader ? "border-red-600 bg-red-950/30" : "border-neutral-800 bg-[#141414]"
                    }`}
                  >
                    {/* rank */}
                    <span
                      className={`w-6 text-center text-lg font-black tabular-nums ${
                        isLeader ? "text-red-500" : "text-neutral-600"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {/* avatar */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${
                        isLeader ? "border-red-500" : "border-neutral-700"
                      } bg-neutral-800`}
                    >
                      {candidate.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-neutral-300">{initials(candidate.full_name)}</span>
                      )}
                    </div>

                    {/* name + bar */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <p className="truncate text-lg font-bold text-white sm:text-xl">{candidate.full_name}</p>
                        <span className="truncate text-xs uppercase tracking-wide text-neutral-500">
                          {candidate.class}
                        </span>
                        {isLeader ? (
                          <span className="ml-1 flex items-center gap-1 rounded-sm bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                            <CheckCircle2 className="h-3 w-3" />
                            Leading
                          </span>
                        ) : (
                          <Circle className="h-2 w-2 fill-neutral-700 text-neutral-700" />
                        )}
                      </div>
                      <div className="h-5 w-full overflow-hidden rounded-sm bg-neutral-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-sm ${
                            isLeader
                              ? "bg-gradient-to-r from-red-600 to-red-500"
                              : "bg-gradient-to-r from-neutral-600 to-neutral-500"
                          }`}
                        />
                      </div>
                    </div>

                    {/* numbers */}
                    <div className="w-24 text-right">
                      <p className="text-2xl font-black tabular-nums text-white">{pct.toFixed(1)}%</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        {candidate.vote_count} vote{candidate.vote_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Projection line */}
            <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3">
              <p className="text-sm font-semibold text-neutral-400">
                {leader && leader.vote_count > 0 ? (
                  <>
                    <span className="font-black text-red-500">PROJECTED LEADER:</span>{" "}
                    <span className="text-white">{leader.full_name}</span>
                  </>
                ) : (
                  <span className="text-neutral-500">Awaiting first votes in this race…</span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {results.map((_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentIndex ? "w-8 bg-red-500" : "w-1.5 bg-neutral-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-neutral-500">Next race in {timeUntilNext}s</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Breaking-news ticker ────────────────────────────── */}
      <div className="flex items-stretch border-t border-neutral-800 bg-black">
        <div className="z-10 flex items-center bg-red-600 px-5">
          <span className="text-sm font-black uppercase tracking-widest">Breaking</span>
        </div>
        <div className="relative flex-1 overflow-hidden py-3">
          <div className="animate-ticker">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="mx-8 text-sm font-bold uppercase tracking-wide text-neutral-200">
                <span className="mr-8 text-red-500">●</span>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="z-10 hidden items-center bg-[#111] px-5 sm:flex">
          <span className="font-mono text-sm text-neutral-400">{clock}</span>
        </div>
      </div>
    </div>
  )
}
