"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Users2, Trash2, ChevronUp, ChevronDown, Tv, Plus } from "lucide-react"
import { broadcastSlidesDb, positionDb, type BroadcastSlide, type Position } from "@/lib/db"
import { toast } from "sonner"

const uid = () => Math.random().toString(36).slice(2, 9)

export default function SlidesPage() {
  const [slides, setSlides] = useState<BroadcastSlide[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ title: "", subtitle: "" })
  const [h2hPos, setH2hPos] = useState("")

  const load = async () => {
    setLoading(true)
    const [s, p] = await Promise.all([broadcastSlidesDb.get(), positionDb.getAll()])
    setSlides(s)
    setPositions(p)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const persist = async (next: BroadcastSlide[]) => {
    setSlides(next)
    const ok = await broadcastSlidesDb.set(next)
    if (ok) toast.success("Broadcast slides updated — live now")
    else toast.error("Could not save — run the migration first")
  }

  const addMessage = () => {
    if (!msg.title.trim()) { toast.error("Enter a message title"); return }
    persist([...slides, { id: uid(), type: "message", title: msg.title.trim(), subtitle: msg.subtitle.trim() }])
    setMsg({ title: "", subtitle: "" })
  }
  const addHead2Head = () => {
    if (!h2hPos) { toast.error("Pick a position"); return }
    persist([...slides, { id: uid(), type: "head2head", positionId: h2hPos }])
    setH2hPos("")
  }
  const remove = (id: string) => persist(slides.filter((s) => s.id !== id))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= slides.length) return
    const next = [...slides]; ;[next[i], next[j]] = [next[j], next[i]]; persist(next)
  }
  const posName = (id?: string) => positions.find((p) => p.id === id)?.name || "—"

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><Tv className="h-6 w-6" /> Broadcast Slides</h1>
        <p className="text-muted-foreground">Add custom slides to the Live Coverage rotation — they appear instantly, no reload.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Message slide */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-sky-600" /> Message slide</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Headline *</Label><Input value={msg.title} onChange={(e) => setMsg((p) => ({ ...p, title: e.target.value }))} placeholder="Thank You For Being Great Polling Assistants" /></div>
            <div><Label>Subtitle</Label><Textarea rows={2} value={msg.subtitle} onChange={(e) => setMsg((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Optional supporting line" /></div>
            <Button onClick={addMessage} className="w-full gap-2"><Plus className="h-4 w-4" /> Add message slide</Button>
          </CardContent>
        </Card>

        {/* Head-to-head slide */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users2 className="h-4 w-4 text-rose-600" /> Head-to-head slide</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Show a position's top two candidates side by side (blue vs red) — great for close races. Live vote data.</p>
            <div>
              <Label>Position</Label>
              <Select value={h2hPos} onValueChange={setH2hPos}>
                <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={addHead2Head} className="w-full gap-2"><Plus className="h-4 w-4" /> Add head-to-head slide</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{slides.length} custom slide{slides.length === 1 ? "" : "s"} in rotation</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            : slides.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No custom slides yet. They'll play after the positions and turnout slide.</p>
            : slides.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${s.type === "message" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>
                    {s.type === "message" ? <MessageSquare className="h-4 w-4" /> : <Users2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{s.type === "message" ? s.title : `Head-to-head · ${posName(s.positionId)}`}</p>
                    {s.type === "message" && s.subtitle && <p className="truncate text-xs text-muted-foreground">{s.subtitle}</p>}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === slides.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
