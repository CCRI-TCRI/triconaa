"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Vote, Plus, Link2, Check, Layers, Trash2, Copy } from "lucide-react"
import { electionsDb, getCurrentElectionId, setCurrentElectionId, scopingAvailable, type Election } from "@/lib/db"
import { toast } from "sonner"

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", organization: "", term: "" })
  const [current, setCurrent] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")

  const load = async () => {
    setLoading(true)
    const ok = await scopingAvailable()
    setAvailable(ok)
    setElections(await electionsDb.list())
    setCurrent(getCurrentElectionId())
    setLoading(false)
  }
  useEffect(() => { load(); if (typeof window !== "undefined") setOrigin(window.location.origin) }, [])

  const add = async () => {
    if (!form.name.trim()) { toast.error("Give the election a name"); return }
    setSaving(true)
    const created = await electionsDb.create(form)
    setSaving(false)
    if (!created) { toast.error("Could not create — run the migration first"); return }
    toast.success(`Election "${created.name}" created`)
    setForm({ name: "", organization: "", term: "" })
    setAddOpen(false)
    load()
  }

  const useElection = (id: string | null) => {
    setCurrentElectionId(id)
    setCurrent(id)
    toast.success(id ? "Now managing this election" : "Viewing all elections")
  }

  const remove = async (e: Election) => {
    if (await electionsDb.remove(e.id)) {
      if (current === e.id) useElection(null)
      toast.success(`Deleted "${e.name}"`); load()
    } else toast.error("Could not delete")
  }

  const copyLink = (slug: string) => {
    navigator.clipboard?.writeText(`${origin}/e/${slug}`).then(() => toast.success("Link copied"))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><Layers className="h-6 w-6" /> Elections</h1>
          <p className="text-muted-foreground">Run several independent elections — each school/company gets its own voting link.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New election</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create election</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Election name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. St Mary's Prefects 2026" /></div>
              <div><Label>Organisation</Label><Input value={form.organization} onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))} placeholder="School / company name" /></div>
              <div><Label>Term</Label><Input value={form.term} onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))} placeholder="e.g. 2026 term" /></div>
              <Button onClick={add} disabled={saving} className="w-full">{saving ? "Creating…" : "Create election"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!available && (
        <Card className="border-amber-300">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
            The multi-election database tables aren't set up yet. Run the migration SQL (it adds the <code>elections</code> table and an <code>election_id</code> on voters/candidates/positions/votes), then refresh.
          </CardContent>
        </Card>
      )}

      {/* Scope switcher */}
      <Card>
        <CardHeader><CardTitle className="text-base">Currently managing</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant={current === null ? "default" : "outline"} size="sm" onClick={() => useElection(null)} className="gap-1.5">
            {current === null && <Check className="h-3.5 w-3.5" />} All / primary
          </Button>
          {elections.map((e) => (
            <Button key={e.id} variant={current === e.id ? "default" : "outline"} size="sm" onClick={() => useElection(e.id)} className="gap-1.5">
              {current === e.id && <Check className="h-3.5 w-3.5" />} {e.name}
            </Button>
          ))}
          <p className="w-full text-xs text-muted-foreground">Candidates, Positions, Voters and Results pages show the election selected here.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{elections.length} election{elections.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            : elections.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No extra elections yet. Your existing data lives in the primary election.</p>
            : elections.map((e) => (
              <div key={e.id} className="rounded-lg border p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <Vote className="h-4 w-4 text-sky-600" /> {e.name}
                      {current === e.id && <Badge className="bg-sky-600">managing</Badge>}
                    </p>
                    {e.organization && <p className="text-xs text-muted-foreground">{e.organization}{e.term ? ` · ${e.term}` : ""}</p>}
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => useElection(e.id)}>Manage</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{e.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>This removes the election. Its voters, candidates and votes are not deleted automatically — reassign or clear them first.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(e)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                  <Link2 className="h-4 w-4 flex-none text-slate-400" />
                  <span className="truncate font-mono text-xs text-slate-600 dark:text-slate-300">{origin}/e/{e.slug}</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1.5" onClick={() => copyLink(e.slug)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
