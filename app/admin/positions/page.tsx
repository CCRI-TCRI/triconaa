"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { positionDb, candidateDb } from "@/lib/db"
import type { Position } from "@/lib/db"
import { Briefcase, Plus, Edit, Trash2, ArrowUp, ArrowDown, RefreshCw, CheckCircle2, EyeOff } from "lucide-react"

const COMMON_CATEGORIES = ["Senior Prefects", "Games & Sports", "Entertainment", "Academics", "Health & Sanitation", "Discipline", "General"]

const EMPTY = { name: "", category: "", description: "", is_active: true }

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    fetchPositions()
  }, [])

  const fetchPositions = async () => {
    setLoading(true)
    try {
      const [pos, cands] = await Promise.all([positionDb.getAll(), candidateDb.getAll()])
      setPositions(pos)
      const c: Record<string, number> = {}
      for (const cand of cands) c[cand.position_id] = (c[cand.position_id] || 0) + 1
      setCounts(c)
    } catch (error) {
      console.error("Error fetching positions:", error)
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setForm(EMPTY)
    setShowAdd(true)
  }

  const openEdit = (p: Position) => {
    setEditing(p)
    setForm({ name: p.name, category: p.category, description: p.description || "", is_active: p.is_active })
  }

  const addPosition = async () => {
    if (!form.name.trim() || !form.category.trim()) {
      toast({ title: "Missing fields", description: "Name and category are required.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const display_order = positions.length > 0 ? Math.max(...positions.map((p) => p.display_order)) + 1 : 1
      const created = await positionDb.create({
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        display_order,
        is_active: form.is_active,
      })
      if (!created) throw new Error("create failed")
      toast({ title: "Position added", description: `“${created.name}” was created.` })
      setShowAdd(false)
      setForm(EMPTY)
      fetchPositions()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to add position.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!form.name.trim() || !form.category.trim()) {
      toast({ title: "Missing fields", description: "Name and category are required.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const updated = await positionDb.update(editing.id, {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        is_active: form.is_active,
      })
      if (!updated) throw new Error("update failed")
      toast({ title: "Saved", description: "Position updated." })
      setEditing(null)
      fetchPositions()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to update position.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: Position) => {
    setSaving(true)
    try {
      await positionDb.update(p.id, { is_active: !p.is_active })
      setPositions((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)))
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const removePosition = async (p: Position) => {
    setSaving(true)
    try {
      await positionDb.delete(p.id)
      toast({ title: "Deleted", description: `“${p.name}” was removed.` })
      fetchPositions()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to delete position.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const sorted = [...positions].sort((a, b) => a.display_order - b.display_order)
    const target = index + dir
    if (target < 0 || target >= sorted.length) return
    const a = sorted[index]
    const b = sorted[target]
    setSaving(true)
    try {
      await Promise.all([
        positionDb.update(a.id, { display_order: b.display_order }),
        positionDb.update(b.id, { display_order: a.display_order }),
      ])
      fetchPositions()
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...positions].sort((a, b) => a.display_order - b.display_order)
  const activeCount = positions.filter((p) => p.is_active).length

  const FormFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="pos-name">Position Name</Label>
        <Input
          id="pos-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Head Prefect"
        />
      </div>
      <div>
        <Label htmlFor="pos-category">Category</Label>
        <Input
          id="pos-category"
          list="category-suggestions"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="e.g. Senior Prefects"
        />
        <datalist id="category-suggestions">
          {COMMON_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <Label htmlFor="pos-desc">Description</Label>
        <Textarea
          id="pos-desc"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Short description of the role"
          rows={3}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="pos-active" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        <Label htmlFor="pos-active">Active (appears on the ballot)</Label>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0f1f] via-[#7a1f2b] to-[#3b0a14] p-6 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Briefcase className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Positions</h1>
              <p className="text-sm text-rose-100/80">Create and manage the posts students vote for</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchPositions} variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="gap-2 bg-amber-400 font-semibold text-rose-950 hover:bg-amber-300">
                  <Plus className="h-4 w-4" />Add Position
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Position</DialogTitle>
                </DialogHeader>
                {FormFields}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={addPosition} disabled={saving} className="bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]">
                    {saving ? "Saving…" : "Add Position"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
            <Briefcase className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{positions.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <EyeOff className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-gray-500">{positions.length - activeCount}</div></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Positions</CardTitle>
          <CardDescription>{positions.length} positions · drag order with the arrows</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-rose-700" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p>No positions yet. Click “Add Position” to create your first one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Candidates</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-sm font-medium text-muted-foreground">{i + 1}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0 || saving} onClick={() => move(i, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === sorted.length - 1 || saving} onClick={() => move(i, 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      {p.description && <p className="max-w-xs truncate text-xs text-muted-foreground">{p.description}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-rose-200 text-rose-700">{p.category}</Badge></TableCell>
                    <TableCell className="text-center">{counts[p.id] || 0}</TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => toggleActive(p)} disabled={saving}>
                        <Badge className={p.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-100"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} disabled={saving} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={saving} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete position</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete “{p.name}”? This also removes its candidates and votes. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removePosition(p)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {FormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
