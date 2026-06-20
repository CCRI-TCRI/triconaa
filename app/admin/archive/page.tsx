"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Archive, Save, Trash2, Trophy, ChevronDown } from "lucide-react"
import { archiveDb, getPositionsWithCandidates, voteDb, userDb, electionControl, type ElectionArchive } from "@/lib/db"
import { toast } from "sonner"

export default function ArchivePage() {
  const [archives, setArchives] = useState<ElectionArchive[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [open, setOpen] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setArchives(await archiveDb.list())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const archiveNow = async () => {
    setSaving(true)
    try {
      const [positions, votes, users, ctl] = await Promise.all([
        getPositionsWithCandidates(), voteDb.getAll(), userDb.getAll(), electionControl.get(),
      ])
      const snapshot = {
        generatedAt: new Date().toISOString(),
        positions: positions.map((p) => {
          const pv = votes.filter((v) => v.position_id === p.id)
          const candidates = p.candidates
            .map((c) => ({ name: c.full_name, votes: pv.filter((v) => v.candidate_id === c.id).length }))
            .sort((a, b) => b.votes - a.votes)
          return { name: p.name, total: pv.length, candidates, winner: candidates[0]?.votes ? candidates[0].name : null }
        }),
      }
      const voted = users.filter((u) => u.has_voted).length
      const turnout = users.length ? Math.round((voted / users.length) * 100) : 0
      const finalTitle = title.trim() || `${ctl.term} — ${new Date().toLocaleDateString()}`
      const ok = await archiveDb.create(finalTitle, ctl.term, snapshot, votes.length, turnout)
      if (!ok) { toast.error("Could not archive — run the database migration first"); return }
      toast.success("Election archived")
      setTitle("")
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (await archiveDb.remove(id)) { toast.success("Archive deleted"); load() }
    else toast.error("Could not delete")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><Archive className="h-6 w-6" /> Elections Archive</h1>
        <p className="text-muted-foreground">Save a snapshot of the current results to compare turnout and winners year over year.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Archive current results</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Prefects 2026) — optional" />
          </div>
          <Button onClick={archiveNow} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Archive now"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{archives.length} archived election{archives.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            : archives.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No archives yet.</p>
            : archives.map((a) => (
              <div key={a.id} className="rounded-lg border dark:border-white/10">
                <div className="flex items-center justify-between gap-3 p-3">
                  <button onClick={() => setOpen(open === a.id ? null : a.id)} className="flex min-w-0 items-center gap-2 text-left">
                    <ChevronDown className={`h-4 w-4 flex-none transition ${open === a.id ? "rotate-180" : ""}`} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </button>
                  <div className="flex flex-none items-center gap-2">
                    <Badge variant="secondary" className="bg-sky-100 text-sky-700">{a.turnout ?? 0}% turnout</Badge>
                    <Badge variant="secondary">{(a.total_votes ?? 0).toLocaleString()} votes</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this archive?</AlertDialogTitle>
                          <AlertDialogDescription>"{a.title}" will be permanently removed.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(a.id)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {open === a.id && (
                  <div className="space-y-1.5 border-t p-3 dark:border-white/10">
                    {(a.snapshot?.positions || []).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          {p.winner ? <><Trophy className="h-3.5 w-3.5 text-amber-500" /> {p.winner}</> : "—"}
                          <span className="text-xs text-muted-foreground">({p.total} votes)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
