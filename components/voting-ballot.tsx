"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle,
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
  Crown,
  Sparkles,
  ShieldCheck,
  Vote,
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

// Soft, animated decorative background shared by every ballot screen
function RoyalBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="animate-royal-gradient absolute inset-0" />
      <motion.div
        className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-rose-500/25 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {/* subtle grid sheen */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
    </div>
  )
}

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
      const validPositions = positionsWithCandidates.filter(
        (p) => p.candidates && p.candidates.length > 0
      )
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
      await new Promise((resolve) => setTimeout(resolve, 800))
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

  const getCategoryIcon = (categoryName: string, className = "w-6 h-6") => {
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

  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <RoyalBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center text-white"
        >
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-300/40 border-t-amber-300"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <Crown className="h-10 w-10 text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Preparing your Royal Ballot</h2>
          <p className="mt-1 text-rose-100/90">Fetching candidates, please wait…</p>
        </motion.div>
      </div>
    )
  }

  if (!currentPosition || positions.length === 0) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <RoyalBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 max-w-md rounded-2xl border border-white/15 bg-white/10 p-8 text-center text-white backdrop-blur-xl"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20">
            <AlertTriangle className="h-8 w-8 text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold">No Candidates Available</h2>
          <p className="mt-2 mb-6 text-rose-100/90">
            There are currently no candidates available for voting. Please contact the election committee.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-white/15 text-white hover:bg-white/25 border border-white/30"
          >
            Refresh Page
          </Button>
        </motion.div>
      </div>
    )
  }

  if (showConfirmation) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <RoyalBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-2xl"
        >
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            {/* gold header band */}
            <div className="bg-gradient-to-r from-amber-400/20 via-amber-300/10 to-transparent px-8 pt-8 pb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg">
                <ShieldCheck className="h-7 w-7 text-rose-950" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Confirm Your Votes</h2>
              <p className="mt-1 text-rose-100/90">Review your selections before casting your ballot</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-emerald-300">
                <Clock className="h-4 w-4" />
                Time remaining: {formatTime(timeLeft)}
              </div>
            </div>

            <div className="space-y-3 px-6 py-6">
              {positions.map((position) => {
                const selectedCandidateId = votes[position.id]
                const selectedCandidate = position.candidates.find((c) => c.id === selectedCandidateId)
                return (
                  <div
                    key={position.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-300">
                        {getCategoryIcon(position.category, "w-5 h-5")}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-rose-200/80">{position.category}</p>
                        <p className="font-semibold">{position.name}</p>
                      </div>
                    </div>
                    {selectedCandidate ? (
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="font-semibold text-emerald-300">{selectedCandidate.full_name}</p>
                          <p className="text-xs text-rose-100/90">{selectedCandidate.class}</p>
                        </div>
                        <Avatar className="h-10 w-10 ring-2 ring-emerald-400/50">
                          <AvatarImage src={selectedCandidate.photo_url || "/placeholder.svg"} />
                          <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-xs text-rose-950">
                            {initials(selectedCandidate.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <span className="text-sm text-amber-300">⚠ No selection</span>
                    )}
                  </div>
                )
              })}

              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-200">
                Once submitted, your voting token cannot be used again.
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Button
                  onClick={() => setShowConfirmation(false)}
                  variant="outline"
                  disabled={isSubmitting}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/15 sm:w-1/3"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to ballot
                </Button>
                <Button
                  onClick={submitVotes}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-rose-950 shadow-lg transition hover:from-amber-300 hover:to-amber-500"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Votes…
                    </>
                  ) : (
                    <>
                      <Vote className="mr-2 h-4 w-4" />
                      Cast My Ballot
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  const progressPct = Math.round((votedCount / positions.length) * 100)

  return (
    <div className="relative min-h-screen p-4 sm:p-6">
      <RoyalBackground />
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Branded header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-xl sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-amber-300/40">
              <img src="/logo.png" alt="St. Theresa S.S. Buloba-Kasero" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-300" />
                <h1 className="text-lg font-bold leading-none text-white sm:text-xl">St. Theresa S.S. Buloba-Kasero</h1>
              </div>
              <p className="text-xs italic text-amber-200/80">"Mercy Upon Us" · Royal Ballot Elections</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              timeLeft <= 60
                ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                : "bg-white/10 text-white ring-1 ring-white/15"
            }`}
          >
            <Clock className={`h-4 w-4 ${timeLeft <= 60 ? "text-red-300" : "text-amber-300"}`} />
            {formatTime(timeLeft)}
            {timeLeft <= 60 && (
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <AlertTriangle className="h-4 w-4 text-red-300" />
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between text-sm text-rose-100/90">
            <span>
              {votedCount} of {positions.length} positions selected
            </span>
            <span className="font-semibold text-amber-300">{progressPct}% complete</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Positions List Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-white/15 bg-white/10 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  Positions
                </CardTitle>
                <p className="text-sm text-rose-100/90">Choose a candidate for each role</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {positions.map((position, index) => {
                  const isLocked = isPositionLocked(index)
                  const isActive = index === currentPositionIndex
                  const hasVote = !!votes[position.id]
                  return (
                    <motion.div
                      key={position.id}
                      whileHover={!isLocked ? { scale: 1.02 } : {}}
                      whileTap={!isLocked ? { scale: 0.98 } : {}}
                    >
                      <div
                        onClick={() => handlePositionClick(index)}
                        className={`rounded-xl border p-3.5 transition-all duration-300 ${
                          isActive
                            ? "border-amber-300/60 bg-amber-300/10 shadow-lg shadow-amber-500/10"
                            : hasVote
                              ? "cursor-pointer border-emerald-400/40 bg-emerald-500/10"
                              : isLocked
                                ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
                                : "cursor-pointer border-white/15 bg-white/5 hover:border-amber-300/40 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-1 items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                isActive
                                  ? "bg-gradient-to-br from-amber-300 to-amber-500 text-rose-950"
                                  : hasVote
                                    ? "bg-emerald-500 text-white"
                                    : isLocked
                                      ? "bg-white/10 text-white/70"
                                      : "bg-white/15 text-white"
                              }`}
                            >
                              {hasVote ? (
                                <CheckCircle className="h-5 w-5" />
                              ) : isLocked ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate font-medium ${isActive ? "text-amber-200" : ""}`}>
                                {position.name}
                              </p>
                              <p className="truncate text-xs text-rose-200/80">{position.category}</p>
                            </div>
                          </div>
                          {isActive && <ChevronRight className="h-5 w-5 text-amber-300" />}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Voting Card */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPositionIndex}
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="overflow-hidden border-white/15 bg-white/10 text-white backdrop-blur-xl">
                  <CardHeader className="bg-gradient-to-b from-white/10 to-transparent text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/30 to-amber-500/20 text-amber-300 ring-1 ring-amber-300/30">
                      {getCategoryIcon(currentPosition.category, "w-7 h-7")}
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                      {currentPosition.category}
                    </p>
                    <CardTitle className="mt-1 text-2xl font-bold sm:text-3xl">{currentPosition.name}</CardTitle>
                    {currentPosition.description && (
                      <p className="mt-2 text-rose-100/90">{currentPosition.description}</p>
                    )}
                    <Badge
                      variant="secondary"
                      className="mx-auto mt-3 bg-white/15 text-white hover:bg-white/15"
                    >
                      Position {currentPositionIndex + 1} of {positions.length}
                    </Badge>
                    <p className="mt-2 text-sm text-amber-200/80">Tap a candidate to select and continue</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {currentPosition.candidates.map((candidate, index) => {
                        const selected = votes[currentPosition.id] === candidate.id
                        return (
                          <motion.div
                            key={candidate.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
                              selected
                                ? "border-amber-300/70 bg-amber-300/10 shadow-xl shadow-amber-500/20 ring-2 ring-amber-300/50"
                                : "border-white/15 bg-white/5 hover:-translate-y-1 hover:border-amber-300/40 hover:bg-white/10 hover:shadow-lg"
                            } ${isTransitioning ? "pointer-events-none" : ""}`}
                            onClick={() => handleVote(candidate.id)}
                            whileTap={{ scale: isTransitioning ? 1 : 0.98 }}
                          >
                            {selected && (
                              <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg"
                              >
                                <Crown className="h-5 w-5 text-rose-950" />
                              </motion.div>
                            )}
                            <div className="mb-4 flex items-center gap-4">
                              <Avatar
                                className={`h-16 w-16 ring-2 transition ${
                                  selected ? "ring-amber-300" : "ring-white/20 group-hover:ring-amber-300/50"
                                }`}
                              >
                                <AvatarImage src={candidate.photo_url || "/placeholder.svg"} />
                                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 font-semibold text-rose-950">
                                  {initials(candidate.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <h3 className="truncate text-lg font-bold">{candidate.full_name}</h3>
                                <p className="text-sm text-rose-100/90">{candidate.class}</p>
                                <p className="text-xs text-rose-200/80">ID: {candidate.student_id}</p>
                              </div>
                            </div>
                            <p className="line-clamp-3 rounded-lg bg-black/10 p-3 text-sm leading-relaxed text-rose-50">
                              {candidate.manifesto || "No manifesto provided."}
                            </p>
                            <div
                              className={`mt-3 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                                selected
                                  ? "bg-amber-300/20 text-amber-200"
                                  : "bg-white/5 text-rose-100/90 group-hover:bg-amber-300/10 group-hover:text-amber-200"
                              }`}
                            >
                              {selected ? (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Selected
                                </>
                              ) : (
                                <>
                                  <Vote className="h-4 w-4" />
                                  Tap to select
                                </>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    <div className="mt-6 flex justify-between">
                      <Button
                        onClick={() => setCurrentPositionIndex(Math.max(0, currentPositionIndex - 1))}
                        disabled={currentPositionIndex === 0}
                        variant="outline"
                        className="border-white/20 bg-white/5 text-white hover:bg-white/15"
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
                        className="bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-rose-950 hover:from-amber-300 hover:to-amber-500"
                      >
                        {currentPositionIndex === positions.length - 1 ? "Review" : "Next"}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
