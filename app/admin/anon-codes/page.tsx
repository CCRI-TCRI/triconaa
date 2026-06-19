"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { KeyRound, Lock, Printer, Sparkles, ListChecks, Loader2 } from "lucide-react"
import { electionControl, createAnonymousVoters, userDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { toast } from "sonner"

interface CodeRow { student_id: string; voting_code: string; full_name: string }

export default function AnonCodesPage() {
  const { schoolName } = useSchoolBranding()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState("40")
  const [prefix, setPrefix] = useState("Voter")
  const [codes, setCodes] = useState<CodeRow[]>([])

  useEffect(() => {
    (async () => {
      const { anonCodesEnabled } = await electionControl.get()
      setEnabled(anonCodesEnabled)
      setLoading(false)
    })()
  }, [])

  const toggle = async (on: boolean) => {
    setToggling(true)
    setEnabled(on)
    const ok = await electionControl.setAnonCodesEnabled(on)
    setToggling(false)
    if (!ok) { setEnabled(!on); toast.error("Could not update the setting"); return }
    toast.success(on ? "Anonymous voting codes enabled" : "Anonymous voting codes disabled")
  }

  const generate = async () => {
    const n = Math.min(1000, Math.max(1, parseInt(count) || 0))
    if (n < 1) { toast.error("Enter how many codes to create"); return }
    setGenerating(true)
    try {
      const created = await createAnonymousVoters(n, prefix.trim() || "Voter")
      setCodes((prev) => [...created, ...prev])
      toast.success(`Generated ${created.length} voting code${created.length === 1 ? "" : "s"}`)
    } catch {
      toast.error("Failed to generate codes")
    } finally {
      setGenerating(false)
    }
  }

  const loadExisting = async () => {
    const all = await userDb.getAll()
    const anon = all.filter((u: any) => u.is_anonymous).map((u: any) => ({ student_id: u.student_id, voting_code: u.voting_code, full_name: u.full_name }))
    setCodes(anon)
    toast.success(`Loaded ${anon.length} existing anonymous code${anon.length === 1 ? "" : "s"}`)
  }

  const printCodes = async () => {
    if (codes.length === 0) { toast.error("No codes to print yet"); return }
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const cols = 3, rows = 8, margin = 28
    const cardW = (pageW - 2 * margin) / cols
    const cardH = (pageH - 2 * margin) / rows
    const perPage = cols * rows
    codes.forEach((c, i) => {
      const idx = i % perPage
      if (i > 0 && idx === 0) doc.addPage()
      const col = idx % cols, row = Math.floor(idx / cols)
      const x = margin + col * cardW, y = margin + row * cardH
      doc.setDrawColor(205); doc.setLineDashPattern([3, 2], 0)
      doc.roundedRect(x + 3, y + 3, cardW - 6, cardH - 6, 6, 6)
      doc.setLineDashPattern([], 0)
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(120)
      doc.text(schoolName.toUpperCase(), x + cardW / 2, y + 18, { align: "center", maxWidth: cardW - 18 })
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(150)
      doc.text("OFFICIAL VOTING CODE", x + cardW / 2, y + cardH / 2 - 8, { align: "center" })
      doc.setFont("courier", "bold"); doc.setFontSize(17); doc.setTextColor(20)
      doc.text(c.voting_code, x + cardW / 2, y + cardH / 2 + 12, { align: "center" })
      doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(160)
      doc.text("Keep private · one vote per code", x + cardW / 2, y + cardH - 12, { align: "center" })
    })
    doc.save(`voting-codes-${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`Prepared ${codes.length} code${codes.length === 1 ? "" : "s"} for printing`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><KeyRound className="h-6 w-6" /> Anonymous Voting Codes</h1>
        <p className="text-muted-foreground">Generate voting codes that aren't tied to any student name, then print and hand them out so people can simply vote.</p>
      </div>

      {/* Master enable toggle — the rest of the page stays locked until this is on */}
      <Card className={enabled ? "border-emerald-200" : "border-amber-200"}>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {enabled ? <Sparkles className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Enable anonymous voting codes</p>
              <p className="text-sm text-muted-foreground">
                {enabled ? "On — you can generate and print anonymous codes below." : "Off — turn this on to unlock the code generator."}
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={loading || toggling} aria-label="Enable anonymous voting codes" />
        </CardContent>
      </Card>

      {/* Generator — disabled & dimmed until enabled */}
      <div className="relative">
        {!enabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-50/70 backdrop-blur-[1px] dark:bg-slate-950/60">
            <div className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              <Lock className="h-4 w-4" /> Toggle the switch above to unlock
            </div>
          </div>
        )}
        <div className={enabled ? "" : "pointer-events-none select-none opacity-50"}>
          <Card>
            <CardHeader><CardTitle>Generate codes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>How many codes?</Label>
                  <Input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <div>
                  <Label>Label prefix</Label>
                  <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. Voter" />
                  <p className="mt-1 text-xs text-muted-foreground">Internal label only (e.g. "Voter 1"). The code is what people use to vote.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate
                </Button>
                <Button onClick={loadExisting} variant="outline" className="gap-2"><ListChecks className="h-4 w-4" /> Load existing</Button>
                <Button onClick={printCodes} variant="outline" disabled={codes.length === 0} className="gap-2"><Printer className="h-4 w-4" /> Print codes (PDF)</Button>
              </div>
            </CardContent>
          </Card>

          {codes.length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle>{codes.length} code{codes.length === 1 ? "" : "s"} ready</CardTitle></CardHeader>
              <CardContent>
                <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                  {codes.map((c) => (
                    <div key={c.student_id} className="rounded-lg border p-2 text-center dark:border-white/10">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{c.voting_code}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.full_name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
