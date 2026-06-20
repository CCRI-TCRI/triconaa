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
import { Power, PauseCircle, StopCircle, RefreshCw, Vote, Users, Flag, Trophy, AlertTriangle, Sparkles, ShieldAlert, Lock, Megaphone, Volume2, Timer, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { userDb, voteDb, electionControl, broadcastDb, type ElectionStatus } from "@/lib/db"
import { BRANDING_UPDATED_EVENT } from "@/components/school-branding-provider"
import { getAdminRole, getAdminName } from "@/components/admin-guard"
import { toast } from "sonner"

// Convert an ISO timestamp to a value for <input type="datetime-local"> (local time).
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
function fromLocalInput(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

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
  const [lockdown, setLockdown] = useState(false)
  const [code5Interval, setCode5Interval] = useState(0)
  const [code5Input, setCode5Input] = useState("0")
  const [includeUnopposed, setIncludeUnopposed] = useState(false)
  const [openAt, setOpenAt] = useState("")
  const [closeAt, setCloseAt] = useState("")
  const [cert, setCert] = useState<{ certified: boolean; chair: string | null; head: string | null; at: string | null }>({ certified: false, chair: null, head: null, at: null })
  const [myRole, setMyRole] = useState<string>("admin")

  useEffect(() => {
    refresh()
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  // Recurring Code 5 announcements while this console is open
  useEffect(() => {
    if (code5Interval <= 0) return
    const id = setInterval(() => broadcastDb.trigger("5"), code5Interval * 60_000)
    return () => clearInterval(id)
  }, [code5Interval])

  const refresh = async () => {
    const [ctl, b] = await Promise.all([electionControl.get(), broadcastDb.get()])
    setStatus(ctl.rawStatus)
    setTerm(ctl.term)
    setIncludeUnopposed(ctl.includeUnopposed)
    setOpenAt(toLocalInput(ctl.openAt))
    setCloseAt(toLocalInput(ctl.closeAt))
    setCert(ctl.certification)
    setMyRole(getAdminRole() || "admin")
    setLockdown(b.lockdown)
    setCode5Interval(b.code5Interval)
    setCode5Input(String(b.code5Interval))
    loadStats()
  }

  const saveSchedule = async () => {
    const ok = await electionControl.setSchedule(fromLocalInput(openAt), fromLocalInput(closeAt))
    if (ok) toast.success("Schedule saved")
    else toast.error("Could not save schedule")
  }
  const clearSchedule = async () => {
    setOpenAt(""); setCloseAt("")
    await electionControl.setSchedule(null, null)
    toast.success("Schedule cleared")
  }
  const sign = async (slot: "chair" | "head") => {
    const name = getAdminName() || (slot === "chair" ? "Chairperson" : "Head Teacher")
    const ok = await electionControl.certify(slot, name)
    if (ok) { toast.success("Signed"); refresh() } else toast.error("Could not sign")
  }
  const resetCert = async () => { await electionControl.resetCertification(); refresh() }

  const toggleIncludeUnopposed = async (on: boolean) => {
    setIncludeUnopposed(on)
    const ok = await electionControl.setIncludeUnopposed(on)
    if (!ok) setIncludeUnopposed(!on) // revert on failure
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
      // Play the matching voice code
      if (next === "active") await broadcastDb.trigger("3")
      else if (next === "stopped" || next === "completed") await broadcastDb.trigger("9")
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
    } catch (error) {
      console.error("Failed to change status:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleLockdown = async (on: boolean) => {
    setLoading(true)
    try {
      await broadcastDb.setLockdown(on)
      setLockdown(on)
    } catch (error) {
      console.error("Failed to toggle lockdown:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveCode5Interval = async () => {
    const mins = Math.max(0, parseInt(code5Input) || 0)
    await broadcastDb.setCode5Interval(mins)
    setCode5Interval(mins)
  }

  const testCode5 = () => broadcastDb.trigger("5")

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
      <div className="relative overflow-hidden rounded-2xl bg-[#168AAD] p-6 text-white shadow-xl">
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

      {/* Ballot options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Vote className="h-5 w-5" />Ballot Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <p className="font-medium">Include unopposed positions on the ballot</p>
              <p className="text-sm text-muted-foreground">
                {includeUnopposed
                  ? "On — positions with a single candidate appear on the ballot and students vote on them."
                  : "Off — positions with a single candidate are kept off the ballot; the candidate is shown as elected unopposed."}
              </p>
            </div>
            <Switch checked={includeUnopposed} onCheckedChange={toggleIncludeUnopposed} aria-label="Include unopposed positions on the ballot" />
          </div>
        </CardContent>
      </Card>

      {/* Scheduled open / close */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" />Scheduled Open / Close</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Voting automatically stays closed before the open time and after the close time. Leave a field blank to ignore that bound.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Opens at</Label>
              <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
            </div>
            <div>
              <Label>Closes at</Label>
              <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSchedule} className="gap-2"><Timer className="h-4 w-4" />Save schedule</Button>
            <Button onClick={clearSchedule} variant="outline">Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Results certification */}
      <Card className={cert.certified ? "border-emerald-300" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Results Certification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Freeze &amp; sign: both the Electoral Commission chairperson and the head teacher confirm the final results.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-3 ${cert.chair ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chairperson</p>
              {cert.chair ? <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">✓ Signed by {cert.chair}</p>
                : <Button size="sm" className="mt-2" disabled={!(myRole === "chairperson" || myRole === "admin")} onClick={() => sign("chair")}>Sign as chairperson</Button>}
            </div>
            <div className={`rounded-lg border p-3 ${cert.head ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Head Teacher</p>
              {cert.head ? <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">✓ Signed by {cert.head}</p>
                : <Button size="sm" className="mt-2" disabled={!(myRole === "headteacher" || myRole === "admin")} onClick={() => sign("head")}>Sign as head teacher</Button>}
            </div>
          </div>
          {cert.certified && (
            <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-300">
                Results certified on {cert.at ? new Date(cert.at).toLocaleString() : ""}. Download the signed certificate from the Live Results page.
              </AlertDescription>
            </Alert>
          )}
          {(cert.chair || cert.head) && (
            <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={resetCert}>Reset certification</Button>
          )}
        </CardContent>
      </Card>

      {/* Emergency / voice-code broadcast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" />Voice Codes &amp; Emergency Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Start plays <strong>Code 3</strong> (election begun); Stop / Complete play <strong>Code 9</strong> (voting closed).
            These announce aloud and show a banner on every screen — login, ballot, live results and reveal.
          </p>

          {/* Code 5 scheduler */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-blue-900">
              <Timer className="h-4 w-4" /> Code 5 — Voting Instructions
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="c5" className="text-xs">Repeat every (minutes, 0 = off)</Label>
                <Input id="c5" type="number" min={0} value={code5Input} onChange={(e) => setCode5Input(e.target.value)} />
              </div>
              <Button onClick={saveCode5Interval} variant="outline">Save schedule</Button>
              <Button onClick={testCode5} className="bg-blue-600 hover:bg-blue-700">
                <Volume2 className="mr-2 h-4 w-4" />Test Code 5
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {code5Interval > 0
                ? `Code 5 repeats every ${code5Interval} minute${code5Interval === 1 ? "" : "s"} while this page stays open.`
                : "Automatic Code 5 is off."}
            </p>
          </div>

          {/* Lockdown */}
          <div className={`rounded-xl border p-4 ${lockdown ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldAlert className={`h-6 w-6 ${lockdown ? "text-red-600" : "text-slate-500"}`} />
                <div>
                  <p className="font-semibold">{lockdown ? "Lockdown is ACTIVE" : "System Lockdown (Code 7)"}</p>
                  <p className="text-xs text-muted-foreground">
                    Locks the login, live results and reveal screens with a flashing emergency notice and plays Code 7.
                  </p>
                </div>
              </div>
              {lockdown ? (
                <Button onClick={() => toggleLockdown(false)} disabled={loading} variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                  <Lock className="mr-2 h-4 w-4" />Lift Lockdown
                </Button>
              ) : (
                <Button onClick={() => toggleLockdown(true)} disabled={loading} className="bg-red-600 hover:bg-red-700">
                  <ShieldAlert className="mr-2 h-4 w-4" />Initiate Lockdown
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
