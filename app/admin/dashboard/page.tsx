"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Users, Vote, RefreshCw, Tv, Trophy, Clock, ArrowUpRight, Radio,
  Sparkles, TrendingUp, TrendingDown, Eye, Percent, Award, Plus, Download,
  Calendar, ChevronDown, Send, X, Star, BarChart3, PieChart as PieIcon, LineChart as LineIcon, Layers,
} from "lucide-react"
import { userDb, candidateDb, voteDb, positionDb, electionControl, type ElectionStatus } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import type { User, Candidate, Position, Vote as VoteRow } from "@/lib/supabase"
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, AreaChart, Area, CartesianGrid, Legend,
} from "recharts"

const PALETTE = ["#168AAD", "#34A0A4", "#52B69A", "#76C893", "#99D98C", "#1A759F", "#1E6091", "#184E77", "#B5E48C", "#D9ED92"]

const statusBadge: Record<ElectionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  stopped: "bg-rose-100 text-rose-700",
  completed: "bg-sky-100 text-sky-700",
}

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

type Range = "today" | "week" | "month" | "all"
const RANGE_LABEL: Record<Range, string> = { today: "Today", week: "Last 7 days", month: "Last 30 days", all: "All time" }
const RANGE_MS: Record<Range, number | null> = { today: 864e5, week: 7 * 864e5, month: 30 * 864e5, all: null }

const OPTIONAL_WIDGETS = [
  { key: "category", title: "Votes by Category", desc: "How votes split across prefect categories.", tag: "#Insights", icon: PieIcon },
  { key: "volume", title: "Voting Activity", desc: "Ballots cast over the course of the election.", tag: "#Operations", icon: BarChart3 },
  { key: "trend", title: "Race Momentum", desc: "Track the top prefect races as votes arrive.", tag: "#Strategy", icon: LineIcon },
  { key: "constituency", title: "Voters by Constituency", desc: "Turnout grouped by year (S1–S6).", tag: "#Segments", icon: Layers },
  { key: "activity", title: "Live Vote Feed", desc: "The latest ballots cast in real time.", tag: "#Live", icon: Radio },
] as const
type WidgetKey = (typeof OPTIONAL_WIDGETS)[number]["key"]

