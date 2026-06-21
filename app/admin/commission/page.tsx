"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UserCheck, Briefcase, Users, Vote, TrendingUp, Trophy, Radio, RefreshCw, ArrowUpRight, Crown } from "lucide-react"
import { candidateDb, positionDb, userDb, voteDb, getPositionsWithCandidates, electionsDb, getCurrentElectionId } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"

export default function CommissionDashboard() {
  const { schoolName } = useSchoolBranding()
  const [loading, setLoading] = useState(true)
  const [electionName, setElectionName] = useState("")
  const [stats, setStats] = useState({ candidates: 0, positions: 0, voters: 0, votes: 0, voted: 0, turnout: 0 })
  const [races, setRaces] = useState<{ id: string; name: string; total: number; leader?: { name: string; votes: number; pct: number } }[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [cands, pos, users, votes, withCands] = await Promise.all([
        candidateDb.getAll(), positionDb.getAll(), userDb.getAll(), voteDb.getAll(), getPositionsWithCandidates(),
      ])
      const voted = users.filter((u) => u.has_voted).length
      setStats({
        candidates: cands.length,
        positions: pos.filter((p) => p.is_active !== false).length,
        voters: users.length,
        votes: votes.length,
        voted,
        turnout: users.length ? Math.round((voted / users.length) * 100) : 0,
      })
      const r = withCands.map((p) => {
        const pv = votes.filter((v) => v.position_id === p.id)
        const ranked = p.candidates
          .map((c) => ({ name: c.full_name, votes: pv.filter((v) => v.candidate_id === c.id).length }))
          .sort((a, b) => b.votes - a.votes)
        const top = ranked[0]
        return {
          id: p.id, name: p.name, total: pv.length,
          leader: top && top.votes > 0 ? { name: top.name, votes: top.votes, pct: pv.length ? Math.round((top.votes / pv.length) * 100) : 0 } : undefined,
        }
      }).sort((a, b) => b.total - a.total)
      setRaces(r)

      const eid = getCurrentElectionId()
      if (eid) { const e = await electionsDb.getById(eid); setElectionName(e?.name || "") }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  const kpis = [
    { label: "Candidates", value: stats.candidates, icon: UserCheck, cls: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
    { label: "Positions", value: stats.positions, icon: Briefcase, cls: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
    { label: "Voters", value: stats.voters, icon: Users, cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
    { label: "Votes Cast", value: stats.votes, icon: Vote, cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ]
  const links = [
    { href: "/admin/candidates", label: "Candidates", icon: UserCheck },
    { href: "/admin/positions", label: "Positions", icon: Briefcase },
    { href: "/admin/voters", label: "Voters", icon: Users },
    { href: "/admin/results", label: "Live Results", icon: Trophy },
    { href: "/admin/broadcast", label: "Live Coverage", icon: Radio },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A759F] via-[#168AAD] to-[#1E6091] p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#D9ED92]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#D9ED92]">Electoral Commission</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{electionName || schoolName}</h1>
            <p className="text-sm text-sky-100/80">Commission dashboard</p>
          </div>
          <Button onClick={load} variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-slate-200 dark:border-white/10">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg ${k.cls}`}><k.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{k.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Turnout */}
      <Card className="border-slate-200 dark:border-white/10">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><TrendingUp className="h-4 w-4 text-emerald-600" /> Voter Turnout</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.turnout}%</p>
          </div>
          <Progress value={stats.turnout} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stats.voted.toLocaleString()} of {stats.voters.toLocaleString()} voters have voted</p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="border-slate-200 transition hover:border-sky-300 hover:shadow-sm dark:border-white/10 dark:hover:border-sky-500/40">
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <l.icon className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{l.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Leading by position */}
      <Card className="border-slate-200 dark:border-white/10">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Crown className="h-4 w-4 text-amber-500" /> Leading by position</p>
            <Link href="/admin/results" className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-300">Full results <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
          {races.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No positions yet.</p>
          ) : (
            <div className="divide-y dark:divide-white/10">
              {races.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                    <p className="truncate text-xs text-slate-400">{r.leader ? r.leader.name : "Awaiting votes"}</p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.leader ? `${r.leader.pct}%` : "—"}</p>
                    <p className="text-[11px] text-slate-400">{r.total} {r.total === 1 ? "vote" : "votes"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
