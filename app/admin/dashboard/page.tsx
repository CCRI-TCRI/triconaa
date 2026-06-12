"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Users, Vote, Award, BarChart3, RefreshCw, Tv,
  Trophy, Clock, ArrowUpRight, Radio,
} from "lucide-react"
import { userDb, candidateDb, voteDb, positionDb, electionControl, type ElectionStatus } from "@/lib/db"

interface PostResult {
  id: string
  name: string
  category: string
  totalVotes: number
  candidates: { id: string; name: string; photo?: string; class?: string; votes: number; pct: number; leading: boolean }[]
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

function CandidateAvatar({ name, photo, leading }: { name: string; photo?: string; leading?: boolean }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold ring-2 ${
        leading ? "bg-emerald-100 text-emerald-700 ring-emerald-300" : "bg-slate-100 text-slate-500 ring-slate-200"
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}

function RaceCard({ post }: { post: PostResult }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      {/* card header */}
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sky-700">{post.name}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{post.category}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
          {post.totalVotes} {post.totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>

      {/* candidates */}
      <div className="space-y-2.5">
        {post.candidates.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg p-2.5 ${
              c.leading ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <CandidateAvatar name={c.name} photo={c.photo} leading={c.leading} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {c.leading && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{c.votes}</span> {c.votes === 1 ? "vote" : "votes"}
                  <span className="mx-1 text-slate-300">·</span>
                  {c.pct}%
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.leading ? "bg-emerald-500" : "bg-sky-400"}`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ voters: 0, voted: 0, candidates: 0, votes: 0 })
  const [posts, setPosts] = useState<PostResult[]>([])
  const [activity, setActivity] = useState<{ id: string; voter: string; action: string; time: string }[]>([])
  const [status, setStatus] = useState<ElectionStatus>("active")
  const [loading, setLoading] = useState(true)
  const [onlyLeaders, setOnlyLeaders] = useState(false)

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
                  return { id: c.id, name: c.full_name, photo: c.photo_url, class: c.class, votes: n, pct: pv.length ? Math.round((n / pv.length) * 100) : 0, leading: n > 0 && n === max }
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

  const turnout = stats.voters ? Math.round((stats.voted / stats.voters) * 100) : 0
  const visiblePosts = onlyLeaders
    ? posts.map((p) => ({ ...p, candidates: p.candidates.filter((c) => c.leading) }))
    : posts

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

      {/* Live Race Tracker */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <h3 className="text-lg font-bold text-slate-800">Live Race Tracker</h3>
            <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge[status]}`}>{status}</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyLeaders}
                onChange={(e) => setOnlyLeaders(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Only leaders
            </label>
            <Link href="/admin/results" className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="p-5">
          {visiblePosts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Radio className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">No results yet. Add candidates and wait for the first votes to come in.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visiblePosts.map((post) => (
                <RaceCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Participation + activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Voter Participation">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800">{turnout}%</span>
            <span className="text-sm text-slate-500">{stats.voted}/{stats.voters}</span>
          </div>
          <Progress value={turnout} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-slate-400">of registered students have voted</p>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Recent Activity">
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No votes yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
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
    </div>
  )
}
