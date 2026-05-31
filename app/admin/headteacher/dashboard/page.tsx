"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Users,
  Vote,
  Trophy,
  TrendingUp,
  RefreshCw,
  Eye,
  Crown,
  Star,
  Activity,
  LogOut,
  School,
  CheckCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

interface DashboardStats {
  totalVoters: number
  votedCount: number
  totalCandidates: number
  totalVotes: number
}

interface PostResult {
  postId: string
  postTitle: string
  category: string
  candidates: {
    id: string
    name: string
    votes: number
    percentage: number
    isLeading: boolean
  }[]
  totalVotes: number
}

export default function HeadteacherDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVoters: 0,
    votedCount: 0,
    totalCandidates: 0,
    totalVotes: 0,
  })
  const [postResults, setPostResults] = useState<PostResult[]>([])
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const isAuthenticated = sessionStorage.getItem("headteacher_auth")
    if (!isAuthenticated) {
      router.push("/admin/headteacher/login")
      return
    }

    loadData()

    // Set up real-time subscription
    const subscription = supabase
      .channel("votes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, () => {
        loadData()
      })
      .subscribe()

    const interval = setInterval(loadData, 30000) // Auto-refresh every 30 seconds

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [router])

  const loadData = async () => {
    try {
      await Promise.all([loadStats(), loadPostResults(), loadRecentActivity()])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { count: totalVoters } = await supabase.from("users").select("*", { count: "exact", head: true })
      const { count: votedCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("has_voted", true)
      const { count: totalCandidates } = await supabase.from("candidates").select("*", { count: "exact", head: true })
      const { count: totalVotes } = await supabase.from("votes").select("*", { count: "exact", head: true })

      setStats({
        totalVoters: totalVoters || 0,
        votedCount: votedCount || 0,
        totalCandidates: totalCandidates || 0,
        totalVotes: totalVotes || 0,
      })
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const loadPostResults = async () => {
    try {
      const { data: positions } = await supabase
        .from("positions")
        .select(`
          *,
          candidates (*),
          election_categories (name)
        `)
        .eq("is_active", true)

      const results =
        positions?.map((position) => {
          const candidates = position.candidates.map((candidate: any) => ({
            id: candidate.id,
            name: candidate.full_name,
            votes: candidate.vote_count,
            percentage:
              position.candidates.reduce((sum: number, c: any) => sum + c.vote_count, 0) > 0
                ? Math.round(
                    (candidate.vote_count /
                      position.candidates.reduce((sum: number, c: any) => sum + c.vote_count, 0)) *
                      100,
                  )
                : 0,
            isLeading: candidate.vote_count === Math.max(...position.candidates.map((c: any) => c.vote_count)),
          }))

          return {
            postId: position.id,
            postTitle: position.title,
            category: position.election_categories.name,
            candidates: candidates.sort((a: any, b: any) => b.votes - a.votes),
            totalVotes: position.candidates.reduce((sum: number, c: any) => sum + c.vote_count, 0),
          }
        }) || []

      setPostResults(results)
    } catch (error) {
      console.error("Error loading post results:", error)
    }
  }

  const loadRecentActivity = async () => {
    try {
      const { data: recentVotes } = await supabase
        .from("votes")
        .select(`
          *,
          users (student_id),
          candidates (full_name),
          positions (title)
        `)
        .order("created_at", { ascending: false })
        .limit(10)

      const activity =
        recentVotes?.map((vote) => ({
          id: vote.id,
          voter: `Student ${vote.users.student_id}`,
          action: `voted for ${vote.candidates.full_name} (${vote.positions.title})`,
          time: new Date(vote.created_at).toLocaleString(),
        })) || []

      setRecentActivity(activity)
    } catch (error) {
      console.error("Error loading recent activity:", error)
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
        return <Crown className="w-6 h-6" />
      case "Entertainment":
        return <Star className="w-6 h-6" />
      case "Games and Sports":
        return <Trophy className="w-6 h-6" />
      default:
        return <Vote className="w-6 h-6" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Senior Leadership":
        return "from-purple-500 via-indigo-500 to-blue-500"
      case "Entertainment":
        return "from-pink-500 via-rose-500 to-red-500"
      case "Games and Sports":
        return "from-green-500 via-emerald-500 to-teal-500"
      default:
        return "from-blue-500 via-purple-500 to-pink-500"
    }
  }

  const turnoutPercentage = stats.totalVoters > 0 ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0

  const StatCard = ({ title, value, icon: Icon, color, trend, delay = 0 }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className={`bg-gradient-to-br ${color} text-white border-0 shadow-lg`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">{title}</p>
              <motion.p
                className="text-3xl font-bold"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.2 }}
              >
                {value}
              </motion.p>
              {trend && (
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span>{trend}</span>
                </div>
              )}
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="opacity-20"
            >
              <Icon className="w-12 h-12" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading dashboard...</p>
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
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Lubiri Secondary School</h2>
              <p className="text-gray-600">Headteacher - Election Oversight Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={loadData} variant="outline" className="flex items-center space-x-2 bg-transparent">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Badge variant="outline" className="px-3 py-1">
              <Eye className="w-4 h-4 mr-1" />
              Live Updates
            </Badge>
            <Button onClick={handleLogout} variant="outline" className="text-red-600 hover:text-red-700 bg-transparent">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={stats.totalVoters.toLocaleString()}
            icon={Users}
            color="from-blue-500 to-blue-600"
            trend="Registered voters"
            delay={0}
          />
          <StatCard
            title="Participation Rate"
            value={`${turnoutPercentage}%`}
            icon={TrendingUp}
            color="from-green-500 to-green-600"
            trend={`${stats.votedCount} students participated`}
            delay={0.1}
          />
          <StatCard
            title="Student Leaders"
            value={stats.totalCandidates}
            icon={Trophy}
            color="from-purple-500 to-purple-600"
            trend="Aspiring candidates"
            delay={0.2}
          />
          <StatCard
            title="Total Votes"
            value={stats.totalVotes.toLocaleString()}
            icon={Vote}
            color="from-orange-500 to-orange-600"
            trend="Democratic participation"
            delay={0.3}
          />
        </div>

        {/* School Participation Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="w-5 h-5" />
                School Democratic Participation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Student Participation in School Leadership</span>
                  <Badge variant={turnoutPercentage > 50 ? "default" : "secondary"}>
                    {stats.votedCount} / {stats.totalVoters} students
                  </Badge>
                </div>
                <Progress value={turnoutPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground">
                  {turnoutPercentage}% of students have exercised their democratic right to choose school leaders
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student Leadership Results */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Student Leadership Election Results</span>
                  <Badge variant="outline" className="px-3 py-1">
                    <Eye className="w-4 h-4 mr-1" />
                    Live Results
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {postResults.map((post, index) => (
                    <motion.div
                      key={post.postId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div
                        className={`flex items-center gap-3 mb-4 p-3 rounded-lg bg-gradient-to-r ${getCategoryColor(post.category)} text-white`}
                      >
                        {getCategoryIcon(post.category)}
                        <div>
                          <h3 className="font-bold text-lg">{post.postTitle}</h3>
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                            {post.category}
                          </Badge>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold">{post.totalVotes}</div>
                          <div className="text-sm opacity-90">votes</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {post.candidates.map((candidate, candidateIndex) => (
                          <div
                            key={candidate.id}
                            className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                              candidate.isLeading
                                ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300"
                                : "bg-gray-50 border border-gray-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  candidate.isLeading
                                    ? "bg-yellow-500 text-white"
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
                                <div className="font-semibold text-gray-900">{candidate.name}</div>
                                <div className="text-sm text-gray-600">{candidate.votes} votes</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{candidate.percentage}%</div>
                              {candidate.isLeading && (
                                <div className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                  <Trophy className="w-3 h-3" />
                                  Leading
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-6"
          >
            {/* School Leadership Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Leadership Election Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="font-medium text-green-800">Election In Progress</span>
                  <Badge className="bg-green-500">Active</Badge>
                </div>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>• Students are actively participating</p>
                  <p>• Democratic process is transparent</p>
                  <p>• All systems functioning properly</p>
                  <p>• Results updating in real-time</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Student Participation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Student Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentActivity.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.voter}</p>
                        <p className="text-xs text-gray-600">{activity.action}</p>
                      </div>
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </motion.div>
                  ))}
                  {recentActivity.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
