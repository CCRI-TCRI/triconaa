"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, User, Trophy, Users, Briefcase, Clock, AlertTriangle, Loader2, Lock, ChevronRight, ChevronLeft } from "lucide-react"
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

  const getCategoryIcon = (categoryName: string) => {
    const cat = categoryName.toLowerCase()
    if (cat.includes("senior") || cat.includes("head")) return <Trophy className="w-6 h-6" />
    if (cat.includes("sport") || cat.includes("game")) return <Users className="w-6 h-6" />
    if (cat.includes("house")) return <Briefcase className="w-6 h-6" />
    return <User className="w-6 h-6" />
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-white">
          <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold mb-2">Loading Election Data</h2>
          <p className="text-blue-200">Please wait while we fetch the candidates...</p>
        </motion.div>
      </div>
    )
  }

  if (!currentPosition || positions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-white max-w-md">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h2 className="text-2xl font-bold mb-2">No Candidates Available</h2>
          <p className="text-blue-200 mb-4">
            There are currently no candidates available for voting. Please contact the election committee.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-white/20 hover:bg-white/30 text-white border border-white/30">
            Refresh Page
          </Button>
        </motion.div>
      </div>
    )
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
          <Card className="backdrop-blur-lg bg-white/10 border-white/20 text-white">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Confirm Your Votes</CardTitle>
              <p className="text-blue-200">Please review your selections before submitting</p>
              <div className="flex items-center justify-center space-x-2 text-green-400">
                <Clock className="w-4 h-4" />
                <span>Time remaining: {formatTime(timeLeft)}</span>
              </div>
              <p className="text-sm text-yellow-300">⚠️ Once submitted, your voting token cannot be used again</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {positions.map((position) => {
                const selectedCandidateId = votes[position.id]
                const selectedCandidate = position.candidates.find((c) => c.id === selectedCandidateId)
                return (
                  <div key={position.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      {getCategoryIcon(position.category)}
                      <p className="font-medium">{position.name}</p>
                    </div>
                    {selectedCandidate ? (
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-green-400 font-medium">{selectedCandidate.full_name}</p>
                          <p className="text-sm text-gray-300">{selectedCandidate.class}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-yellow-400">⚠ No selection made</p>
                    )}
                  </div>
                )
              })}

              <Button
                onClick={submitVotes}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting Votes...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Submit Votes</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Timer and Progress */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className={`flex items-center justify-center mb-4 p-3 rounded-lg ${timeLeft <= 60 ? "bg-red-500/20 border border-red-500/30" : "bg-white/10"}`}>
            <Clock className={`w-5 h-5 mr-2 ${timeLeft <= 60 ? "text-red-400" : "text-white"}`} />
            <span className={`font-bold text-lg ${timeLeft <= 60 ? "text-red-400" : "text-white"}`}>
              Time Remaining: {formatTime(timeLeft)}
            </span>
            {timeLeft <= 60 && (
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }} className="ml-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </motion.div>
            )}
          </div>
          <div className="bg-white/10 rounded-full h-2 mb-4">
            <motion.div
              className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentPositionIndex + 1) / positions.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Positions List Sidebar */}
          <div className="lg:col-span-1">
            <Card className="backdrop-blur-lg bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-xl">Positions</CardTitle>
                <p className="text-sm text-blue-200">Select a position to vote</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {positions.map((position, index) => {
                  const isLocked = isPositionLocked(index)
                  const isActive = index === currentPositionIndex
                  const hasVote = !!votes[position.id]
                  return (
                    <motion.div key={position.id} whileHover={!isLocked ? { scale: 1.02 } : {}} whileTap={!isLocked ? { scale: 0.98 } : {}}>
                      <div
                        onClick={() => handlePositionClick(index)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                          isActive ? "border-blue-400 bg-blue-500/20 shadow-lg"
                            : hasVote ? "border-green-400 bg-green-500/10"
                            : isLocked ? "border-gray-600 bg-gray-500/10 opacity-50 cursor-not-allowed"
                            : "border-white/20 bg-white/5 hover:border-blue-400 hover:bg-blue-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-blue-500" : hasVote ? "bg-green-500" : isLocked ? "bg-gray-600" : "bg-white/20"}`}>
                              {hasVote ? <CheckCircle className="w-5 h-5 text-white" />
                                : isLocked ? <Lock className="w-4 h-4 text-white" />
                                : <span className="text-sm font-bold">{index + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isActive ? "text-blue-300" : ""}`}>{position.name}</p>
                              <p className="text-xs text-gray-400 truncate">{position.category}</p>
                            </div>
                          </div>
                          {isActive && <ChevronRight className="w-5 h-5 text-blue-400" />}
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
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="backdrop-blur-lg bg-white/10 border-white/20 text-white">
                  <CardHeader className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      {getCategoryIcon(currentPosition.category)}
                      <span className="font-semibold text-blue-200">{currentPosition.category}</span>
                    </div>
                    <CardTitle className="text-3xl font-bold">{currentPosition.name}</CardTitle>
                    <p className="text-blue-200 mt-2">{currentPosition.description}</p>
                    <Badge variant="secondary" className="mt-3 bg-white/20 text-white">
                      Position {currentPositionIndex + 1} of {positions.length}
                    </Badge>
                    <p className="text-sm text-yellow-300 mt-2">Click on a candidate to select and continue</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {currentPosition.candidates.map((candidate, index) => (
                        <motion.div
                          key={candidate.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                            votes[currentPosition.id] === candidate.id
                              ? "border-green-400 bg-green-500/20 scale-105"
                              : "border-white/20 bg-white/5 hover:border-blue-400 hover:bg-blue-500/10"
                          } ${isTransitioning ? "pointer-events-none" : ""}`}
                          onClick={() => handleVote(candidate.id)}
                          whileHover={{ scale: isTransitioning ? 1 : 1.02 }}
                          whileTap={{ scale: isTransitioning ? 1 : 0.98 }}
                        >
                          {votes[currentPosition.id] === candidate.id && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="absolute top-2 right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                            >
                              <CheckCircle className="w-5 h-5 text-white" />
                            </motion.div>
                          )}
                          <div className="flex items-center space-x-4 mb-4">
                            <Avatar className="w-16 h-16">
                              <AvatarImage src={candidate.photo_url || "/placeholder.svg"} />
                              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                {candidate.full_name.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-lg">{candidate.full_name}</h3>
                              <p className="text-blue-200">{candidate.class}</p>
                              <p className="text-sm text-gray-300">ID: {candidate.student_id}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-200 line-clamp-3">
                            {candidate.manifesto || "No manifesto provided."}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex justify-between mt-6">
                      <Button
                        onClick={() => setCurrentPositionIndex(Math.max(0, currentPositionIndex - 1))}
                        disabled={currentPositionIndex === 0}
                        variant="outline"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />Previous
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
                        disabled={!votes[currentPosition.id] || currentPositionIndex === positions.length - 1}
                        variant="outline"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Next<ChevronRight className="w-4 h-4 ml-2" />
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
