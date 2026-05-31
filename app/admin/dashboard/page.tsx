"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Users, Vote, Trophy, BarChart3, TrendingUp, RefreshCw, Eye, Crown, Star,
  Activity, Settings, UserPlus, Tv, CheckCircle2, AlertCircle, Clock,
} from "lucide-react"
import { userDb, candidateDb, voteDb, positionDb } from "@/lib/db"

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
  candidates: { id: string; name: string; votes: number; percentage: number; isLeading: boolean }[]
  totalVotes: number
}

const StatCard = ({ title, value, icon: Icon, color, trend, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{ y: -5 }}
    className="group"
  >
    <Card className={`relative overflow-hidden border-0 shadow-xl bg-gradient-to-br ${color} text-white h-full`}>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium mb-2">{title}</p>
            <motion.p
              className="text-4xl font-black"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.2, type: "spring", stiffness: 100 }}
            >
              {value}
            </motion.p>
            {trend && (
              <motion.div
                className="flex items-center mt-3 text-sm font-semibold gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.4 }}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{trend}</span>
              </motion.div>
            )}
          </div>
          <Icon className="w-16 h-16 opacity-20" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
)

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ totalVoters: 0, votedCount: 0, totalCandidates: 0, totalVotes: 0 })
  const [postResults, setPostResults] = useState<PostResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setRefreshing(true)
    try {
      // Single consolidated fetch — every figure is derived from the votes table
      const [users, candidates, positions, votes] = await Promise.all([
        userDb.getAll(),
        candidateDb.getAll(),
        positionDb.getAll(),
        voteDb.getAll(),
      ])

      // Accurate top-line stats
      setStats({
        totalVoters: users.length,
        votedCount: users.filter((u) => u.has_voted).length,
        totalCandidates: candidates.length,
        totalVotes: votes.length,
      })

      // Per-position results counted directly from the votes table
      const results: PostResult[] = positions
        .map((position) => {
          const positionCandidates = candidates.filter((c) => c.position_id === position.id)
          const positionVotes = votes.filter((v) => v.position_id === position.id)
          const maxVotes = Math.max(0, ...positionCandidates.map((c) => positionVotes.filter((v) => v.candidate_id === c.id).length))
          const candidateResults = positionCandidates
            .map((candidate) => {
              const count = positionVotes.filter((v) => v.candidate_id === candidate.id).length
              return {
                id: candidate.id,
                name: candidate.full_name,
                votes: count,
                percentage: positionVotes.length > 0 ? Math.round((count / positionVotes.length) * 100) : 0,
                isLeading: count > 0 && count === maxVotes,
              }
            })
            .sort((a, b) => b.votes - a.votes)
          return {
            postId: position.id,
            postTitle: position.name,
            category: position.category,
            candidates: candidateResults,
            totalVotes: positionVotes.length,
          }
        })
        .filter((p) => p.candidates.length > 0)
      setPostResults(results)

      // Recent activity from the most recent votes (voteDb.getAll is ordered desc)
      const candidateMap = new Map(candidates.map((c) => [c.id, c.full_name]))
      const positionMap = new Map(positions.map((p) => [p.id, p.name]))
      const userMap = new Map(users.map((u) => [u.id, u.full_name]))
      setRecentActivity(
        votes.slice(0, 10).map((vote) => ({
          id: vote.id,
          voter: userMap.get(vote.user_id) || "Unknown voter",
          action: `voted for ${candidateMap.get(vote.candidate_id) || "Unknown"} · ${positionMap.get(vote.position_id) || "Unknown"}`,
          time: new Date(vote.created_at).toLocaleString(),
        })),
      )

      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    if (category.includes("Senior") || category.includes("Head")) return <Crown className="w-6 h-6" />
    if (category.includes("Entertainment")) return <Star className="w-6 h-6" />
    if (category.includes("Sport") || category.includes("Game")) return <Trophy className="w-6 h-6" />
    return <Vote className="w-6 h-6" />
  }

  const getCategoryColor = (category: string) => {
    if (category.includes("Senior") || category.includes("Head")) return "from-rose-700 via-rose-800 to-rose-900"
    if (category.includes("Entertainment")) return "from-pink-600 via-rose-600 to-red-600"
    if (category.includes("Sport") || category.includes("Game")) return "from-amber-600 via-orange-600 to-rose-700"
    return "from-rose-600 via-rose-700 to-rose-800"
  }

  const turnoutPercentage = stats.totalVoters > 0 ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-rose-200 border-t-rose-700 rounded-full mx-auto mb-4"
          />
          <p className="text-lg font-semibold text-rose-900">Loading dashboard…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Maroon hero header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0f1f] via-[#7a1f2b] to-[#3b0a14] p-6 sm:p-8 text-white shadow-2xl"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-rose-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-amber-300/40">
              <img src="/logo.png" alt="St. Theresa S.S." className="h-11 w-11 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Election Dashboard</h1>
              <p className="text-sm text-rose-100/80">St. Theresa S.S. Buloba-Kasero · real-time election data</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={loadData}
              variant="outline"
              disabled={refreshing}
              className="gap-2 border-white/30 bg-white/10 font-semibold text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/admin/live-results" target="_blank">
              <Button className="gap-2 bg-amber-400 font-semibold text-rose-950 shadow-lg hover:bg-amber-300">
                <Tv className="h-4 w-4" />
                Live Results
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-2 text-xs text-rose-100/70">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          </span>
          Live · auto-refreshes every 15s
          {lastUpdated && <span>· last updated {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Registered Voters" value={stats.totalVoters.toLocaleString()} icon={Users} color="from-rose-600 to-rose-800" trend="Eligible students" delay={0} />
        <StatCard title="Voter Turnout" value={`${turnoutPercentage}%`} icon={TrendingUp} color="from-emerald-600 to-teal-700" trend={`${stats.votedCount}/${stats.totalVoters} voted`} delay={0.1} />
        <StatCard title="Candidates" value={stats.totalCandidates} icon={Trophy} color="from-amber-500 to-orange-700" trend="Running for office" delay={0.2} />
        <StatCard title="Total Votes" value={stats.totalVotes.toLocaleString()} icon={Vote} color="from-fuchsia-600 to-rose-800" trend="Ballots cast" delay={0.3} />
      </div>

      {/* Turnout Progress */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-amber-50">
          <CardTitle className="flex items-center gap-3 text-xl text-rose-900">
            <BarChart3 className="h-6 w-6 text-rose-700" />Voter Participation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Turnout Progress</span>
            <Badge variant="secondary" className="bg-rose-100 text-base font-bold text-rose-800">
              {stats.votedCount} / {stats.totalVoters}
            </Badge>
          </div>
          <Progress value={turnoutPercentage} className="h-4" />
          <p className="mt-3 text-center text-sm font-medium text-gray-600">
            {turnoutPercentage}% of registered students have participated
          </p>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Election Results */}
        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-amber-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-rose-900">
                  <CheckCircle2 className="h-6 w-6 text-rose-700" />Live Election Results
                </CardTitle>
                <Badge className="border-rose-200 bg-rose-100 font-semibold text-rose-700">
                  <Eye className="mr-1 h-3 w-3" />Real-time
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {postResults.length > 0 ? (
                  postResults.map((post) => (
                    <div key={post.postId} className="overflow-hidden rounded-xl border border-gray-200 transition-shadow hover:shadow-lg">
                      <div className={`flex items-center gap-3 bg-gradient-to-r p-4 text-white ${getCategoryColor(post.category)}`}>
                        {getCategoryIcon(post.category)}
                        <div className="flex-1">
                          <h3 className="text-lg font-bold">{post.postTitle}</h3>
                          <Badge className="mt-1 border-white/30 bg-white/20 text-white">{post.category}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black">{post.totalVotes}</div>
                          <div className="text-sm opacity-90">votes</div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        {post.candidates.map((candidate, ci) => (
                          <div key={candidate.id} className={`rounded-lg p-4 transition-all ${candidate.isLeading ? "border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-rose-50" : "border border-gray-200 bg-gray-50"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-1 items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${candidate.isLeading ? "bg-gradient-to-r from-amber-400 to-orange-500" : ci === 0 ? "bg-rose-600" : "bg-gray-400"}`}>
                                  #{ci + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">{candidate.name}</div>
                                  <div className="text-sm text-gray-600">{candidate.votes} votes</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-black text-gray-900">{candidate.percentage}%</div>
                                {candidate.isLeading && (
                                  <div className="mt-1 flex items-center justify-end gap-1">
                                    <Trophy className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-600">Leading</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* per-candidate bar */}
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${candidate.percentage}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={`h-full rounded-full ${candidate.isLeading ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-rose-400"}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                    <p className="font-medium text-gray-500">No results yet. Waiting for votes…</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-amber-50">
              <CardTitle className="flex items-center gap-3 text-rose-900"><Activity className="h-5 w-5 text-rose-700" />Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {[
                { href: "/admin/voters", label: "Manage Voters", icon: Users },
                { href: "/admin/candidates", label: "Manage Candidates", icon: UserPlus },
                { href: "/admin/results", label: "View Results", icon: BarChart3 },
                { href: "/admin/settings", label: "Settings", icon: Settings },
              ].map((action) => (
                <Button key={action.href} asChild variant="outline" className="w-full justify-start gap-3 border-rose-200 bg-rose-50 font-semibold text-rose-800 hover:bg-rose-100">
                  <a href={action.href}><action.icon className="h-4 w-4" />{action.label}</a>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-amber-50">
              <CardTitle className="flex items-center gap-3 text-rose-900"><Clock className="h-5 w-5 text-rose-700" />Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-lg border border-rose-100 bg-rose-50 p-3">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.voter}</p>
                        <p className="truncate text-xs text-gray-600">{activity.action}</p>
                        <p className="mt-1 text-xs text-gray-400">{activity.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-gray-500">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
