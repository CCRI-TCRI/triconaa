"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Users, Vote, Award, BarChart3, RefreshCw, Tv, Power, PauseCircle, StopCircle, Flag,
  Crown, Clock, ArrowUpRight,
} from "lucide-react"
import { userDb, candidateDb, voteDb, positionDb, electionControl, broadcastDb, type ElectionStatus } from "@/lib/db"
import { BRANDING_UPDATED_EVENT } from "@/components/school-branding-provider"

interface PostResult {
  id: string
  name: string
  category: string
  totalVotes: number
  candidates: { id: string; name: string; votes: number; pct: number; leading: boolean }[]
}

const statusBadge: Record<ElectionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  stopped: "bg-rose-100 text-rose-700",
  completed: "bg-indigo-100 text-indigo-700",
}

function StatCard({ label, value, sub, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ voters: 0, voted: 0, candidates: 0, votes: 0 })
  const [posts, setPosts] = useState<PostResult[]>([])
  const [activity, setActivity] = useState<{ id: string; voter: string; action: string; time: string }[]>([])
  const [status, setStatus] = useState<ElectionStatus>("active")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    try {
      const [users, candidates, positions, votes, control] = await Promise.all([
        userDb.getAll(), candidateDb.getAll(), positionDb.getAll(), voteDb.getAll(), electionControl.get(),
      ])
      setStatus(control.status)
      setStats({
        voters: users.length,
        voted: users.filter((u) => u.has_voted).length,
        candidates: candidates.length,
        votes: votes.length,
      })

      setPosts(
        positions
          .map((p) => {
            const pc = candidates.filter((c) => c.position_id === p.id)
            const pv = votes.filter((v) => v.position_id === p.id)
            const max = Math.max(0, ...pc.map((c) => pv.filter((v) => v.candidate_id === c.id).length))
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              totalVotes: pv.length,
              candidates: pc
                .map((c) => {
                  const n = pv.filter((v) => v.candidate_id === c.id).length
                  return { id: c.id, name: c.full_name, votes: n, pct: pv.length ? Math.round((n / pv.length) * 100) : 0, leading: n > 0 && n === max }
                })
                .sort((a, b) => b.votes - a.votes),
            }
          })
          .filter((p) => p.candidates.length > 0),
      )

      const candMap = new Map(candidates.map((c) => [c.id, c.full_name]))
      const posMap = new Map(positions.map((p) => [p.id, p.name]))
      const userMap = new Map(users.map((u) => [u.id, u.full_name]))
      setActivity(
        votes.slice(0, 8).map((v) => ({
          id: v.id,
          voter: userMap.get(v.user_id) || "Unknown",
          action: `${candMap.get(v.candidate_id) || "Unknown"} · ${posMap.get(v.position_id) || "Unknown"}`,
          time: new Date(v.created_at).toLocaleString(),
        })),
      )
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function changeStatus(next: ElectionStatus) {
    setWorking(true)
    try {
      await electionControl.setStatus(next)
      if (next === "active") await broadcastDb.trigger("3")
      else if (next === "stopped" || next === "completed") await broadcastDb.trigger("9")
      setStatus(next)
      window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
    } finally {
      setWorking(false)
    }
  }

  const turnout = stats.voters ? Math.round((stats.voted / stats.voters) * 100) : 0

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500">Overview and election controls</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/admin/live-results" target="_blank">
            <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Tv className="h-4 w-4" /> Live Results
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered Voters" value={stats.voters} sub="eligible students" icon={Users} tone="indigo" />
        <StatCard label="Turnout" value={`${turnout}%`} sub={`${stats.voted} of ${stats.voters} voted`} icon={BarChart3} tone="emerald" />
        <StatCard label="Candidates" value={stats.candidates} sub="running for office" icon={Award} tone="amber" />
        <StatCard label="Votes Cast" value={stats.votes} sub="total ballots" icon={Vote} tone="rose" />
      </div>

      {/* Controls + turnout */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Election Controls"
            action={<span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBadge[status]}`}>{status}</span>}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button onClick={() => changeStatus("active")} disabled={working || status === "active"} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Power className="h-4 w-4" /> Start
              </Button>
              <Button onClick={() => changeStatus("paused")} disabled={working || status !== "active"} variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                <PauseCircle className="h-4 w-4" /> Pause
              </Button>
              <Button onClick={() => changeStatus("stopped")} disabled={working || status === "stopped"} variant="outline" className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
                <StopCircle className="h-4 w-4" /> Stop
              </Button>
              <Button onClick={() => changeStatus("completed")} disabled={working || status === "completed"} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Flag className="h-4 w-4" /> Complete
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Start plays Code 3 and opens the ballot. Stop/Complete play Code 9. Completing locks results and switches Live Results to the Reveal Show. More options in{" "}
              <Link href="/admin/control" className="text-indigo-600 hover:underline">Control System</Link>.
            </p>
          </Panel>
        </div>

        <Panel title="Voter Participation">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800">{turnout}%</span>
            <span className="text-sm text-slate-500">{stats.voted}/{stats.voters}</span>
          </div>
          <Progress value={turnout} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-slate-400">of registered students have voted</p>
        </Panel>
      </div>

      {/* Results + activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Results by Position"
            action={
              <Link href="/admin/results" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {posts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No results yet. Add candidates and wait for votes.</p>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <div key={post.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{post.category}</p>
                        <p className="font-semibold text-slate-800">{post.name}</p>
                      </div>
                      <span className="text-sm text-slate-500">{post.totalVotes} votes</span>
                    </div>
                    <div className="space-y-2">
                      {post.candidates.map((c) => (
                        <div key={c.id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              {c.leading && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                              {c.name}
                            </span>
                            <span className="font-medium text-slate-500">{c.votes} · {c.pct}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${c.leading ? "bg-indigo-600" : "bg-slate-300"}`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Recent Activity">
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No votes yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{a.voter}</p>
                    <p className="truncate text-xs text-slate-500">{a.action}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" /> {a.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
