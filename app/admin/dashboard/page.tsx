"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Users, Vote, RefreshCw, Tv, Trophy, Clock, ArrowUpRight, Radio,
  FileText, Sparkles, TrendingUp, TrendingDown, Lightbulb,
} from "lucide-react"
import { userDb, candidateDb, voteDb, positionDb, electionControl, type ElectionStatus } from "@/lib/db"
import type { User, Candidate, Position, Vote as VoteRow } from "@/lib/supabase"
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts"

// Meadow Green palette
const PALETTE = ["#168AAD", "#34A0A4", "#52B69A", "#76C893", "#99D98C", "#1A759F", "#1E6091", "#184E77", "#B5E48C", "#D9ED92"]

const statusBadge: Record<ElectionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  stopped: "bg-rose-100 text-rose-700",
  completed: "bg-sky-100 text-sky-700",
}

// Extract the year/constituency (S1–S6) from a class string like "S1A"
function getYear(cls: string): string {
  const m = (cls || "").toUpperCase().match(/^S\s?([1-6])/)
  return m ? "S" + m[1] : "Other"
}

interface PostResult {
  id: string
  name: string
  category: string
  totalVotes: number
  candidates: { id: string; name: string; photo?: string; class?: string; votes: number; pct: number; leading: boolean }[]
}

type Range = "today" | "month" | "all"

