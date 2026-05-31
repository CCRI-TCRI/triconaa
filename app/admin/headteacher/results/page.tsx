"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Trophy,
  Crown,
  Star,
  TrendingUp,
  RefreshCw,
  Eye,
  LogOut,
  GraduationCap,
  School,
  Users,
  Award,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

interface StudentLeadershipResult {
  positionId: string
  positionTitle: string
  category: string
  candidates: {
    id: string
    name: string
    votes: number
    percentage: number
    isElected: boolean
    isLeading: boolean
  }[]
  totalVotes: number
  status: "active" | "completed"
}

export default function HeadteacherResultsPage() {
  const [results, setResults] = useState<StudentLeadershipResult[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolStats, setSchoolStats] = useState({
    totalStudents: 0,
    participatingStudents: 0,
    leadershipPositions: 0,
    democraticParticipation: 0,
  })
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const isAuthenticated = sessionStorage.getItem("headteacher_auth")
    if (!isAuthenticated) {
      router.push("/admin/headteacher/login")
      return
    }

    loadResults()

    // Set up real-time subscription
    const subscription = supabase
      .channel("student_leadership_results")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        loadResults()
      })
      .subscribe()

    const interval = setInterval(loadResults, 30000) // Auto-refresh every 30 seconds

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [router])

  const loadResults = async () => {
    try {
      // Load school statistics
      const { count: totalStudents } = await supabase.from("users").select("*", { count: "exact", head: true })
      const { count: participatingStudents } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("has_voted", true)
      const { count: leadershipPositions } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      setSchoolStats({
        totalStudents: totalStudents || 0,
        participatingStudents: participatingStudents || 0,
        leadershipPositions: leadershipPositions || 0,
        democraticParticipation: totalStudents ? Math.round(((participatingStudents || 0) / totalStudents) * 100) : 0,
      })

      // Load student leadership results
      const { data: positions } = await supabase
        .from("positions")
        .select(`
          *,
          candidates (*),
          election_categories (name)
        `)
        .eq("is_active", true)

      const leadershipResults: StudentLeadershipResult[] =
        positions?.map((position) => {
          const totalPositionVotes = position.candidates.reduce((sum: number, c: any) => sum + c.vote_count, 0)
          const maxVotes = Math.max(...position.candidates.map((c: any) => c.vote_count))

          const candidates = position.candidates
            .map((candidate: any) => ({
              id: candidate.id,
              name: candidate.full_name,
              votes: candidate.vote_count,
              percentage: totalPositionVotes > 0 ? Math.round((candidate.vote_count / totalPositionVotes) * 100) : 0,
              isElected: candidate.vote_count === maxVotes && totalPositionVotes > 0,
              isLeading: candidate.vote_count === maxVotes,
            }))
            .sort((a: any, b: any) => b.votes - a.votes)

          return {
            positionId: position.id,
            positionTitle: position.title,
            category: position.election_categories?.name || "Student Leadership",
            candidates,
            totalVotes: totalPositionVotes,
            status: "active" as const,
          }
        }) || []

      setResults(leadershipResults)
    } catch (error) {
      console.error("Error loading results:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("headteacher_auth")
    sessionStorage.removeItem("user_role")
    router.push("/admin/headteacher/login")
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Senior Leadership":
        return <Crown className="w-5 h-5" />
      case "Entertainment":
        return <Star className="w-5 h-5" />
      case "Games and Sports":
        return <Trophy className="w-5 h-5" />
      default:
        return <Award className="w-5 h-5" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Senior Leadership":
        return "from-purple-500 to-indigo-600"
      case "Entertainment":
        return "from-pink-500 to-rose-600"
      case "Games and Sports":
        return "from-green-500 to-emerald-600"
      default:
        return "from-blue-500 to-cyan-600"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading student leadership results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-white p-6 rounded-lg shadow-sm"
        >
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <img src="/logo.png" alt="Lubiri Secondary School" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Student Leadership Results</h2>
              <p className="text-gray-600">Lubiri Secondary School - Democratic Election Outcomes</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={loadResults} variant="outline" className="flex items-center space-x-2 bg-transparent">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Badge variant="outline" className="px-3 py-1">
              <Eye className="w-4 h-4 mr-1" />
              Live Results
            </Badge>
            <Button onClick={handleLogout} variant="outline" className="text-red-600 hover:text-red-700 bg-transparent">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </motion.div>

        {/* School Statistics */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="w-5 h-5" />
                School Democratic Participation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{schoolStats.totalStudents}</div>
                  <div className="text-sm text-muted-foreground">Total Students</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{schoolStats.participatingStudents}</div>
                  <div className="text-sm text-muted-foreground">Participated in Election</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{schoolStats.leadershipPositions}</div>
                  <div className="text-sm text-muted-foreground">Leadership Positions</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{schoolStats.democraticParticipation}%</div>
                  <div className="text-sm text-muted-foreground">Democratic Participation</div>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Student Engagement in School Leadership</span>
                  <span className="text-sm text-muted-foreground">{schoolStats.democraticParticipation}%</span>
                </div>
                <Progress value={schoolStats.democraticParticipation} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  {schoolStats.democraticParticipation}% of students have actively participated in choosing their school
                  leaders
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Student Leadership Results */}
        <div className="space-y-6">
          {results.map((result, index) => (
            <motion.div
              key={result.positionId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <Card className="overflow-hidden">
                <CardHeader className={`bg-gradient-to-r ${getCategoryColor(result.category)} text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(result.category)}
                      <div>
                        <CardTitle className="text-xl">{result.positionTitle}</CardTitle>
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mt-1">
                          {result.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{result.totalVotes}</div>
                      <div className="text-sm opacity-90">student votes</div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    {result.candidates.map((candidate, candidateIndex) => (
                      <div
                        key={candidate.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          candidate.isElected
                            ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md"
                            : candidate.isLeading
                              ? "bg-blue-50 border-blue-300"
                              : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              candidate.isElected
                                ? "bg-green-500 text-white"
                                : candidateIndex === 0
                                  ? "bg-blue-500 text-white"
                                  : candidateIndex === 1
                                    ? "bg-gray-400 text-white"
                                    : "bg-gray-300 text-gray-700"
                            }`}
                          >
                            {candidateIndex + 1}
                          </div>
                          <div>
                            <div className="font-bold text-lg text-gray-900">{candidate.name}</div>
                            <div className="text-sm text-gray-600">{candidate.votes} student votes</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{candidate.percentage}%</div>
                          {candidate.isElected && (
                            <div className="text-sm text-green-600 font-bold flex items-center gap-1">
                              <Award className="w-4 h-4" />
                              Elected Leader
                            </div>
                          )}
                          {candidate.isLeading && !candidate.isElected && (
                            <div className="text-sm text-blue-600 font-medium flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              Leading
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.totalVotes === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No student votes cast for this leadership position yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Student Leadership Results Available</h3>
            <p className="text-gray-500">Student leadership election results will appear here once voting begins.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
