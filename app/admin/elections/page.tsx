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
import { Textarea } from "@/components/ui/textarea"
import { Vote, Plus, Link2, Check, Layers, Trash2, Copy, Palette, ImagePlus, X } from "lucide-react"
import { electionsDb, getCurrentElectionId, setCurrentElectionId, scopingAvailable, type Election } from "@/lib/db"
import { toast } from "sonner"

// Resize an image file to a compact data URL for storage.
const resizeImage = (file: File, max: number, mime = "image/jpeg", quality = 0.72): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > max) { height = Math.round((height * max) / width); width = max }
        else if (height > max) { width = Math.round((width * max) / height); height = max }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL(mime, quality))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", organization: "", term: "" })
  const [current, setCurrent] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")

  // Per-election branding editor
  const [brandFor, setBrandFor] = useState<Election | null>(null)
  const [brand, setBrand] = useState({ motto: "", logo_url: "", login_subtitle: "", login_welcome: "", images: [] as string[] })
  const [brandSaving, setBrandSaving] = useState(false)

  const openBranding = (e: Election) => {
    setBrandFor(e)
    let images: string[] = []
    try { const a = JSON.parse(e.login_bg_images || "[]"); if (Array.isArray(a)) images = a } catch { /* ignore */ }
    setBrand({ motto: e.motto || "", logo_url: e.logo_url || "", login_subtitle: e.login_subtitle || "", login_welcome: e.login_welcome || "", images })
  }
  const addImages = async (files: FileList | null) => {
    if (!files) return
    const added: string[] = []
    for (const f of Array.from(files).slice(0, 8)) {
      try { added.push(await resizeImage(f, 1280)) } catch { /* skip */ }
    }
    setBrand((p) => ({ ...p, images: [...p.images, ...added].slice(0, 8) }))
  }
  const setLogo = async (file?: File) => {
    if (!file) return
    try { setBrand((p) => ({ ...p, logo_url: "" })); const url = await resizeImage(file, 256, "image/png", 0.92); setBrand((p) => ({ ...p, logo_url: url })) } catch { /* ignore */ }
  }
  const saveBranding = async () => {
    if (!brandFor) return
    setBrandSaving(true)
    const ok = await electionsDb.update(brandFor.id, {
      motto: brand.motto || null,
      logo_url: brand.logo_url || null,
      login_subtitle: brand.login_subtitle || null,
      login_welcome: brand.login_welcome || null,
      login_bg_images: JSON.stringify(brand.images),
    })
    setBrandSaving(false)
    if (!ok) { toast.error("Could not save branding"); return }
    toast.success("Login look updated")
    setBrandFor(null)
    load()
  }

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
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openBranding(e)}><Palette className="h-3.5 w-3.5" /> Edit look</Button>
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

      {/* Per-election login branding editor */}
      <Dialog open={!!brandFor} onOpenChange={(o) => !o && setBrandFor(null)}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Login look — {brandFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Customise what voters see on this election's <span className="font-mono">/e/{brandFor?.slug}</span> page.</p>

            <div>
              <Label>Logo</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                  {brand.logo_url ? <img src={brand.logo_url} alt="logo" className="h-full w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                </div>
                <label className="cursor-pointer">
                  <div className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Upload logo</div>
                  <input type="file" accept="image/*,.cr2" className="hidden" onChange={(e) => setLogo(e.target.files?.[0])} />
                </label>
              </div>
            </div>

            <div><Label>Heading line (subtitle under the name)</Label><Input value={brand.login_subtitle} onChange={(e) => setBrand((p) => ({ ...p, login_subtitle: e.target.value }))} placeholder="e.g. Prefect Elections 2026" /></div>
            <div><Label>Motto</Label><Input value={brand.motto} onChange={(e) => setBrand((p) => ({ ...p, motto: e.target.value }))} placeholder="e.g. Excellence & Integrity" /></div>
            <div><Label>Welcome message</Label><Textarea rows={3} value={brand.login_welcome} onChange={(e) => setBrand((p) => ({ ...p, login_welcome: e.target.value }))} placeholder="Welcome text shown on the sign-in card" /></div>

            <div>
              <Label>Background slideshow images</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {brand.images.map((src, i) => (
                  <div key={i} className="group relative aspect-video overflow-hidden rounded-md ring-1 ring-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setBrand((p) => ({ ...p, images: p.images.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {brand.images.length < 8 && (
                  <label className="flex aspect-video cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted">
                    <ImagePlus className="h-5 w-5" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
                  </label>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Up to 8 images — they fade through behind the login.</p>
            </div>

            <Button onClick={saveBranding} disabled={brandSaving} className="w-full">{brandSaving ? "Saving…" : "Save login look"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
