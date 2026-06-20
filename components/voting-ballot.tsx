"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
  Info,
} from "lucide-react"
import { getPositionsWithCandidates, voteDb, userDb, electionControl } from "@/lib/db"
import type { Position, Candidate } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { toast } from "sonner"

interface PositionWithCandidates extends Position {
  candidates: Candidate[]
}

interface VotingBallotProps {
  studentId: string
  onVoteComplete: (receipt?: string) => void
}

const MAROON = "#168AAD"
const ABSTAIN = "ABSTAIN" // sentinel stored in `votes` when a voter abstains on a position

// ── Lightweight ballot localisation (English / Luganda) ─────────
type Lang = "en" | "lg"
const DICT: Record<string, { en: string; lg: string }> = {
  ballot: { en: "Official Ballot", lg: "Akalulu" },
  selectOne: { en: "Select one candidate", lg: "Londa omu" },
  previous: { en: "Previous", lg: "Emabega" },
  next: { en: "Next", lg: "Mu maaso" },
  review: { en: "Review Ballot", lg: "Kebera akalulu" },
  viewDetails: { en: "View details", lg: "Laba ebisingawo" },
  cast: { en: "Cast My Ballot", lg: "Weereza akalulu" },
  back: { en: "Back", lg: "Emabega" },
  reviewTitle: { en: "Review Your Ballot", lg: "Kebera akalulu ko" },
  selectFirst: { en: "Please select a candidate first", lg: "Sooka olonde omu" },
  noManifesto: { en: "No manifesto provided.", lg: "Tewali manifesto." },
}
const LANG_KEY = "ballot-lang"

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Module-level so it keeps a stable identity — otherwise the whole ballot would
// remount (and animations/inputs would reset) on every timer tick.
function BallotShell({
  schoolName,
  motto,
  logoUrl,
  timeLeft,
  children,
  lang = "en",
  onToggleLang,
}: {
  schoolName: string
  motto: string
  logoUrl: string
  timeLeft: number
  children: React.ReactNode
  lang?: Lang
  onToggleLang?: () => void
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="flex-none bg-gradient-to-r from-[#1A759F] via-[#168AAD] to-[#1A759F] text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-[#D9ED92]/50">
              <img src={logoUrl} alt={schoolName} className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-semibold sm:text-base">{schoolName}</h1>
              <p className="truncate text-[11px] text-[#D9ED92]/90">"{motto}" · {DICT.ballot[lang]}</p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            {onToggleLang && (
              <button
                onClick={onToggleLang}
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[#D9ED92] ring-1 ring-white/15 hover:bg-white/20"
                aria-label="Switch language"
              >
                {lang === "en" ? "EN" : "LG"}
              </button>
            )}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums sm:gap-2 sm:px-3 ${
                timeLeft <= 60 ? "bg-red-500 text-white" : "bg-white/10 text-[#D9ED92] ring-1 ring-white/15"
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
        </div>
        <div className="h-1 bg-gradient-to-r from-[#D9ED92] via-[#76C893] to-[#34A0A4]" />
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}

// Candidate photo with a graceful initials fallback. Uses a plain <img> (with an
// onError guard) rather than Radix Avatar — the latter silently falls back to
// initials if the image hasn't finished loading, which hid real photos.
function CandidatePhoto({
  src,
  name,
  className = "",
  textClass = "text-sm",
}: {
  src?: string | null
  name: string
  className?: string
  textClass?: string
}) {
  const [errored, setErrored] = useState(false)
  const ini = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  const showImg = src && src.trim() !== "" && !errored
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-[#168AAD]/10 ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt={name} onError={() => setErrored(true)} className="h-full w-full object-cover" />
      ) : (
        <span className={`font-semibold text-[#168AAD] ${textClass}`}>{ini}</span>
      )}
    </div>
  )
}

// Lists positions whose single candidate is elected unopposed. Shown for transparency
// but never votable.
function UnopposedList({ positions }: { positions: PositionWithCandidates[] }) {
  if (positions.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 bg-emerald-50/60 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Elected unopposed · not on the ballot
      </div>
      <div className="divide-y divide-slate-100">
        {positions.map((position) => {
          const candidate = position.candidates[0]
          return (
            <div key={position.id} className="flex items-center justify-between gap-4 px-6 py-2.5">
              <div className="flex items-center gap-3">
                <CandidatePhoto
                  src={candidate?.photo_url}
                  name={candidate?.full_name || ""}
                  className="h-9 w-9 flex-none rounded-full ring-1 ring-slate-200"
                  textClass="text-xs"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{position.name}</p>
                  <p className="font-semibold text-slate-900">{candidate?.full_name}</p>
                </div>
              </div>
              <span className="flex-none rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Unopposed
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VotingBallot({ studentId, onVoteComplete }: VotingBallotProps) {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
  const [positions, setPositions] = useState<PositionWithCandidates[]>([])
  const [unopposedPositions, setUnopposedPositions] = useState<PositionWithCandidates[]>([])
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0)
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [detail, setDetail] = useState<Candidate | null>(null)
  const [lang, setLang] = useState<Lang>("en")
  const t = (k: keyof typeof DICT) => DICT[k][lang]

  useEffect(() => {
    const saved = (localStorage.getItem(LANG_KEY) as Lang) || "en"
    setLang(saved)
  }, [])
  const toggleLang = () => setLang((l) => { const n = l === "en" ? "lg" : "en"; localStorage.setItem(LANG_KEY, n); return n })

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
      const [{ includeUnopposed }, positionsWithCandidates] = await Promise.all([
        electionControl.get(),
        getPositionsWithCandidates(),
      ])
      const withCandidates = positionsWithCandidates.filter((p) => p.candidates && p.candidates.length > 0)
      // A position with a single candidate is uncontested. By default that candidate is
      // elected unopposed and kept off the ballot — unless the admin has chosen to
      // include unopposed positions on the ballot.
      const votable = includeUnopposed ? withCandidates : withCandidates.filter((p) => p.candidates.length >= 2)
      const unopposed = includeUnopposed ? [] : withCandidates.filter((p) => p.candidates.length === 1)
      setUnopposedPositions(unopposed)
      setPositions(votable)
      if (votable.length === 0) {
        if (unopposed.length === 0) toast.error("No candidates available for voting at this time.")
        return
      }
      toast.success(`Loaded ${votable.length} position${votable.length === 1 ? "" : "s"} for voting`)
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

      const voteRecords = Object.entries(votes).map(([positionId, candidateId]) =>
        candidateId === ABSTAIN
          ? { user_id: user.id, candidate_id: null, position_id: positionId, is_abstain: true }
          : { user_id: user.id, candidate_id: candidateId, position_id: positionId, is_abstain: false },
      )

      const success = await voteDb.createBatch(voteRecords)
      if (!success) {
        toast.error("Failed to submit votes. Please try again.")
        return
      }

      const receipt = await userDb.markAsVoted(user.id)
      toast.success("Votes submitted successfully!")
      onVoteComplete(receipt)
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

  // ── Shared chrome ───────────────────────────────────────────
  if (isLoading) {
    return (
      <BallotShell schoolName={schoolName} motto={motto} logoUrl={logoUrl} timeLeft={timeLeft}>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin" style={{ color: MAROON }} />
          <h2 className="text-lg font-semibold text-slate-800">Preparing your ballot…</h2>
          <p className="mt-1 text-sm text-slate-500">Fetching candidates, please wait.</p>
        </div>
      </BallotShell>
    )
  }

  if (!currentPosition || positions.length === 0) {
    // Nothing contested to vote on. If every position is uncontested, tell the voter
    // those seats were filled unopposed rather than showing a generic empty state.
    if (unopposedPositions.length > 0) {
      return (
        <BallotShell schoolName={schoolName} motto={motto} logoUrl={logoUrl} timeLeft={timeLeft}>
          <div className="h-full overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#168AAD]/10">
                  <ShieldCheck className="h-6 w-6 text-[#168AAD]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nothing to Vote On</h2>
                  <p className="text-xs text-slate-500">
                    Every position has a single, unopposed candidate — there are no contested races on your ballot.
                  </p>
                </div>
              </div>
              <UnopposedList positions={unopposedPositions} />
              <div className="border-t border-slate-100 px-6 py-4">
                <Button onClick={onVoteComplete} className="w-full bg-[#168AAD] font-semibold text-white hover:bg-[#1A759F]">
                  Done
                </Button>
              </div>
            </div>
          </div>
        </BallotShell>
      )
    }
    return (
      <BallotShell schoolName={schoolName} motto={motto} logoUrl={logoUrl} timeLeft={timeLeft}>
        <div className="flex h-full items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No Candidates Available</h2>
            <p className="mb-6 mt-2 text-sm text-slate-500">
              There are currently no candidates available for voting. Please contact the election committee.
            </p>
            <Button onClick={() => window.location.reload()} className="bg-[#168AAD] text-white hover:bg-[#1A759F]">
              Refresh Page
            </Button>
          </div>
        </div>
      </BallotShell>
    )
  }

  // ── Confirmation (ballot receipt) ───────────────────────────
  if (showConfirmation) {
    return (
      <BallotShell schoolName={schoolName} motto={motto} logoUrl={logoUrl} timeLeft={timeLeft} lang={lang} onToggleLang={toggleLang}>
        <div className="h-full overflow-y-auto px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#168AAD]/10">
                <ShieldCheck className="h-6 w-6 text-[#168AAD]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t("reviewTitle")}</h2>
                <p className="text-xs text-slate-500">Confirm your selections before casting · {formatTime(timeLeft)} left</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {positions.map((position, i) => {
                const selectedCandidate = position.candidates.find((c) => c.id === votes[position.id])
                return (
                  <div key={position.id} className="flex items-center justify-between gap-4 px-6 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm font-semibold tabular-nums text-slate-300">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{position.name}</p>
                        {selectedCandidate ? (
                          <p className="font-semibold text-slate-900">{selectedCandidate.full_name}</p>
                        ) : votes[position.id] === ABSTAIN ? (
                          <p className="font-semibold text-amber-600">Abstained</p>
                        ) : (
                          <p className="font-semibold text-amber-600">No selection</p>
                        )}
                      </div>
                    </div>
                    {selectedCandidate && (
                      <CandidatePhoto
                        src={selectedCandidate.photo_url}
                        name={selectedCandidate.full_name}
                        className="h-9 w-9 flex-none rounded-full ring-1 ring-slate-200"
                        textClass="text-xs"
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <UnopposedList positions={unopposedPositions} />

            <div className="space-y-3 border-t border-slate-100 px-6 py-4">
              <p className="rounded-md bg-slate-50 px-4 py-2 text-center text-xs text-slate-500">
                Once cast, your voting token cannot be used again.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => setShowConfirmation(false)}
                  variant="outline"
                  disabled={isSubmitting}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 sm:w-1/3"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("back")}
                </Button>
                <Button
                  onClick={submitVotes}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#168AAD] font-semibold text-white shadow-sm hover:bg-[#1A759F]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Casting Ballot…
                    </>
                  ) : (
                    <>
                      <ScrollText className="mr-2 h-4 w-4" />
                      {t("cast")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </BallotShell>
    )
  }

  // ── Main ballot ─────────────────────────────────────────────
  const progressPct = Math.round((votedCount / positions.length) * 100)

  return (
    <BallotShell schoolName={schoolName} motto={motto} logoUrl={logoUrl} timeLeft={timeLeft} lang={lang} onToggleLang={toggleLang}>
      <div className="mx-auto flex h-full max-w-5xl flex-col px-3 py-3 sm:px-4">
        {/* Stepper */}
        <div className="mb-3 flex-none">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Position {currentPositionIndex + 1} of {positions.length}
            </span>
            <span>{progressPct}% complete</span>
          </div>
          <div className="flex items-center gap-1">
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
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    isActive
                      ? "bg-[#168AAD]"
                      : hasVote
                        ? "bg-[#168AAD]/50"
                        : locked
                          ? "cursor-not-allowed bg-slate-200"
                          : "bg-slate-200 hover:bg-slate-300"
                  }`}
                />
              )
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPositionIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Title block */}
            <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#168AAD]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#168AAD]">
                  {getCategoryIcon(currentPosition.category, "w-3.5 h-3.5")}
                  {currentPosition.category}
                </div>
                <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">{currentPosition.name}</h2>
              </div>
              <span className="hidden flex-none rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 sm:block">
                {t("selectOne")}
              </span>
            </div>

            {/* Candidate options (scrolls) */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {currentPosition.candidates.map((candidate) => {
                  const selected = votes[currentPosition.id] === candidate.id
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => handleVote(candidate.id)}
                      disabled={isTransitioning}
                      className={`group relative flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition-all sm:gap-4 sm:p-4 ${
                        selected
                          ? "border-[#168AAD] ring-2 ring-[#168AAD]/30"
                          : "border-slate-200 hover:-translate-y-0.5 hover:border-[#168AAD]/40 hover:shadow-md"
                      } ${isTransitioning ? "pointer-events-none" : ""}`}
                    >
                      <CandidatePhoto
                        src={candidate.photo_url}
                        name={candidate.full_name}
                        className={`h-16 w-16 flex-none rounded-xl ring-1 transition ${selected ? "ring-2 ring-[#168AAD]" : "ring-slate-200"}`}
                        textClass="text-lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900">{candidate.full_name}</h3>
                          <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {candidate.class}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                          {candidate.manifesto || "No manifesto provided."}
                        </p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setDetail(candidate) }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setDetail(candidate) } }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#168AAD] hover:underline"
                        >
                          <Info className="h-3 w-3" /> {t("viewDetails")}
                        </span>
                      </div>

                      <div
                        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors ${
                          selected ? "border-[#168AAD] bg-[#168AAD]" : "border-slate-300 bg-white group-hover:border-[#168AAD]/50"
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Abstain — formally decline to choose for this position */}
              <button
                type="button"
                onClick={() => handleVote(ABSTAIN)}
                disabled={isTransitioning}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-semibold transition-all ${
                  votes[currentPosition.id] === ABSTAIN
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                {votes[currentPosition.id] === ABSTAIN && <Check className="h-4 w-4" />}
                Abstain / no preference for {currentPosition.name}
              </button>
            </div>

            {/* Nav */}
            <div className="flex flex-none items-center justify-between border-t border-slate-100 px-4 py-2.5">
              <Button
                onClick={() => setCurrentPositionIndex(Math.max(0, currentPositionIndex - 1))}
                disabled={currentPositionIndex === 0}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                {t("previous")}
              </Button>
              <Button
                onClick={() => {
                  if (votes[currentPosition.id]) {
                    const next = currentPositionIndex + 1
                    if (next < positions.length) setCurrentPositionIndex(next)
                    else setShowConfirmation(true)
                  } else {
                    toast.info(t("selectFirst"))
                  }
                }}
                disabled={!votes[currentPosition.id]}
                size="sm"
                className="bg-[#168AAD] font-semibold text-white hover:bg-[#1A759F] disabled:opacity-40"
              >
                {currentPositionIndex === positions.length - 1 ? t("review") : t("next")}
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Candidate detail (photo + full manifesto) */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                <CandidatePhoto src={detail.photo_url} name={detail.full_name} className="h-16 w-16 flex-none rounded-xl ring-1 ring-slate-200" textClass="text-lg" />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">{detail.full_name}</h3>
                  <p className="text-xs text-slate-500">{detail.class}</p>
                </div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Manifesto</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{detail.manifesto || "No manifesto provided."}</p>
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-4">
                <Button variant="outline" className="flex-1" onClick={() => setDetail(null)}>Close</Button>
                <Button
                  className="flex-1 bg-[#168AAD] font-semibold text-white hover:bg-[#1A759F]"
                  onClick={() => { const id = detail.id; setDetail(null); handleVote(id) }}
                >
                  Vote {detail.full_name.split(" ")[0]}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BallotShell>
  )
}
