"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { UserCog, UserPlus, Shield, Gavel, GraduationCap, Trash2, KeyRound } from "lucide-react"
import { accountDb, electionsDb, type AdminAccount, type AdminRole, type Election } from "@/lib/db"
import { toast } from "sonner"

const ROLE_META: Record<AdminRole, { label: string; desc: string; icon: typeof Shield; cls: string }> = {
  admin: { label: "Administrator", desc: "Full control of the entire system", icon: Shield, cls: "bg-rose-100 text-rose-700" },
  chairperson: { label: "Electoral Commission", desc: "Manages candidates & positions, views results", icon: Gavel, cls: "bg-blue-100 text-blue-700" },
  headteacher: { label: "Head Teacher", desc: "Read-only: results, analytics, reports, live coverage", icon: GraduationCap, cls: "bg-emerald-100 text-emerald-700" },
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ username: "", password: "", role: "headteacher" as AdminRole, full_name: "", securityQuestion: "", securityAnswer: "", electionId: "" })

  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [editForm, setEditForm] = useState({ password: "", role: "headteacher" as AdminRole, full_name: "", securityQuestion: "", securityAnswer: "", electionId: "" })
  const [elections, setElections] = useState<Election[]>([])
  const electionName = (id?: string | null) => elections.find((e) => e.id === id)?.name

  const load = async () => {
    setLoading(true)
    const [accs, els] = await Promise.all([accountDb.list(), electionsDb.list()])
    setAccounts(accs)
    setElections(els)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const adminCount = accounts.filter((a) => a.role === "admin").length

  const addAccount = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      toast.error("Username and password are required")
      return
    }
    setSaving(true)
    const created = await accountDb.create({ ...form, electionId: form.role === "admin" ? null : form.electionId || null })
    setSaving(false)
    if (!created) { toast.error("Could not create account — the username may already exist"); return }
    toast.success(`Account "${created.username}" created`)
    setForm({ username: "", password: "", role: "headteacher", full_name: "", securityQuestion: "", securityAnswer: "", electionId: "" })
    setAddOpen(false)
    load()
  }

  const openEdit = (a: AdminAccount) => {
    setEditing(a)
    setEditForm({ password: "", role: a.role, full_name: a.full_name || "", securityQuestion: "", securityAnswer: "", electionId: a.election_id || "" })
  }

  const saveEdit = async () => {
    if (!editing) return
    if (editing.role === "admin" && editForm.role !== "admin" && adminCount <= 1) {
      toast.error("There must be at least one administrator")
      return
    }
    setSaving(true)
    const ok = await accountDb.update(editing.id, {
      password: editForm.password || undefined,
      role: editForm.role,
      full_name: editForm.full_name,
      securityQuestion: editForm.securityQuestion || undefined,
      securityAnswer: editForm.securityAnswer || undefined,
      electionId: editForm.role === "admin" ? null : editForm.electionId || null,
    })
    setSaving(false)
    if (!ok) { toast.error("Could not update account"); return }
    toast.success("Account updated")
    setEditing(null)
    load()
  }

  const removeAccount = async (a: AdminAccount) => {
    if (a.role === "admin" && adminCount <= 1) {
      toast.error("You can't delete the last administrator")
      return
    }
    const ok = await accountDb.remove(a.id)
    if (!ok) { toast.error("Could not delete account"); return }
    toast.success(`Account "${a.username}" deleted`)
    load()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><UserCog className="h-6 w-6" /> Accounts</h1>
          <p className="text-muted-foreground">Create and manage administrator, electoral commission and head teacher logins.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> New account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Jane Doe" /></div>
              <div><Label>Username *</Label><Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="used to sign in" /></div>
              <div><Label>Password *</Label><Input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="set a password" /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as AdminRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_META) as AdminRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{ROLE_META[form.role].desc}</p>
              </div>
              {form.role !== "admin" && elections.length > 0 && (
                <div>
                  <Label>Election (this account only sees this one)</Label>
                  <Select value={form.electionId} onValueChange={(v) => setForm((p) => ({ ...p, electionId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select an election" /></SelectTrigger>
                    <SelectContent>{elections.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Security question (for password reset)</Label><Input value={form.securityQuestion} onChange={(e) => setForm((p) => ({ ...p, securityQuestion: e.target.value }))} placeholder="e.g. Your first school?" /></div>
              <div><Label>Security answer</Label><Input value={form.securityAnswer} onChange={(e) => setForm((p) => ({ ...p, securityAnswer: e.target.value }))} /></div>
              <Button onClick={addAccount} disabled={saving} className="w-full">{saving ? "Creating…" : "Create account"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All accounts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No accounts yet.</p>
          ) : accounts.map((a) => {
            const meta = ROLE_META[a.role]
            const Icon = meta.icon
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${meta.cls}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{a.full_name || a.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{a.username}{a.election_id && electionName(a.election_id) ? ` · ${electionName(a.election_id)}` : ""}</p>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <Badge variant="secondary" className={meta.cls}>{meta.label}</Badge>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(a)}><KeyRound className="h-3.5 w-3.5" /> Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                        <AlertDialogDescription>"{a.username}" ({meta.label}) will no longer be able to sign in. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeAccount(a)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>New password</Label><Input value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="leave blank to keep current" /></div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v as AdminRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_META) as AdminRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_META[editForm.role].desc}</p>
            </div>
            {editForm.role !== "admin" && elections.length > 0 && (
              <div>
                <Label>Election</Label>
                <Select value={editForm.electionId} onValueChange={(v) => setEditForm((p) => ({ ...p, electionId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select an election" /></SelectTrigger>
                  <SelectContent>{elections.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Security question</Label><Input value={editForm.securityQuestion} onChange={(e) => setEditForm((p) => ({ ...p, securityQuestion: e.target.value }))} placeholder="leave blank to keep current" /></div>
            <div><Label>Security answer</Label><Input value={editForm.securityAnswer} onChange={(e) => setEditForm((p) => ({ ...p, securityAnswer: e.target.value }))} placeholder="leave blank to keep current" /></div>
            <Button onClick={saveEdit} disabled={saving} className="w-full">{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