// ── small pieces ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, deltaPct, up, sub }: {
  icon: any; label: string; value: string | number; deltaPct?: number | null; up?: boolean; sub: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
        {deltaPct != null && (
          <span className={`mb-1 inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-5 pt-3">{children}</div>
    </div>
  )
}

function TurnoutGauge({ value, target = 80 }: { value: number; target?: number }) {
  const N = 44
  const filled = Math.round((value / 100) * N)
  const cx = 110, cy = 112, rOut = 96, rIn = 78
  const ticks = Array.from({ length: N }, (_, i) => {
    const a = Math.PI - Math.PI * (i / (N - 1))
    return {
      x1: cx + Math.cos(a) * rIn, y1: cy - Math.sin(a) * rIn,
      x2: cx + Math.cos(a) * rOut, y2: cy - Math.sin(a) * rOut,
      on: i < filled,
    }
  })
  return (
    <div className="relative">
      <svg viewBox="0 0 220 124" className="w-full">
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.on ? "#52B69A" : "#E2E8F0"} strokeWidth={3} strokeLinecap="round" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 top-4 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-slate-900">{value}%</span>
        <span className="mt-1 text-xs text-slate-400">On track for {target}% target</span>
      </div>
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
  const { schoolName, electionTerm } = useSchoolBranding()
  const [raw, setRaw] = useState<{ users: User[]; candidates: Candidate[]; positions: Position[]; votes: VoteRow[] }>({
    users: [], candidates: [], positions: [], votes: [],
  })
  const [status, setStatus] = useState<ElectionStatus>("active")
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>("month")
  const [onlyLeaders, setOnlyLeaders] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [widgets, setWidgets] = useState<WidgetKey[]>(["category", "constituency"])
  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([])
  const [q, setQ] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("dash_widgets")
    if (saved) { try { setWidgets(JSON.parse(saved)) } catch { /* ignore */ } }
  }, [])
  useEffect(() => { localStorage.setItem("dash_widgets", JSON.stringify(widgets)) }, [widgets])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [chat])

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
    const win = RANGE_MS[range]

    const inWin = (t?: string, a = now - (win ?? 0), b = now) =>
      t != null && +new Date(t) >= a && +new Date(t) < b
    const votesCur = win ? votes.filter((v) => inWin(v.created_at)).length : votes.length
    const votesPrev = win ? votes.filter((v) => inWin(v.created_at, now - 2 * win, now - win)).length : 0
    const votedCur = win ? users.filter((u) => inWin(u.voted_at)).length : users.filter((u) => u.has_voted).length
    const votedPrev = win ? users.filter((u) => inWin(u.voted_at, now - 2 * win, now - win)).length : 0
    const trend = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0)

    const voted = users.filter((u) => u.has_voted).length
    const turnout = users.length ? Math.round((voted / users.length) * 100) : 0

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

    // category split
    const catMap: Record<string, number> = {}
    positions.forEach((p) => { catMap[p.category] = (catMap[p.category] || 0) + votes.filter((v) => v.position_id === p.id).length })
    const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
    const segments = byCategory.slice(0, 3)

    // votes in selected window for time series
    const vps = votes.filter((v) => (win ? inWin(v.created_at) : true))
    const sorted = [...vps].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    let area: { label: string; votes: number }[] = []
    let volume: { label: string; votes: number }[] = []
    let performance: Record<string, number | string>[] = []
    let perfKeys: string[] = []
    if (sorted.length) {
      const first = +new Date(sorted[0].created_at)
      const last = +new Date(sorted[sorted.length - 1].created_at)
      const span = Math.max(1, last - first)
      const B = 8
      const idxOf = (t: string) => Math.min(B - 1, Math.floor(((+new Date(t) - first) / span) * B))
      const labels = Array.from({ length: B }, (_, i) => new Date(first + (span / B) * i).toLocaleDateString([], { month: "short", day: "numeric" }))
      const counts = new Array(B).fill(0)
      sorted.forEach((v) => counts[idxOf(v.created_at)]++)
      volume = counts.map((c, i) => ({ label: labels[i], votes: c }))
      let cum = 0
      area = counts.map((c, i) => { cum += c; return { label: labels[i], votes: cum } })
      const top = [...posts].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 3)
      perfKeys = top.map((p) => p.name)
      const perCum = top.map(() => 0)
      performance = labels.map((lab, i) => {
        const row: Record<string, number | string> = { label: lab }
        top.forEach((p, ti) => { perCum[ti] += vps.filter((v) => v.position_id === p.id && idxOf(v.created_at) === i).length; row[p.name] = perCum[ti] })
        return row
      })
    }

    // most active day of week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const dayCounts = new Array(7).fill(0)
    vps.forEach((v) => { dayCounts[new Date(v.created_at).getDay()]++ })
    const maxDay = Math.max(0, ...dayCounts)
    const byDay = dayCounts.map((c, i) => ({ day: dayNames[i], votes: c, peak: c > 0 && c === maxDay }))

    // constituency
    const constituency = ["S1", "S2", "S3", "S4", "S5", "S6", "Other"].map((y) => {
      const list = users.filter((u) => getYear(u.class) === y)
      const v = list.filter((u) => u.has_voted).length
      return { year: y, total: list.length, voted: v, turnout: list.length ? Math.round((v / list.length) * 100) : 0 }
    }).filter((c) => c.total > 0)

    // top candidates leaderboard
    const candVotes = candidates.map((c) => {
      const n = votes.filter((v) => v.candidate_id === c.id).length
      const pos = positions.find((p) => p.id === c.position_id)
      const posTotal = votes.filter((v) => v.position_id === c.position_id).length
      return { id: c.student_id || c.id.slice(0, 6), name: c.full_name, photo: c.photo_url, position: pos?.name || "—", votes: n, pct: posTotal ? Math.round((n / posTotal) * 100) : 0 }
    }).sort((a, b) => b.votes - a.votes).slice(0, 6)

    // activity
    const candMap = new Map(candidates.map((c) => [c.id, c.full_name]))
    const posMap = new Map(positions.map((p) => [p.id, p.name]))
    const userMap = new Map(users.map((u) => [u.id, u.full_name]))
    const activity = [...vps].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6).map((v) => ({
      id: v.id, voter: userMap.get(v.user_id) || "Unknown",
      action: `${candMap.get(v.candidate_id) || "Unknown"} · ${posMap.get(v.position_id) || "Unknown"}`,
      time: new Date(v.created_at).toLocaleString(),
    }))

    const leadingRace = [...posts].sort((a, b) => b.totalVotes - a.totalVotes)[0]
    const leader = leadingRace?.candidates[0]

    return {
      voters: users.length, voted, candidates: candidates.length, positions: positions.filter((p) => p.is_active !== false).length,
      votes: votes.length, turnout,
      votesCur, votesPrev, votesTrend: trend(votesCur, votesPrev),
      votedCur, votedPrev, votedTrend: trend(votedCur, votedPrev),
      posts, byCategory, segments, area, volume, performance, perfKeys, byDay, constituency, candVotes, activity,
      turnoutPie: [{ name: "Voted", value: voted }, { name: "Pending", value: Math.max(0, users.length - voted) }],
      leadingRace, leader,
    }
  }, [raw, range])

  const visiblePosts = onlyLeaders ? d.posts.map((p) => ({ ...p, candidates: p.candidates.filter((c) => c.leading) })) : d.posts
  const constituencyStatus = (t: number) =>
    t >= 60 ? { label: "On track", cls: "bg-emerald-50 text-emerald-700" }
      : t >= 40 ? { label: "Fair", cls: "bg-amber-50 text-amber-700" }
        : { label: "Low", cls: "bg-rose-50 text-rose-600" }

  const win = RANGE_MS[range]
  const dateSpan = win
    ? `${new Date(Date.now() - win).toLocaleDateString([], { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
    : "All time"

  function toggleWidget(k: WidgetKey) {
    setWidgets((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Registered Voters", d.voters], ["Votes Cast", d.votes], ["Turnout %", d.turnout],
      ["Candidates", d.candidates], ["Positions", d.positions], [],
      ["Constituency", "Registered", "Voted", "Turnout %"],
      ...d.constituency.map((c) => [c.year, c.total, c.voted, c.turnout]),
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `dashboard-${new Date().toISOString().split("T")[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function answer(question: string): string {
    const s = question.toLowerCase()
    if (s.includes("turnout")) return `Turnout is ${d.turnout}% — ${d.voted} of ${d.voters} students have voted.`
    if (s.includes("lead") || s.includes("win")) {
      const pos = d.posts.find((p) => s.includes(p.name.toLowerCase()))
      if (pos) { const l = pos.candidates[0]; return l && l.votes > 0 ? `${l.name} is leading ${pos.name} with ${l.votes} votes (${l.pct}%).` : `No votes yet for ${pos.name}.` }
      if (d.leader && d.leadingRace) return `The busiest race is ${d.leadingRace.name}, where ${d.leader.name} currently leads.`
    }
    if (s.includes("how many vote") || s.includes("total vote") || s.includes("votes cast")) return `${d.votes} votes have been cast so far.`
    if (s.includes("candidate")) return `There are ${d.candidates} candidates across ${d.posts.length} active races.`
    if (s.includes("constituen") || s.includes("class") || s.includes("year")) {
      const top = [...d.constituency].sort((a, b) => b.turnout - a.turnout)[0]
      return top ? `${top.year} has the highest turnout at ${top.turnout}% (${top.voted}/${top.total}).` : "No constituency data yet."
    }
    return `Turnout is ${d.turnout}% with ${d.votes} votes cast. Try: "who is leading Head Prefect?", "turnout", or "which constituency leads?"`
  }
  function send(text: string) {
    const t = text.trim()
    if (!t) return
    setChat((c) => [...c, { role: "user", text: t }, { role: "bot", text: answer(t) }])
    setQ("")
  }
  function ask(e: React.FormEvent) {
    e.preventDefault()
    send(q)
  }
  // Suggestion chips built from this election's real races
  const suggestions = [
    ...d.posts.slice(0, 2).map((p) => `Who is leading ${p.name}?`),
    "What is the turnout?",
    "Which constituency leads?",
  ]

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-sky-500" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="truncate">{schoolName}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{electionTerm}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[status]}`}>{status}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 sm:flex">
            <Calendar className="h-4 w-4 text-slate-400" /> {dateSpan}
          </span>
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
          </div>
          <Link href="/admin/broadcast">
            <Button size="sm" className="gap-2 bg-blue-600 font-semibold text-white hover:bg-blue-700">
              <Sparkles className="h-4 w-4" /> Live Coverage
            </Button>
          </Link>
          <Button onClick={() => setAddOpen(true)} variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add widget</Button>
          <Button onClick={exportCsv} size="sm" className="gap-2 bg-sky-600 hover:bg-sky-700"><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Eye} label="Votes Cast" value={d.votesCur.toLocaleString()} deltaPct={win ? d.votesTrend : null} up={d.votesCur >= d.votesPrev} sub={win ? `vs ${d.votesPrev} last period` : `${d.votes} total ballots`} />
        <StatCard icon={Users} label="Voters Turned Out" value={d.votedCur.toLocaleString()} deltaPct={win ? d.votedTrend : null} up={d.votedCur >= d.votedPrev} sub={win ? `vs ${d.votedPrev} last period` : `${d.voted} students voted`} />
        <StatCard icon={Percent} label="Turnout" value={`${d.turnout}%`} sub={`${d.voted} of ${d.voters} registered`} />
        <StatCard icon={Award} label="Candidates" value={d.candidates.toLocaleString()} sub={`across ${d.positions} positions`} />
      </div>

      {/* Main split: left big chart, right column */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Total Votes */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Panel title="Total Votes" action={<ArrowUpRight className="h-4 w-4 text-slate-300" />}>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-extrabold text-slate-900">{d.votes.toLocaleString()}</p>
              {win && (
                <span className={`mb-1 inline-flex items-center gap-0.5 text-xs font-semibold ${d.votesCur >= d.votesPrev ? "text-emerald-600" : "text-rose-500"}`}>
                  {d.votesCur >= d.votesPrev ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{Math.abs(d.votesTrend)}% vs last period
                </span>
              )}
            </div>
            {d.area.length === 0 ? (
              <p className="py-14 text-center text-sm text-slate-400">Votes will chart here as ballots are cast.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d.area} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#168AAD" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#168AAD" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="votes" stroke="#168AAD" strokeWidth={2.5} fill="url(#tv)" name="Cumulative votes" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          {/* Participation segments */}
          <Panel title="Participation" action={<span className="text-xs text-slate-400">by category</span>} className="flex-1">
            {d.segments.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No votes yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {d.segments.map((s, i) => (
                  <div key={s.name} className="border-b-2 pb-2" style={{ borderColor: PALETTE[i] }}>
                    <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
                    <p className="truncate text-xs text-slate-500">{s.name}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Most active day */}
          <Panel title="Busiest Voting Day">
            <div className="flex h-[150px] items-end justify-between gap-2">
              {d.byDay.map((dd) => {
                const max = Math.max(1, ...d.byDay.map((x) => x.votes))
                const h = Math.max(6, Math.round((dd.votes / max) * 120))
                return (
                  <div key={dd.day} className="flex flex-1 flex-col items-center gap-1.5">
                    {dd.peak && <span className="text-[11px] font-bold text-sky-600">{dd.votes}</span>}
                    <div className={`w-full rounded-md ${dd.peak ? "bg-sky-500" : "bg-slate-100"}`} style={{ height: h }} />
                    <span className={`text-[11px] ${dd.peak ? "font-semibold text-slate-700" : "text-slate-400"}`}>{dd.day}</span>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Turnout gauge */}
          <Panel title="Voter Turnout Rate" action={<Link href="/admin/results" className="text-xs font-medium text-sky-600 hover:underline">Show details</Link>}>
            <TurnoutGauge value={d.turnout} target={80} />
          </Panel>

          {/* AI Assistant */}
          <Panel title="Election Assistant" action={<Sparkles className="h-4 w-4 text-sky-500" />} className="flex-1">
            <div className="mb-3 flex justify-center">
              <div className="h-14 w-14 animate-pulse rounded-full bg-[radial-gradient(circle_at_30%_30%,#76C893,#168AAD_60%,#1E6091)] shadow-lg" />
            </div>
            <div className="mb-2 max-h-40 space-y-2 overflow-y-auto">
              {chat.length === 0 ? (
                <p className="text-center text-xs text-slate-400">Ask about turnout, a prefect race, or a constituency.</p>
              ) : chat.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${m.role === "user" ? "ml-auto bg-sky-600 text-white" : "bg-slate-100 text-slate-700"}`}>{m.text}</div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {chat.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={ask} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask me anything…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              <button type="submit" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-600 text-white hover:bg-sky-700"><Send className="h-3.5 w-3.5" /></button>
            </form>
          </Panel>
        </div>
      </div>

      {/* Optional widgets */}
      {widgets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgets.includes("category") && (
            <Panel title="Votes by Category">
              {d.byCategory.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">No votes yet.</p> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={d.byCategory} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                        {d.byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 text-sm">
                    {d.byCategory.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}</span>
                        <span className="font-semibold text-slate-800">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}
          {widgets.includes("volume") && (
            <Panel title="Voting Activity">
              {d.volume.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">No votes in this period.</p> : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={d.volume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "#F1F5F9" }} />
                    <Bar dataKey="votes" radius={[5, 5, 0, 0]} maxBarSize={26}>{d.volume.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          )}
          {widgets.includes("trend") && (
            <Panel title="Race Momentum">
              {d.performance.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Race trends appear as votes come in.</p> : (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={d.performance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    {d.perfKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i]} strokeWidth={2.5} dot={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>
          )}
          {widgets.includes("constituency") && (
            <Panel title="Voters by Constituency">
              {d.constituency.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">No voters registered yet.</p> : (
                <div className="divide-y divide-slate-100">
                  {d.constituency.map((c) => {
                    const st = constituencyStatus(c.turnout)
                    return (
                      <div key={c.year} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2.5 text-sm">
                        <div><p className="font-semibold text-slate-800">{c.year}</p><p className="text-xs text-slate-400">{c.voted}/{c.total} voted</p></div>
                        <span className="text-right font-semibold text-slate-700">{c.turnout}%</span>
                        <span className={`justify-self-end rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          )}
          {widgets.includes("activity") && (
            <Panel title="Live Vote Feed">
              {d.activity.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No votes in this period.</p> : (
                <ul className="space-y-2.5">
                  {d.activity.map((a) => (
                    <li key={a.id} className="flex gap-3 rounded-lg border border-slate-100 p-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700">{a.voter}</p><p className="truncate text-xs text-slate-500">{a.action}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Top Candidates (Best Selling analogue) */}
      <Panel title="Top Candidates" action={<Link href="/admin/results" className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
        {d.candVotes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No candidates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-medium">ID</th><th className="pb-2 pr-3 font-medium">Candidate</th>
                  <th className="pb-2 pr-3 font-medium">Position</th><th className="pb-2 pr-3 text-right font-medium">Votes</th>
                  <th className="pb-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.candVotes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{c.id}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <CandidateAvatar name={c.name} photo={c.photo} />
                        <span className="font-medium text-slate-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{c.position}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">{c.votes}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-slate-600"><Star className="h-3.5 w-3.5 text-amber-400" />{c.pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Live Race Tracker (left exactly as-is) */}
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
            <Link href="/admin/results" className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link>
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

      {/* Add Widget slide-over */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setAddOpen(false)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">Add Widget</h3>
              <button onClick={() => setAddOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {OPTIONAL_WIDGETS.map((w) => {
                const active = widgets.includes(w.key)
                return (
                  <div key={w.key} className={`flex gap-4 rounded-xl border p-4 ${active ? "border-sky-200 bg-sky-50/40" : "border-slate-200"}`}>
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><w.icon className="h-7 w-7" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{w.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{w.desc}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{w.tag}</span>
                        <Button onClick={() => toggleWidget(w.key)} size="sm" variant={active ? "outline" : "default"} className={active ? "" : "bg-sky-600 hover:bg-sky-700"}>
                          {active ? "Remove" : "Select"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-slate-100 p-4">
              <Button onClick={() => setAddOpen(false)} className="w-full bg-sky-600 hover:bg-sky-700">Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
