"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import { Activity, TrendingUp, Users, Zap } from "lucide-react"

interface LiveResultData {
  position_name: string
  category: string
  candidate_count: number
  total_votes: number
}

export default function LiveResultsPage() {
  const [results, setResults] = useState<LiveResultData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [analytics, setAnalytics] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0, totalPositions: 0 })
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

  const fetchResults = async () => {
    try {
      const [positionsWithCandidates, votes, users] = await Promise.all([
        getPositionsWithCandidates(),
        voteDb.getAll(),
        userDb.getAll(),
      ])

      const resultsData: LiveResultData[] = positionsWithCandidates.map((position) => ({
        position_name: position.name,
        category: position.category,
        candidate_count: position.candidates.length,
        total_votes: votes.filter((v) => v.position_id === position.id).length,
      }))

      const votedCount = users.filter((u) => u.has_voted).length

      setResults(resultsData)
      setAnalytics({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
        totalPositions: resultsData.length,
      })
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || results.length === 0) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-2xl font-bold text-gray-800">Loading Election Coverage</p>
          <p className="text-gray-500 mt-2">Gathering live data...</p>
        </motion.div>
      </div>
    )
  }

  const currentPosition = results[currentIndex]
  const timeUntilNext = 8 - (Math.floor((Date.now() / 1000) % 8))

  return (
    <div className="fixed inset-0 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <motion.div initial={{ y: -100 }} animate={{ y: 0 }} className="bg-gradient-to-r from-white via-blue-50 to-white border-b-2 border-blue-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-black text-blue-900 tracking-tight">ELECTION COVERAGE</h1>
              <p className="text-lg text-blue-600 font-semibold mt-1">Lubiri Secondary School • Live Participation Update</p>
            </div>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              <span className="text-lg font-bold text-gray-800">LIVE</span>
            </motion.div>
          </div>

          {/* Analytics Bar */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            {[
              { label: "Votes Recorded", value: analytics.totalVotes.toLocaleString(), color: "blue" },
              { label: "Participation", value: `${analytics.turnout.toFixed(1)}%`, color: "green" },
              { label: "Students Voted", value: `${analytics.votedCount}/${analytics.totalVoters}`, color: "purple" },
              { label: "Positions", value: analytics.totalPositions, color: "orange" },
              { label: "Status", value: "In Progress", color: "pink" },
            ].map((item) => (
              <div key={item.label} className={`bg-white rounded-lg border-2 border-${item.color}-100 p-4`}>
                <p className={`text-${item.color}-600 text-xs font-bold uppercase`}>{item.label}</p>
                <p className="text-4xl font-black text-gray-900 mt-2">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-hidden flex items-center justify-center">
        <div className="max-w-6xl w-full">
          <AnimatePresence mode="wait">
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.8 }} className="space-y-8">
              <div className="text-center space-y-4">
                <motion.div className="inline-flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-full border-2 border-blue-200" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-bold text-blue-900">{currentPosition.category}</span>
                </motion.div>
                <h2 className="text-6xl font-black text-gray-900">{currentPosition.position_name}</h2>
                <p className="text-xl text-gray-600">{currentPosition.candidate_count} Candidates • {currentPosition.total_votes} Votes Cast</p>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-blue-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">Participation Level</span>
                      <span className="text-3xl font-black text-blue-600">
                        {((currentPosition.total_votes / (analytics.totalVotes || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-8 bg-white rounded-full overflow-hidden border-2 border-blue-300">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentPosition.total_votes / (analytics.totalVotes || 1)) * 100)}%` }}
                        transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      />
                    </div>
                    <p className="text-sm text-gray-600">{currentPosition.total_votes} of {analytics.totalVotes} total votes</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {[
                    { icon: <Users className="w-6 h-6 text-blue-600" />, label: "Candidates", value: currentPosition.candidate_count },
                    { icon: <TrendingUp className="w-6 h-6 text-green-600" />, label: "Votes This Position", value: currentPosition.total_votes },
                    { icon: <Activity className="w-6 h-6 text-purple-600" />, label: "Status", value: "In Progress" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">{item.icon}<span className="text-sm font-bold text-gray-600">{item.label}</span></div>
                      <p className="text-4xl font-black text-gray-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <div className="flex gap-2">
                  {results.map((_, index) => (
                    <motion.div key={index} className={`h-2 rounded-full transition-all ${index === currentIndex ? "w-12 bg-blue-600" : "w-2 bg-gray-300"}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm font-semibold">Next update in {timeUntilNext}s</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-white border-t-2 border-blue-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-green-600" />
            <p className="text-gray-800 font-semibold">Live election participation data • Updated every 5 seconds</p>
          </div>
          <p className="text-gray-600 text-sm">No results shown • Participation tracking only</p>
        </div>
      </div>
    </div>
  )
}
