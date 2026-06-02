"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { motion } from "framer-motion"
import Link from "next/link"
import { Power, PauseCircle, StopCircle, RefreshCw, Vote, Users, Flag, Trophy, AlertTriangle, Sparkles } from "lucide-react"
import { userDb, voteDb, electionControl, type ElectionStatus } from "@/lib/db"
import { BRANDING_UPDATED_EVENT } from "@/components/school-branding-provider"

const STATUS_META: Record<ElectionStatus, { label: string; color: string; desc: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700", desc: "Voting is open. Students can log in and cast their ballots." },
  paused: { label: "Paused", color: "bg-amber-100 text-amber-700", desc: "Voting is temporarily paused. The login screen is hidden." },
  stopped: { label: "Stopped", color: "bg-red-100 text-red-700", desc: "Voting is closed. The login screen shows the upcoming-election notice." },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700", desc: "Results are final. Live Results now jumps to the Reveal Show." },
}

export default function ControlSystemPage() {
  const [status, setStatus] = useState<ElectionStatus>("active")
  const [term, setTerm] = useState("2027 democratic term")
  const [stats, setStats] = useState({ totalVoters: 0, votedCount: 0, totalVotes: 0 })
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    refresh()
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const refresh = async () => {
    const { status, term } = await electionControl.get()
    setStatus(status)
    setTerm(term)
    loadStats()
  }

  const loadStats = async () => {
    try {
      const [users, votes] = await Promise.all([userDb.getAll(), voteDb.getAll()])
      setStats({ totalVoters: users.length, votedCount: users.filter((u) => u.has_voted).length, totalVotes: votes.length })
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Stats load failed:", error)
    }
  }

  const changeStatus = async (next: ElectionStatus) => {
    setLoading(true)
    try {
      await electionControl.setStatus(next)
      setStatus(next)
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
    } catch (error) {
      console.error("Failed to change status:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      await voteDb.deleteAll()
      await userDb.resetAllVotes()
      await electionControl.setStatus("active")
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
      window.location.reload()
    } catch (error) {
      console.error("Failed to reset:", error)
    } finally {
      setLoading(false)
    }
  }

  const turnout = stats.totalVoters > 0 ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0
  const meta = STATUS_META[status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0f1f] via-[#7a1f2b] to-[#3b0a14] p-6 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Election Control</h1>
            <p className="text-sm text-rose-100/80">Start, pause, stop or complete the {term}</p>
          </div>
          <Badge className={`${meta.color} px-4 py-2 text-sm font-bold`}>
            <span className="capitalize">Status: {meta.label}</span>
          </Badge>
        </div>
      </div>

      <Alert>
        <Flag className="h-4 w-4" />
        <AlertDescription>{meta.desc}</AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Voters</CardTitle>
            <Users className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalVoters}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Votes Cast</CardTitle>
            <Vote className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalVotes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnout</CardTitle>
            <Trophy className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{turnout}%</div></CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5" />Voting Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button onClick={() => changeStatus("active")} disabled={loading || status === "active" || status === "completed"} className="bg-green-600 hover:bg-green-700">
                  <Power className="mr-2 h-4 w-4" />Start
                </Button>
                <Button onClick={() => changeStatus("paused")} disabled={loading || status !== "active"} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  <PauseCircle className="mr-2 h-4 w-4" />Pause
                </Button>
                <Button onClick={() => changeStatus("stopped")} disabled={loading || status === "stopped" || status === "completed"} variant="destructive">
                  <StopCircle className="mr-2 h-4 w-4" />Stop
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                While paused or stopped, voters see a branded “elections coming” screen instead of the login page.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900"><Flag className="h-5 w-5" />Finish the Election</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === "completed" ? (
                <>
                  <Alert className="border-blue-200 bg-blue-50">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Election complete. The Live Results screen now redirects to the Reveal Show automatically.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Link href="/admin/reveal" className="flex-1">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700"><Sparkles className="mr-2 h-4 w-4" />Open Reveal Show</Button>
                    </Link>
                    <Button onClick={() => changeStatus("active")} variant="outline" disabled={loading}>Reopen Voting</Button>
                  </div>
                </>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                      <Flag className="mr-2 h-4 w-4" />Complete Election
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Complete the election?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This locks the results. The voter screen will show the winners, and the Live Results screen will
                        automatically switch to the Reveal Show. You can reopen voting afterwards if needed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => changeStatus("completed")} className="bg-blue-600 hover:bg-blue-700">
                        Complete &amp; Reveal
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <p className="text-xs text-muted-foreground">Last updated {lastUpdate.toLocaleTimeString()}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Reset clears all cast votes, reopens voting, and marks every voter as not-voted.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Reset Election</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the entire election?</AlertDialogTitle>
                <AlertDialogDescription>This deletes all votes and cannot be undone. Voters and candidates are kept.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-red-600 hover:bg-red-700">Reset Everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