// ── Small presentational pieces ─────────────────────────────────
function StatCard({ dot, label, value, trend, trendUp, sub }: {
  dot: string; label: string; value: string | number; trend?: string; trendUp?: boolean; sub?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {(trend || sub) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {trend && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${trendUp ? "text-emerald-600" : "text-rose-500"}`}>
              {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {trend}
            </span>
          )}
          {sub && <span className="text-slate-400">{sub}</span>}
        </div>
      )}
    </div>
  )
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {action ?? <ArrowUpRight className="h-4 w-4 text-slate-300" />}
      </div>
      <div className="p-5 pt-3">{children}</div>
    </div>
  )
}

function CandidateAvatar({ name, photo, leading }: { name: string; photo?: string; leading?: boolean }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold ring-2 ${
      leading ? "bg-emerald-100 text-emerald-700 ring-emerald-300" : "bg-slate-100 text-slate-500 ring-slate-200"
    }`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : initials}
    </div>
  )
}

function RaceCard({ post }: { post: PostResult }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sky-700">{post.name}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{post.category}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
          {post.totalVotes} {post.totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>
      <div className="space-y-2.5">
        {post.candidates.map((c) => (
          <div key={c.id} className={`rounded-lg p-2.5 ${c.leading ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50/60"}`}>
            <div className="flex items-center gap-3">
              <CandidateAvatar name={c.name} photo={c.photo} leading={c.leading} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {c.leading && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{c.votes}</span> {c.votes === 1 ? "vote" : "votes"}
                  <span className="mx-1 text-slate-300">·</span>{c.pct}%
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
              <div className={`h-full rounded-full transition-all duration-500 ${c.leading ? "bg-emerald-500" : "bg-sky-400"}`} style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [raw, setRaw] = useState<{ users: User[]; candidates: Candidate[]; positions: Position[]; votes: VoteRow[] }>({
    users: [], candidates: [], positions: [], votes: [],
  })
  const [status, setStatus] = useState<ElectionStatus>("active")
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>("all")
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
      setRaw({ users, candidates, positions, votes })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const d = useMemo(() => {
    const { users, candidates, positions, votes } = raw
    const now = Date.now()
    const cutoff = range === "today" ? now - 24 * 3600e3 : range === "month" ? now - 30 * 24 * 3600e3 : 0
    const vps = votes.filter((v) => +new Date(v.created_at) >= cutoff) // votes in selected period

    const voted = users.filter((u) => u.has_voted).length
    const turnout = users.length ? Math.round((voted / users.length) * 100) : 0

    // Race standings (uses all votes — current standings)
    const posts: PostResult[] = positions
      .map((p) => {
        const pc = candidates.filter((c) => c.position_id === p.id)
        const pv = votes.filter((v) => v.position_id === p.id)
        const max = Math.max(0, ...pc.map((c) => pv.filter((v) => v.candidate_id === c.id).length))
        return {
          id: p.id, name: p.name, category: p.category, totalVotes: pv.length,
          candidates: pc.map((c) => {
            const n = pv.filter((v) => v.candidate_id === c.id).length
            return { id: c.id, name: c.full_name, photo: c.photo_url, class: c.class, votes: n, pct: pv.length ? Math.round((n / pv.length) * 100) : 0, leading: n > 0 && n === max }
          }).sort((a, b) => b.votes - a.votes),
        }
      })
      .filter((p) => p.candidates.length > 0)

    // Votes by position category (for gauge)
    const catMap: Record<string, number> = {}
    positions.forEach((p) => {
      const pv = votes.filter((v) => v.position_id === p.id).length
      catMap[p.category] = (catMap[p.category] || 0) + pv
    })
    const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value })).filter((c) => c.value > 0)

    // Time series from votes-in-period
    const sorted = [...vps].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    let volume: { label: string; votes: number }[] = []
    let performance: Record<string, number | string>[] = []
    let perfKeys: string[] = []
    if (sorted.length) {
      const first = +new Date(sorted[0].created_at)
      const last = +new Date(sorted[sorted.length - 1].created_at)
      const span = Math.max(1, last - first)
      const B = 8
      const idxOf = (t: string) => Math.min(B - 1, Math.floor(((+new Date(t) - first) / span) * B))
      const labels = Array.from({ length: B }, (_, i) =>
        new Date(first + (span / B) * i).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      )
      const counts = new Array(B).fill(0)
      sorted.forEach((v) => counts[idxOf(v.created_at)]++)
      volume = counts.map((c, i) => ({ label: labels[i], votes: c }))

      const top = [...posts].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 3)
      perfKeys = top.map((p) => p.name)
      const perCum = top.map(() => 0)
      performance = labels.map((lab, i) => {
        const row: Record<string, number | string> = { label: lab }
        top.forEach((p, ti) => {
          const inBucket = vps.filter((v) => v.position_id === p.id && idxOf(v.created_at) === i).length
          perCum[ti] += inBucket
          row[p.name] = perCum[ti]
        })
        return row
      })
    }

    // Constituency breakdown table
    const constituency = ["S1", "S2", "S3", "S4", "S5", "S6", "Other"].map((y) => {
      const list = users.filter((u) => getYear(u.class) === y)
      const v = list.filter((u) => u.has_voted).length
      return { year: y, total: list.length, voted: v, pending: list.length - v, turnout: list.length ? Math.round((v / list.length) * 100) : 0 }
    }).filter((c) => c.total > 0)

    // Recent activity (period)
    const candMap = new Map(candidates.map((c) => [c.id, c.full_name]))
    const posMap = new Map(positions.map((p) => [p.id, p.name]))
    const userMap = new Map(users.map((u) => [u.id, u.full_name]))
    const activity = [...vps]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 6)
      .map((v) => ({
        id: v.id,
        voter: userMap.get(v.user_id) || "Unknown",
        action: `${candMap.get(v.candidate_id) || "Unknown"} · ${posMap.get(v.position_id) || "Unknown"}`,
        time: new Date(v.created_at).toLocaleString(),
      }))

    const leadingRace = [...posts].sort((a, b) => b.totalVotes - a.totalVotes)[0]
    const leader = leadingRace?.candidates[0]

    return {
      voters: users.length, voted, candidates: candidates.length, votes: votes.length, votesInPeriod: vps.length,
      turnout, posts, byCategory, volume, performance, perfKeys, constituency, activity,
      turnoutPie: [{ name: "Voted", value: voted }, { name: "Pending", value: Math.max(0, users.length - voted) }],
      gaugeTotal: byCategory.reduce((s, c) => s + c.value, 0),
      leadingRace, leader,
    }
  }, [raw, range])

  const visiblePosts = onlyLeaders
    ? d.posts.map((p) => ({ ...p, candidates: p.candidates.filter((c) => c.leading) }))
    : d.posts

  const constituencyStatus = (t: number) =>
    t >= 60 ? { label: "On track", cls: "bg-emerald-50 text-emerald-700" }
      : t >= 40 ? { label: "Fair", cls: "bg-amber-50 text-amber-700" }
        : { label: "Low", cls: "bg-rose-50 text-rose-600" }

  const rangeLabel = range === "today" ? "today" : range === "month" ? "this month" : "all time"

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-sky-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {([["today", "Today"], ["month", "This month"], ["all", "All time"]] as [Range, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4" /> New Report</Button>
          </Link>
          <Link href="/admin/live-results" target="_blank">
            <Button size="sm" className="gap-2 bg-sky-600 hover:bg-sky-700"><Tv className="h-4 w-4" /> Live Results</Button>
          </Link>
        </div>
      </div>

      {/* Stat cards + insights */}
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard dot="#168AAD" label="Registered Voters" value={d.voters.toLocaleString()} trend={`${d.candidates} candidates`} trendUp sub="on the ballot" />
        <StatCard dot="#52B69A" label="Votes Cast" value={d.votes.toLocaleString()} trend={`${d.votesInPeriod} ${rangeLabel}`} trendUp sub="ballots recorded" />
        <StatCard dot="#76C893" label="Voter Turnout" value={`${d.turnout}%`} trend={`${d.voted} voted`} trendUp={d.turnout > 0} sub={`of ${d.voters}`} />

        {/* Insights panel (Ask-me-anything analogue) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span className="font-semibold text-slate-800">Election Insights</span>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-2.5">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <p className="text-slate-600"><span className="font-semibold text-slate-800">{d.turnout}% turnout</span> — {d.voters - d.voted} students still to vote.</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-2.5">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-slate-600">
                {d.leader && d.leadingRace
                  ? <>Leading: <span className="font-semibold text-slate-800">{d.leader.name}</span> in {d.leadingRace.name}.</>
                  : "No votes recorded yet."}
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-slate-600">{d.constituency.length} constituencies active · {d.candidates} candidates competing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Volume + performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Voting Volume">
          <p className="mb-1 text-2xl font-extrabold text-slate-900">{d.votesInPeriod.toLocaleString()}</p>
          <p className="mb-3 text-xs text-slate-400">votes cast {rangeLabel}</p>
          {d.volume.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No votes in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={d.volume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} />
                <Bar dataKey="votes" radius={[5, 5, 0, 0]} maxBarSize={26}>
                  {d.volume.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Performance">
          {d.performance.length === 0 || d.perfKeys.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Position trends appear as votes come in.</p>
          ) : (
            <ResponsiveContainer width="100%" height={222}>
              <LineChart data={d.performance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {d.perfKeys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i]} strokeWidth={2.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Turnout donut + constituency table + gauge */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Donut */}
        <Panel title="Turnout">
          <div className="relative">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={d.turnoutPie.some((x) => x.value > 0) ? d.turnoutPie : [{ name: "No votes", value: 1 }]}
                  dataKey="value" cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none"
                >
                  <Cell fill="#168AAD" />
                  <Cell fill="#E2E8F0" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{d.turnout}%</span>
              <span className="text-xs text-slate-400">turnout</span>
            </div>
          </div>
          <div className="mt-2 flex justify-center gap-5 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-[#168AAD]" />Voted {d.voted}</span>
            <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" />Pending {Math.max(0, d.voters - d.voted)}</span>
          </div>
        </Panel>

        {/* Constituency table */}
        <Panel title="Constituency Breakdown" className="lg:col-span-1">
          {d.constituency.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No voters registered yet.</p>
          ) : (
            <div className="overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-100 pb-2 text-[11px] uppercase tracking-wide text-slate-400">
                <span>Constituency</span><span className="text-right">Turnout</span><span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-slate-100">
                {d.constituency.map((c) => {
                  const st = constituencyStatus(c.turnout)
                  return (
                    <div key={c.year} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{c.year}</p>
                        <p className="text-xs text-slate-400">{c.voted}/{c.total} voted</p>
                      </div>
                      <span className="text-right font-semibold text-slate-700">{c.turnout}%</span>
                      <span className={`justify-self-end rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Gauge */}
        <Panel title="Votes by Category">
          <div className="relative">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={d.byCategory.length ? d.byCategory : [{ name: "No votes", value: 1 }]}
                  dataKey="value" cx="50%" cy="62%" startAngle={210} endAngle={-30}
                  innerRadius={64} outerRadius={92} paddingAngle={2} stroke="none" cornerRadius={6}
                >
                  {(d.byCategory.length ? d.byCategory : [{ name: "x", value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={d.byCategory.length ? PALETTE[i % PALETTE.length] : "#E2E8F0"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
              <span className="text-3xl font-bold text-slate-900">{d.gaugeTotal.toLocaleString()}</span>
              <span className="text-xs text-slate-400">total votes</span>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
            {d.byCategory.map((c, i) => (
              <span key={c.name} className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                {c.name} <span className="font-semibold text-slate-800">{c.value}</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      {/* Live Race Tracker (existing feature, integrated) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
              <input type="checkbox" checked={onlyLeaders} onChange={(e) => setOnlyLeaders(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
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
              {visiblePosts.map((post) => <RaceCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <Panel title="Recent Activity">
        {d.activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No votes {rangeLabel}.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.activity.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{a.voter}</p>
                  <p className="truncate text-xs text-slate-500">{a.action}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> {a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
