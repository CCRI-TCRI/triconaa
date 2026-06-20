"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { candidateDb, positionDb } from "@/lib/db"
import type { Candidate, Position } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { UserPlus, Trash2, Edit, RefreshCw, Search, Upload } from "lucide-react"

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [positionFilter, setPositionFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
  const [newCandidate, setNewCandidate] = useState({
    student_id: "", full_name: "", class: "", position_id: "", manifesto: "", photo_url: "",
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ full_name: string; class: string; position_id: string; positionName: string; manifesto: string; photo_url: string; valid: boolean; note?: string }[]>([])
  const [importing, setImporting] = useState(false)

  const rowsFromMatrix = (matrix: any[][]) => {
    const cleaned = matrix.map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c).trim())) : [])).filter((r) => r.some((c) => c !== ""))
    if (cleaned.length === 0) { setImportRows([]); return }
    const header = cleaned[0].map((h) => h.toLowerCase())
    const idx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)))
    const nameI = idx(["name", "candidate"]), classI = idx(["class", "stream", "form"]), posI = idx(["position", "post", "portfolio", "office"]), manI = idx(["manifesto", "slogan", "about"]), photoI = idx(["photo", "image", "picture", "url"])
    const hasHeader = nameI >= 0
    const dataRows = hasHeader ? cleaned.slice(1) : cleaned
    const posByName = new Map(positions.map((p) => [p.name.toLowerCase(), p.id]))
    const rows = dataRows.map((r) => {
      const full_name = (hasHeader ? r[nameI] : r[0]) || ""
      const cls = (hasHeader && classI >= 0 ? r[classI] : r[1]) || ""
      const posName = (hasHeader && posI >= 0 ? r[posI] : r[2]) || ""
      const manifesto = (hasHeader && manI >= 0 ? r[manI] : "") || ""
      const photo_url = (hasHeader && photoI >= 0 ? r[photoI] : "") || ""
      const position_id = posByName.get(posName.toLowerCase()) || ""
      const valid = !!full_name && !!position_id
      const note = !full_name ? "Missing name" : !position_id ? `Unknown position "${posName}"` : undefined
      return { full_name, class: cls, position_id, positionName: posName, manifesto, photo_url, valid, note }
    })
    setImportRows(rows)
  }

  const parseImportFile = async (file?: File) => {
    if (!file) return
    try {
      const XLSX = await import("xlsx")
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rowsFromMatrix(XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][])
    } catch {
      toast({ title: "Could not read file", description: "Use a .csv or .xlsx file.", variant: "destructive" })
    }
  }

  const commitImport = async () => {
    const valid = importRows.filter((r) => r.valid)
    if (valid.length === 0) { toast({ title: "Nothing to import", description: "No valid rows found.", variant: "destructive" }); return }
    setImporting(true)
    const payload = valid.map((r) => ({
      student_id: "CN" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      full_name: r.full_name,
      class: r.class || "—",
      position_id: r.position_id,
      manifesto: r.manifesto,
      photo_url: r.photo_url,
    }))
    const n = await candidateDb.createBatch(payload as any)
    setImporting(false)
    toast({ title: "Import complete", description: `${n} candidate${n === 1 ? "" : "s"} added.` })
    setShowImport(false); setImportRows([]); fetchData()
  }

  const classes = ["S1A", "S1B", "S2A", "S2B", "S3A", "S3B", "S4A", "S4B", "S5A", "S5B", "S6A", "S6B"]

  // Downscale any browser-decodable image (given as a data URL) to a compact JPEG data URL
  const downscaleDataUrl = (src: string, max = 400): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > max) { height = Math.round((height * max) / width); width = max }
        else if (height > max) { width = Math.round((width * max) / height); height = max }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = reject
      img.src = src
    })

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = ""
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    return btoa(binary)
  }

  // Canon CR2 (and most TIFF-based RAW files) embed full JPEG previews. Browsers can't
  // decode the RAW itself, so we pull out the largest embedded JPEG and use that.
  // JPEG byte-stuffing guarantees 0xFF 0xD9 only appears as a real EOI marker, so the
  // first EOI after each SOI is the true end of that JPEG.
  const extractEmbeddedJpeg = (buf: ArrayBuffer): string | null => {
    const bytes = new Uint8Array(buf)
    let best: { start: number; end: number } | null = null
    for (let i = 0; i + 1 < bytes.length; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
        for (let j = i + 2; j + 1 < bytes.length; j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            if (!best || j + 2 - i > best.end - best.start) best = { start: i, end: j + 2 }
            i = j + 1
            break
          }
        }
      }
    }
    if (!best) return null
    return "data:image/jpeg;base64," + bytesToBase64(bytes.subarray(best.start, best.end))
  }

  const handlePhoto = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return
    const isCr2 = /\.cr2$/i.test(file.name) || file.type === "image/x-canon-cr2"
    if (!isCr2 && !file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image or a Canon CR2 file.", variant: "destructive" })
      return
    }
    try {
      let src: string
      if (isCr2) {
        const jpeg = extractEmbeddedJpeg(await file.arrayBuffer())
        if (!jpeg) {
          toast({ title: "Couldn't read CR2", description: "No embedded preview found in that file.", variant: "destructive" })
          return
        }
        src = jpeg
      } else {
        src = await fileToDataUrl(file)
      }
      apply(await downscaleDataUrl(src))
    } catch {
      toast({ title: "Error", description: "Could not process that image.", variant: "destructive" })
    }
  }

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [candidatesData, positionsData] = await Promise.all([candidateDb.getAll(), positionDb.getActive()])
    setCandidates(candidatesData)
    setPositions(positionsData)
    setLoading(false)
  }

  const addCandidate = async () => {
    if (!newCandidate.student_id || !newCandidate.full_name || !newCandidate.class || !newCandidate.position_id) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }
    setSaving(true)
    const created = await candidateDb.create({
      student_id: newCandidate.student_id,
      full_name: newCandidate.full_name,
      class: newCandidate.class,
      position_id: newCandidate.position_id,
      manifesto: newCandidate.manifesto,
      photo_url: newCandidate.photo_url || undefined,
    })
    if (created) {
      setCandidates((prev) => [created, ...prev])
      setNewCandidate({ student_id: "", full_name: "", class: "", position_id: "", manifesto: "", photo_url: "" })
      setShowAddDialog(false)
      toast({ title: "Success", description: `${created.full_name} added successfully` })
    } else {
      toast({ title: "Error", description: "Failed to add candidate", variant: "destructive" })
    }
    setSaving(false)
  }

  const updateCandidate = async () => {
    if (!editingCandidate) return
    setSaving(true)
    const updated = await candidateDb.update(editingCandidate.id, {
      full_name: editingCandidate.full_name,
      class: editingCandidate.class,
      position_id: editingCandidate.position_id,
      manifesto: editingCandidate.manifesto,
      photo_url: editingCandidate.photo_url,
    })
    if (updated) {
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setShowEditDialog(false)
      toast({ title: "Success", description: "Candidate updated" })
    } else {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
    setSaving(false)
  }

  const deleteCandidate = async (id: string) => {
    setSaving(true)
    const ok = await candidateDb.delete(id)
    if (ok) {
      setCandidates((prev) => prev.filter((c) => c.id !== id))
      toast({ title: "Success", description: "Candidate deleted" })
    } else {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
    setSaving(false)
  }

  const filtered = candidates.filter((c) => {
    const s = c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || c.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    const p = positionFilter === "all" || c.position_id === positionFilter
    return s && p
  })

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id))

  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.id))
      else filtered.forEach((c) => next.add(c.id))
      return next
    })

  const deleteSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    setSaving(true)
    try {
      const { error } = await supabase.from("candidates").delete().in("id", ids)
      if (error) throw error
      setCandidates((prev) => prev.filter((c) => !ids.includes(c.id)))
      setSelected(new Set())
      toast({ title: "Success", description: `Deleted ${ids.length} candidate(s)` })
    } catch {
      toast({ title: "Error", description: "Failed to delete selected candidates", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const clearAllCandidates = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from("candidates").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      setCandidates([])
      setSelected(new Set())
      toast({ title: "Cleared", description: "All candidates deleted" })
    } catch {
      toast({ title: "Error", description: "Failed to clear candidates", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const getPositionName = (id: string) => positions.find((p) => p.id === id)?.name ?? "Unknown"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Candidate Management</h1>
          <p className="text-muted-foreground">Add and manage election candidates</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Dialog open={showImport} onOpenChange={(o) => { setShowImport(o); if (!o) setImportRows([]) }}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={positions.length === 0}><Upload className="w-4 h-4 mr-2" />Bulk Import</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Import candidates</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV or Excel file with columns: <b>Name</b>, <b>Class</b>, <b>Position</b> (must match an existing position name), and optionally <b>Manifesto</b> and <b>Photo URL</b>.
                </p>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => parseImportFile(e.target.files?.[0])} className="block w-full text-sm" />
                {importRows.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-emerald-600">{importRows.filter((r) => r.valid).length} ready</span>
                      <span className="text-rose-500">{importRows.filter((r) => !r.valid).length} skipped</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Class</th><th className="p-2 text-left">Position</th><th className="p-2 text-left">Status</th></tr></thead>
                        <tbody>
                          {importRows.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{r.full_name || <span className="text-rose-500">—</span>}</td>
                              <td className="p-2">{r.class}</td>
                              <td className="p-2">{r.positionName}</td>
                              <td className="p-2">{r.valid ? <span className="text-emerald-600">OK</span> : <span className="text-rose-500">{r.note}</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button onClick={commitImport} disabled={importing} className="w-full">{importing ? "Importing…" : `Import ${importRows.filter((r) => r.valid).length} candidates`}</Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button disabled={positions.length === 0}><UserPlus className="w-4 h-4 mr-2" />Add Candidate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Candidate</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Student ID *</Label><Input value={newCandidate.student_id} onChange={(e) => setNewCandidate((p) => ({ ...p, student_id: e.target.value.toUpperCase() }))} placeholder="e.g. LSS001" /></div>
                <div><Label>Full Name *</Label><Input value={newCandidate.full_name} onChange={(e) => setNewCandidate((p) => ({ ...p, full_name: e.target.value }))} /></div>
                <div>
                  <Label>Class *</Label>
                  <Input
                    list="class-options-add"
                    value={newCandidate.class}
                    onChange={(e) => setNewCandidate((p) => ({ ...p, class: e.target.value.toUpperCase() }))}
                    placeholder="e.g. S1A — or type a new class"
                  />
                  <datalist id="class-options-add">{classes.map((cls) => <option key={cls} value={cls} />)}</datalist>
                </div>
                <div>
                  <Label>Position *</Label>
                  <Select value={newCandidate.position_id} onValueChange={(v) => setNewCandidate((p) => ({ ...p, position_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>{positions.map((pos) => <SelectItem key={pos.id} value={pos.id}>{pos.name} ({pos.category})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Manifesto</Label><Textarea value={newCandidate.manifesto} onChange={(e) => setNewCandidate((p) => ({ ...p, manifesto: e.target.value }))} rows={3} /></div>
                <div>
                  <Label>Candidate Photo</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border">
                      {newCandidate.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={newCandidate.photo_url} alt="preview" className="h-full w-full object-cover" />
                      ) : (
                        <UserPlus className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <div className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Upload Photo</div>
                      <input type="file" accept="image/*,.cr2,image/x-canon-cr2" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0], (url) => setNewCandidate((p) => ({ ...p, photo_url: url })))} />
                    </label>
                    {newCandidate.photo_url && (
                      <Button variant="ghost" size="sm" onClick={() => setNewCandidate((p) => ({ ...p, photo_url: "" }))}>Remove</Button>
                    )}
                  </div>
                </div>
                <Button onClick={addCandidate} className="w-full" disabled={saving}>{saving ? "Adding..." : "Add Candidate"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {positions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          No active positions found. Run the schema SQL in Supabase → SQL Editor first.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Candidates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{candidates.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Positions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{positions.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{candidates.filter((c) => c.is_approved).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Name or student ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div>
              <Label>Position</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Candidates</CardTitle>
              <CardDescription>{filtered.length} of {candidates.length}</CardDescription>
            </div>
            <div className="flex gap-2">
              {selected.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={saving}>
                      <Trash2 className="w-4 h-4 mr-2" />Delete selected ({selected.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selected.size} candidate(s)?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete the selected candidates and all their votes.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteSelected} className="bg-red-600 hover:bg-red-700">Delete selected</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving || candidates.length === 0} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" />Clear All Candidates
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all candidates?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete ALL {candidates.length} candidates and all associated votes. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllCandidates} className="bg-red-600 hover:bg-red-700">Delete everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Student ID</TableHead><TableHead>Full Name</TableHead><TableHead>Class</TableHead>
                <TableHead>Position</TableHead><TableHead>Votes</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((candidate) => (
                <TableRow key={candidate.id} data-state={selected.has(candidate.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(candidate.id)} onCheckedChange={() => toggleSelect(candidate.id)} aria-label={`Select ${candidate.full_name}`} />
                  </TableCell>
                  <TableCell className="font-medium">{candidate.student_id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                        {candidate.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
                        ) : (
                          candidate.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")
                        )}
                      </div>
                      {candidate.full_name}
                    </div>
                  </TableCell>
                  <TableCell>{candidate.class}</TableCell>
                  <TableCell><Badge variant="outline">{getPositionName(candidate.position_id)}</Badge></TableCell>
                  <TableCell><Badge>{candidate.vote_count}</Badge></TableCell>
                  <TableCell><Badge variant={candidate.is_approved ? "default" : "secondary"}>{candidate.is_approved ? "Approved" : "Pending"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setEditingCandidate(candidate); setShowEditDialog(true) }} disabled={saving}><Edit className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={saving}><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
                            <AlertDialogDescription>Delete {candidate.full_name}? This also removes all their votes.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCandidate(candidate.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground">No candidates yet. Click "Add Candidate" to get started.</div>}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Candidate</DialogTitle></DialogHeader>
          {editingCandidate && (
            <div className="space-y-3">
              <div><Label>Student ID</Label><Input value={editingCandidate.student_id} disabled className="bg-gray-100" /></div>
              <div><Label>Full Name</Label><Input value={editingCandidate.full_name} onChange={(e) => setEditingCandidate({ ...editingCandidate, full_name: e.target.value })} /></div>
              <div>
                <Label>Class</Label>
                <Input
                  list="class-options-edit"
                  value={editingCandidate.class}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, class: e.target.value.toUpperCase() })}
                  placeholder="e.g. S1A — or type a new class"
                />
                <datalist id="class-options-edit">{classes.map((cls) => <option key={cls} value={cls} />)}</datalist>
              </div>
              <div>
                <Label>Position</Label>
                <Select value={editingCandidate.position_id} onValueChange={(v) => setEditingCandidate({ ...editingCandidate, position_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Manifesto</Label><Textarea value={editingCandidate.manifesto} onChange={(e) => setEditingCandidate({ ...editingCandidate, manifesto: e.target.value })} rows={3} /></div>
              <div>
                <Label>Candidate Photo</Label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border">
                    {editingCandidate.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editingCandidate.photo_url} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <div className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Upload Photo</div>
                    <input type="file" accept="image/*,.cr2,image/x-canon-cr2" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0], (url) => setEditingCandidate({ ...editingCandidate, photo_url: url }))} />
                  </label>
                  {editingCandidate.photo_url && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingCandidate({ ...editingCandidate, photo_url: "" })}>Remove</Button>
                  )}
                </div>
              </div>
              <Button onClick={updateCandidate} className="w-full" disabled={saving}>{saving ? "Updating..." : "Update Candidate"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
