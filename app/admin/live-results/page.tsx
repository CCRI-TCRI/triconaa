"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, animate, useMotionValue } from "framer-motion"
import { getPositionsWithCandidates, voteDb, userDb, electionControl } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Users, TrendingUp, BarChart3, Vote, Activity } from "lucide-react"

interface PositionStat {
  id: string
  name: string
  category: string
  candidateCount: number
  totalVotes: number
}

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState("0")
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()),
    })
    return controls.stop
  }, [value, decimals, mv])
  return <span className="tabular-nums">{display}{suffix}</span>
}

export default function LiveResultsPage() {
  const router = useRouter()
  const { schoolName, logoUrl } = useSchoolBranding()
  const [stats, setStats] = useState<PositionStat[]>([])
  const [analytics, setAnalytics] = useState({ totalVotes: 0, turnout: 0, totalVoters: 0, votedCount: 0 })
  const [clock, setClock] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = async () => {
    try {
      // When the election is completed, jump straight to the reveal show
      const { status } = await electionControl.get()
      if (status === "completed") {
        router.push("/admin/reveal")
        return
      }

      const [positions, votes, users] = await Promise.all([getPositionsWithCandidates(), voteDb.getAll(), userDb.getAll()])
      const positionStats: PositionStat[] = positions.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        candidateCount: p.candidates.length,
        totalVotes: votes.filter((v) => v.position_id === p.id).length,
      }))
      const votedCount = users.filter((u) => u.has_voted).length
      setStats(positionStats)
      setAnalytics({
        totalVotes: votes.length,
        turnout: users.length > 0 ? (votedCount / users.length) * 100 : 0,
        totalVoters: users.length,
        votedCount,
      })
    } catch (error) {
      console.error("Error fetching participation:", error)
    } finally {
      setLoading(false)
    }
  }

  const maxVotes = Math.max(1, ...stats.map((s) => s.totalVotes))

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white to-blue-50">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-2xl font-bold tracking-tight text-blue-900">{schoolName}</p>
          <p className="mt-2 text-slate-500">Loading participation…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-white via-blue-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-blue-100 bg-white px-8 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-blue-100">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-blue-900 sm:text-xl">{schoolName}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Live Participation</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-sm text-slate-500 sm:inline">{clock}</span>
          <div className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 shadow-md shadow-blue-600/20">
            <motion.span animate={{ opacity: [1, 0.2, 1], scale: [1, 0.8, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="text-sm font-black uppercase tracking-widest text-white">Live</span>
          </div>
        </div>
      </header>
      <div className="h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 px-8 py-4 sm:grid-cols-4">
        {[
          { label: "Total Votes", value: <AnimatedNumber value={analytics.totalVotes} />, icon: Vote },
          { label: "Turnout", value: <AnimatedNumber value={analytics.turnout} decimals={1} suffix="%" />, icon: TrendingUp },
          { label: "Students Voted", value: <><AnimatedNumber value={analytics.votedCount} />/{analytics.totalVoters}</>, icon: Users },
          { label: "Positions", value: <>{stats.length}</>, icon: BarChart3 },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-5 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
              <p className="text-2xl font-bold text-blue-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Position statistics */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Votes Cast by Position</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">{s.category}</p>
                  <h3 className="truncate text-lg font-bold text-blue-950">{s.name}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black text-blue-700">
                    <AnimatedNumber value={s.totalVotes} />
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">votes</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.totalVotes / maxVotes) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">{s.candidateCount} candidate{s.candidateCount === 1 ? "" : "s"}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-blue-100 bg-white px-8 py-2.5">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-4 w-4 text-blue-600" />
          Live participation · updates every 5 seconds
        </p>
        <p className="text-xs font-medium text-slate-400">Winners are revealed at assembly — no results shown here</p>
      </div>
    </div>
  )
}
