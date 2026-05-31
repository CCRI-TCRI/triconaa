"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check,
  User,
  Trophy,
  Users,
  Briefcase,
  Clock,
  AlertTriangle,
  Loader2,
  Lock,
  ChevronRight,
  ChevronLeft,
  ScrollText,
  ShieldCheck,
} from "lucide-react"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import type { Position, Candidate } from "@/lib/db"
import { toast } from "sonner"

interface PositionWithCandidates extends Position {
  candidates: Candidate[]
}

interface VotingBallotProps {
  studentId: string
  onVoteComplete: () => void
}

const MAROON = "#7a1f2b"

export function VotingBallot({ studentId, onVoteComplete }: VotingBallotProps) {
  const [positions, setPositions] = useState<PositionWithCandidates[]>([])
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0)
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchElectionData()
  }, [])

  useEffect(() => {
    if (timeLeft > 0 && !showConfirmation && !isLoading) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      handleTimeExpired()
    }
  }, [timeLeft, showConfirmation, isLoading])

  const handleTimeExpired = useCallback(() => {
    toast.error("Voting time has expired. You will be logged out.")
    setTimeout(() => window.location.reload(), 2000)
  }, [])

  const fetchElectionData = async () => {
    setIsLoading(true)
    try {
      const positionsWithCandidates = await getPositionsWithCandidates()
      const validPositions = positionsWithCandidates.filter((p) => p.candidates && p.candidates.length > 0)
      if (validPositions.length === 0) {
        toast.error("No candidates available for voting at this time.")
        return
      }
      setPositions(validPositions)
      toast.success(`Loaded ${validPositions.length} positions with candidates`)
    } catch (error) {
      console.error("Error fetching election data:", error)
      toast.error("Failed to load election data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const currentPosition = positions[currentPositionIndex]
  const votedCount = Object.keys(votes).length

  const isPositionLocked = (index: number) => {
    if (index === 0) return false
    return !votes[positions[index - 1]?.id]
  }

  const handleVote = async (candidateId: string) => {
    if (currentPosition && !isTransitioning) {
      setIsTransitioning(true)
      setVotes((prev) => ({ ...prev, [currentPosition.id]: candidateId }))
      await new Promise((resolve) => setTimeout(resolve, 700))
      const nextIndex = currentPositionIndex + 1
      if (nextIndex < positions.length) {
        setCurrentPositionIndex(nextIndex)
      } else {
        setShowConfirmation(true)
      }
      setIsTransitioning(false)
    }
  }

  const handlePositionClick = (index: number) => {
    if (!isPositionLocked(index)) setCurrentPositionIndex(index)
  }

  const submitVotes = async () => {
    setIsSubmitting(true)
    try {
      const user = await userDb.getById(studentId)
      if (!user) {
        toast.error("User not found. Please contact the election committee.")
        return
      }
      if (user.has_voted) {
        toast.error("You have already voted. Each voting token can only be used once.")
        onVoteComplete()
        return
      }

      const voteRecords = Object.entries(votes).map(([positionId, candidateId]) => ({
        user_id: user.id,
        candidate_id: candidateId,
        position_id: positionId,
      }))

      const success = await voteDb.createBatch(voteRecords)
      if (!success) {
        toast.error("Failed to submit votes. Please try again.")
        return
      }

      await userDb.markAsVoted(user.id)
      toast.success("Votes submitted successfully!")
      onVoteComplete()
    } catch (error) {
      console.error("Error submitting votes:", error)
      toast.error("Failed to submit votes. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoryIcon = (categoryName: string, className = "w-5 h-5") => {
    const cat = categoryName.toLowerCase()
    if (cat.includes("senior") || cat.includes("head")) return <Trophy className={className} />
    if (cat.includes("sport") || cat.includes("game")) return <Users className={className} />
    if (cat.includes("house")) return <Briefcase className={className} />
    return <User className={className} />
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")

  // ── Shared chrome ───────────────────────────────────────────
  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf7f2] via-[#fbeee6] to-[#f1d9c8]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-rose-900/10 bg-gradient-to-r from-[#5c0f1f] via-[#7a1f2b] to-[#5c0f1f] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-2 ring-amber-300/50">
              <img src="/logo.png" alt="St. Theresa S.S." className="h-9 w-9 object-contain" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold sm:text-base">St. Theresa S.S. Buloba-Kasero</h1>
              <p className="text-[11px] italic text-amber-200/90">"Mercy Upon Us" · Official Ballot</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
              timeLeft <= 60 ? "bg-red-500 text-white" : "bg-white/15 text-amber-100 ring-1 ring-white/20"
            }`}
          >
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
            {timeLeft <= 60 && (
              <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <AlertTriangle className="h-4 w-4" />
              </motion.span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <Loader2 className="mb-4 h-12 w-12 animate-spin" style={{ color: MAROON }} />
          <h2 className="text-xl font-bold text-rose-900">Preparing your ballot…</h2>
          <p className="mt-1 text-rose-800/60">Fetching candidates, please wait.</p>
        </div>
      </PageShell>
    )
  }

  if (!currentPosition || positions.length === 0) {
    return (
      <PageShell>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-rose-900/10 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-rose-900">No Candidates Available</h2>
          <p className="mb-6 mt-2 text-gray-600">
            There are currently no candidates available for voting. Please contact the election committee.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]">
            Refresh Page
          </Button>
        </div>
      </PageShell>
    )
  }

  // ── Confirmation (ballot receipt) ───────────────────────────
  if (showConfirmation) {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-rose-900/10 bg-white shadow-2xl"
        >
          <div className="border-b border-dashed border-rose-900/20 bg-gradient-to-b from-rose-50 to-white px-8 py-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow">
              <ShieldCheck className="h-7 w-7 text-rose-950" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-rose-900">Review Your Ballot</h2>
            <p className="mt-1 text-sm text-gray-500">Confirm your selections before casting · {formatTime(timeLeft)} left</p>
          </div>

          <div className="divide-y divide-gray-100 px-6 py-2">
            {positions.map((position, i) => {
              const selectedCandidate = position.candidates.find((c) => c.id === votes[position.id])
              return (
                <div key={position.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-sm font-bold text-rose-300">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">{position.name}</p>
                      {selectedCandidate ? (
                        <p className="font-semibold text-gray-900">{selectedCandidate.full_name}</p>
                      ) : (
                        <p className="font-semibold text-amber-600">No selection</p>
                      )}
                    </div>
                  </div>
                  {selectedCandidate && (
                    <Avatar className="h-9 w-9 ring-2 ring-rose-200">
                      <AvatarImage src={selectedCandidate.photo_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-[#7a1f2b] text-xs text-white">
                        {initials(selectedCandidate.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-3 px-6 pb-6 pt-3">
            <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
              Once cast, your voting token cannot be used again.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => setShowConfirmation(false)}
                variant="outline"
                disabled={isSubmitting}
                className="border-rose-200 text-rose-800 hover:bg-rose-50 sm:w-1/3"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={submitVotes}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-[#7a1f2b] to-[#5c0f1f] font-semibold text-white shadow-lg hover:from-[#8d2533] hover:to-[#6b1226]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Casting Ballot…
                  </>
                ) : (
                  <>
                    <ScrollText className="mr-2 h-4 w-4" />
                    Cast My Ballot
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </PageShell>
    )
  }

  // ── Main ballot ─────────────────────────────────────────────
  const progressPct = Math.round((votedCount / positions.length) * 100)

  return (
    <PageShell>
      {/* Stepper */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-rose-800/70">
          <span>
            Position {currentPositionIndex + 1} of {positions.length}
          </span>
          <span>{progressPct}% complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          {positions.map((position, index) => {
            const hasVote = !!votes[position.id]
            const isActive = index === currentPositionIndex
            const locked = isPositionLocked(index)
            return (
              <button
                key={position.id}
                onClick={() => handlePositionClick(index)}
                disabled={locked}
                title={position.name}
                className={`h-2 flex-1 rounded-full transition-all ${
                  isActive
                    ? "bg-[#7a1f2b]"
                    : hasVote
                      ? "bg-amber-400"
                      : locked
                        ? "cursor-not-allowed bg-rose-900/10"
                        : "bg-rose-900/20 hover:bg-rose-900/30"
                }`}
              />
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPositionIndex}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className="overflow-hidden rounded-2xl border border-rose-900/10 bg-white shadow-xl"
        >
          {/* Ballot title block */}
          <div className="border-b border-dashed border-rose-900/15 bg-gradient-to-b from-rose-50/70 to-white px-6 py-5 text-center sm:px-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#7a1f2b]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#7a1f2b]">
              {getCategoryIcon(currentPosition.category, "w-4 h-4")}
              {currentPosition.category}
            </div>
            <h2 className="font-serif text-3xl font-bold text-rose-900 sm:text-4xl">{currentPosition.name}</h2>
            {currentPosition.description && (
              <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{currentPosition.description}</p>
            )}
            <p className="mt-2 text-xs text-rose-800/50">Select one candidate to continue</p>
          </div>

          {/* Candidate options */}
          <div className="space-y-3 p-4 sm:p-6">
            {currentPosition.candidates.map((candidate, index) => {
              const selected = votes[currentPosition.id] === candidate.id
              return (
                <motion.button
                  key={candidate.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => handleVote(candidate.id)}
                  disabled={isTransitioning}
                  className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    selected
                      ? "border-[#7a1f2b] bg-rose-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 hover:shadow"
                  } ${isTransitioning ? "pointer-events-none" : ""}`}
                >
                  {/* radio */}
                  <div
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      selected ? "border-[#7a1f2b] bg-[#7a1f2b]" : "border-gray-300 bg-white"
                    }`}
                  >
                    {selected && <Check className="h-4 w-4 text-white" />}
                  </div>

                  <Avatar className={`h-14 w-14 shrink-0 ring-2 ${selected ? "ring-[#7a1f2b]" : "ring-gray-200"}`}>
                    <AvatarImage src={candidate.photo_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-gradient-to-br from-[#7a1f2b] to-[#5c0f1f] font-semibold text-white">
                      {initials(candidate.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="text-lg font-bold text-gray-900">{candidate.full_name}</h3>
                      <span className="text-sm text-gray-500">{candidate.class}</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {candidate.student_id}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">
                      {candidate.manifesto || "No manifesto provided."}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-4 sm:px-6">
            <Button
              onClick={() => setCurrentPositionIndex(Math.max(0, currentPositionIndex - 1))}
              disabled={currentPositionIndex === 0}
              variant="ghost"
              className="text-rose-800 hover:bg-rose-50 disabled:opacity-40"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={() => {
                if (votes[currentPosition.id]) {
                  const next = currentPositionIndex + 1
                  if (next < positions.length) setCurrentPositionIndex(next)
                  else setShowConfirmation(true)
                } else {
                  toast.info("Please select a candidate first")
                }
              }}
              disabled={!votes[currentPosition.id]}
              className="bg-[#7a1f2b] font-semibold text-white hover:bg-[#5c0f1f] disabled:opacity-40"
            >
              {currentPositionIndex === positions.length - 1 ? "Review Ballot" : "Next"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </PageShell>
  )
}
