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
import { toast } from "@/hooks/use-toast"
import { candidateDb, positionDb } from "@/lib/db"
import type { Candidate, Position } from "@/lib/db"
import { UserPlus, Trash2, Edit, RefreshCw, Search } from "lucide-react"

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

  const classes = ["S1A", "S1B", "S2A", "S2B", "S3A", "S3B", "S4A", "S4B", "S5A", "S5B", "S6A", "S6B"]

  // Resize an uploaded photo to a compact square-ish PNG data URL stored in photo_url
  const resizeImage = (file: File, max = 400): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
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
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handlePhoto = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" })
      return
    }
    try {
      apply(await resizeImage(file))
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
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0], (url) => setNewCandidate((p) => ({ ...p, photo_url: url })))} />
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
          <CardTitle>Candidates</CardTitle>
          <CardDescription>{filtered.length} of {candidates.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead><TableHead>Full Name</TableHead><TableHead>Class</TableHead>
                <TableHead>Position</TableHead><TableHead>Votes</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((candidate) => (
                <TableRow key={candidate.id}>
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
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0], (url) => setEditingCandidate({ ...editingCandidate, photo_url: url }))} />
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
