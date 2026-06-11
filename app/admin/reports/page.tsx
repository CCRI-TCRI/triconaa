"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { positionDb, candidateDb, voteDb, userDb, getPositionsWithCandidates } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { FileText, Users, Vote, UserSquare, FileDown, Eye, Loader2, X, CalendarRange } from "lucide-react"
import { extractLogoColor } from "@/lib/pdf-logo-color"

interface ReportSpec {
  title: string
  filenameBase: string
  head: string[]
  body: any[]
  intro?: string[]
  columnStyles?: Record<number, any>
  statusCol?: number // column index whose Voted/Yes value is coloured green
  chart?: { title: string; data: { label: string; value: number }[] }
}

export default function ReportsPage() {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")
  const [filename, setFilename] = useState("report.pdf")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const docRef = useRef<any>(null)

  // ── Report data builders ─────────────────────────────────────
  const buildSummary = async (): Promise<ReportSpec> => {
    const [positions, votes, users] = await Promise.all([
      getPositionsWithCandidates(),
      voteDb.getAll(),
      userDb.getAll(),
    ])
    const voted = users.filter((u) => u.has_voted).length
    const chartData: { label: string; value: number }[] = []
    const body = positions.map((position) => {
      const positionVotes = votes.filter((v) => v.position_id === position.id)
      const ranked = position.candidates
        .map((c) => ({ name: c.full_name, count: positionVotes.filter((v) => v.candidate_id === c.id).length }))
        .sort((a, b) => b.count - a.count)
      const winner = ranked[0]
      chartData.push({ label: position.name, value: positionVotes.length })
      return [
        position.name,
        position.category,
        String(position.candidates.length),
        String(positionVotes.length),
        winner && winner.count > 0 ? winner.name : "—",
        winner ? String(winner.count) : "0",
      ]
    })
    return {
      title: "Election Summary Report",
      filenameBase: "election-summary",
      intro: [
        `Total positions: ${positions.length}`,
        `Total votes cast: ${votes.length}`,
        `Turnout: ${users.length > 0 ? ((voted / users.length) * 100).toFixed(1) : "0"}%  (${voted}/${users.length})`,
      ],
      chart: { title: "Votes by Position", data: chartData },
      head: ["Position", "Category", "Cand.", "Votes", "Winner", "Winner Votes"],
      body,
      columnStyles: { 2: { halign: "center", cellWidth: 42 }, 3: { halign: "center", cellWidth: 48 }, 5: { halign: "center", cellWidth: 70 } },
    }
  }

  const buildDetailed = async (): Promise<ReportSpec> => {
    const [votes, users, candidates, positions] = await Promise.all([
      voteDb.getAll(),
      userDb.getAll(),
      candidateDb.getAll(),
      positionDb.getAll(),
    ])
    const userMap = new Map(users.map((u) => [u.id, u]))
    const candMap = new Map(candidates.map((c) => [c.id, c.full_name]))
    const posMap = new Map(positions.map((p) => [p.id, p.name]))

    const from = fromDate ? new Date(fromDate).getTime() : null
    const to = toDate ? new Date(toDate).getTime() : null
    const filtered = votes.filter((v) => {
      const t = new Date(v.created_at).getTime()
      if (from != null && t < from) return false
      if (to != null && t > to) return false
      return true
    })

    const body = filtered.map((vote, i) => [
      String(i + 1),
      userMap.get(vote.user_id)?.voting_code || "—",
      userMap.get(vote.user_id)?.full_name || "Unknown",
      candMap.get(vote.candidate_id) || "Unknown",
      posMap.get(vote.position_id) || "Unknown",
      new Date(vote.created_at).toLocaleString(),
    ])

    const intro = [`Vote records: ${filtered.length}${filtered.length !== votes.length ? ` (of ${votes.length} total)` : ""}`]
    if (from != null || to != null) {
      intro.push(
        `Range: ${from != null ? new Date(from).toLocaleString() : "start"} → ${to != null ? new Date(to).toLocaleString() : "now"}`,
      )
    }

    return {
      title: "Detailed Vote Records",
      filenameBase: "election-detailed",
      intro,
      head: ["#", "Voter Code", "Voter Name", "Candidate", "Position", "Time"],
      body,
      columnStyles: { 0: { cellWidth: 32, halign: "center" }, 1: { cellWidth: 70 } },
    }
  }

  const buildVoters = async (): Promise<ReportSpec> => {
    const users = await userDb.getAll()
    const voted = users.filter((u) => u.has_voted).length
    const body = users.map((u, i) => [
      String(i + 1),
      u.voting_code,
      u.full_name,
      u.class || "N/A",
      u.has_voted ? "Voted" : "Pending",
      u.voted_at ? new Date(u.voted_at).toLocaleString() : "—",
    ])
    return {
      title: "Registered Voters Report",
      filenameBase: "voters-report",
      intro: [`Total voters: ${users.length}`, `Voted: ${voted}`, `Pending: ${users.length - voted}`],
      head: ["#", "Voting Code", "Full Name", "Class", "Status", "Voted At"],
      body,
      columnStyles: { 0: { cellWidth: 32, halign: "center" }, 3: { halign: "center", cellWidth: 50 }, 4: { halign: "center", cellWidth: 60 } },
      statusCol: 4,
    }
  }

  const buildCandidates = async (): Promise<ReportSpec> => {
    const [candidates, positions, votes] = await Promise.all([
      candidateDb.getAll(),
      positionDb.getAll(),
      voteDb.getAll(),
    ])
    const posMap = new Map(positions.map((p) => [p.id, p.name]))
    const body = candidates
      .map((c) => ({
        sid: c.student_id,
        name: c.full_name,
        cls: c.class,
        pos: posMap.get(c.position_id) || "Unknown",
        votes: votes.filter((v) => v.candidate_id === c.id).length,
      }))
      .sort((a, b) => b.votes - a.votes)
      .map((c, i) => [String(i + 1), c.sid, c.name, c.cls, c.pos, String(c.votes)])
    return {
      title: "Candidates Report",
      filenameBase: "candidates-report",
      intro: [`Total candidates: ${candidates.length}`],
      head: ["#", "Student ID", "Full Name", "Class", "Position", "Votes"],
      body,
      columnStyles: { 0: { cellWidth: 32, halign: "center" }, 3: { halign: "center", cellWidth: 50 }, 5: { halign: "center", cellWidth: 50 } },
    }
  }

  // ── Shared logo loader ───────────────────────────────────────
  const loadLogo = async (): Promise<{ data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null> => {
    try {
      let data = logoUrl
      let mime = "image/png"
      if (!logoUrl.startsWith("data:")) {
        const res = await fetch(logoUrl)
        const blob = await res.blob()
        mime = blob.type
        data = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(fr.result as string)
          fr.onerror = reject
          fr.readAsDataURL(blob)
        })
      } else {
        mime = logoUrl.substring(5, logoUrl.indexOf(";")) || "image/png"
      }
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 })
        img.onerror = () => resolve({ w: 100, h: 100 })
        img.src = data
      })
      return { data, fmt: mime.includes("png") ? "PNG" : "JPEG", w: dims.w, h: dims.h }
    } catch {
      return null
    }
  }

  // ── PDF builder (professional letterhead) ────────────────────
  const buildDoc = async (spec: ReportSpec) => {
    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const M = 48
    const ink: [number, number, number] = [33, 37, 41]
    const muted: [number, number, number] = [120, 120, 120]
    const line: [number, number, number] = [210, 210, 215]
    const headerBottom = 96
    const generatedAt = new Date().toLocaleString()
    const logo = await loadLogo()
    const maroon: [number, number, number] = logo ? await extractLogoColor(logo.data) : [22, 138, 173]

    const drawHeader = () => {
      if (logo) {
        const box = 50
        const ratio = logo.w / logo.h
        let w = box
        let h = box
        if (ratio > 1) h = box / ratio
        else w = box * ratio
        doc.addImage(logo.data, logo.fmt, M, 28, w, h)
      }
      const tx = M + 62
      doc.setTextColor(...maroon)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(15)
      doc.text(schoolName, tx, 44)
      doc.setFont("helvetica", "italic")
      doc.setFontSize(9)
      doc.setTextColor(...muted)
      doc.text(`"${motto}"`, tx, 58)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(...maroon)
      doc.text(spec.title.toUpperCase(), pageW - M, 42, { align: "right" })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...muted)
      doc.text(generatedAt, pageW - M, 56, { align: "right" })
      doc.setDrawColor(...maroon)
      doc.setLineWidth(1.2)
      doc.line(M, 74, pageW - M, 74)
      doc.setDrawColor(245, 200, 66)
      doc.setLineWidth(0.6)
      doc.line(M, 77, pageW - M, 77)
    }

    const drawFooter = (page: number, total: number) => {
      doc.setDrawColor(...line)
      doc.setLineWidth(0.5)
      doc.line(M, pageH - 34, pageW - M, pageH - 34)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...muted)
      doc.text(`${schoolName} · Royal Ballot Election System`, M, pageH - 22)
      doc.text("CONFIDENTIAL", pageW / 2, pageH - 22, { align: "center" })
      doc.text(`Page ${page} of ${total}`, pageW - M, pageH - 22, { align: "right" })
    }

    let startY = headerBottom + 8
    // Title + intro stats
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...ink)
    doc.text(spec.title, M, startY)
    startY += 6
    if (spec.intro?.length) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...muted)
      spec.intro.forEach((linex) => {
        startY += 14
        doc.text(linex, M, startY)
      })
    }
    startY += 18

    // Optional horizontal bar chart
    if (spec.chart && spec.chart.data.length) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(...ink)
      doc.text(spec.chart.title, M, startY)
      startY += 12
      const data = spec.chart.data.slice(0, 10)
      const max = Math.max(1, ...data.map((d) => d.value))
      const labelW = 130
      const valW = 36
      const barMaxW = pageW - M * 2 - labelW - valW
      const rowH = 15
      data.forEach((d) => {
        const y = startY
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...ink)
        const label = d.label.length > 28 ? d.label.slice(0, 26) + "…" : d.label
        doc.text(label, M, y + 8)
        doc.setFillColor(236, 230, 231)
        doc.roundedRect(M + labelW, y, barMaxW, 9, 2, 2, "F")
        const w = Math.max(2, (barMaxW * d.value) / max)
        doc.setFillColor(...maroon)
        doc.roundedRect(M + labelW, y, w, 9, 2, 2, "F")
        doc.setTextColor(...muted)
        doc.text(String(d.value), M + labelW + barMaxW + 6, y + 8)
        startY += rowH
      })
      startY += 16
    }

    autoTable(doc, {
      head: [spec.head],
      body: spec.body.length ? spec.body : [[{ content: "No data available", colSpan: spec.head.length, styles: { halign: "center", textColor: muted, fontStyle: "italic" } }]],
      theme: "grid",
      startY,
      margin: { top: headerBottom, left: M, right: M, bottom: 44 },
      styles: { fontSize: 9, cellPadding: 5, lineColor: line, lineWidth: 0.5, textColor: ink, overflow: "linebreak" },
      headStyles: { fillColor: maroon, textColor: 255, fontStyle: "bold", lineColor: maroon },
      alternateRowStyles: { fillColor: [250, 249, 249] },
      columnStyles: spec.columnStyles || {},
      didParseCell: (data) => {
        if (spec.statusCol != null && data.section === "body" && data.column.index === spec.statusCol) {
          data.cell.styles.textColor = data.cell.raw === "Voted" ? [22, 130, 70] : [180, 120, 0]
          data.cell.styles.fontStyle = "bold"
        }
      },
      didDrawPage: () => drawHeader(),
    })

    const pageCount = (doc as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      drawFooter(i, pageCount)
    }
    return doc
  }

  // ── Generate + preview ───────────────────────────────────────
  const openPreview = async (type: string) => {
    setLoadingType(type)
    try {
      const spec = await (type === "summary"
        ? buildSummary()
        : type === "detailed"
          ? buildDetailed()
          : type === "voters"
            ? buildVoters()
            : buildCandidates())
      const doc = await buildDoc(spec)
      docRef.current = doc
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = doc.output("bloburl") as unknown as string
      setPreviewUrl(url)
      setPreviewTitle(spec.title)
      setFilename(`${spec.filenameBase}-${new Date().toISOString().split("T")[0]}.pdf`)
      setPreviewOpen(true)
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setLoadingType(null)
    }
  }

  const downloadPdf = () => {
    if (docRef.current) docRef.current.save(filename)
  }

  const closePreview = () => {
    setPreviewOpen(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const reports = [
    { type: "summary", title: "Summary Report", desc: "Overview of all positions and winners", icon: FileText },
    { type: "detailed", title: "Detailed Report", desc: "Individual vote records and details", icon: Vote },
    { type: "voters", title: "Voters Report", desc: "Complete voter list and status", icon: Users },
    { type: "candidates", title: "Candidates Report", desc: "All candidates and their vote counts", icon: UserSquare },
  ]

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0f1f] via-[#7a1f2b] to-[#3b0a14] p-6 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-amber-300/40">
            <img src={logoUrl} alt={schoolName} className="h-11 w-11 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reports</h1>
            <p className="text-sm text-rose-100/80">{schoolName} · generate designed PDF reports</p>
          </div>
        </div>
      </div>

      {/* Detailed report date filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-rose-700" />
            Detailed report filter <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </CardTitle>
          <CardDescription>Limit the Detailed Report to votes cast within a time range.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input id="from" type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input id="to" type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFromDate("")
              setToDate("")
            }}
            disabled={!fromDate && !toDate}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <Card key={r.type} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                  <r.icon className="h-5 w-5" />
                </span>
                {r.title}
              </CardTitle>
              <CardDescription>{r.desc}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                onClick={() => openPreview(r.type)}
                disabled={loadingType !== null}
                className="w-full bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]"
              >
                {loadingType === r.type ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview &amp; Export
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PDF preview dialog */}
      <Dialog open={previewOpen} onOpenChange={(o) => (o ? setPreviewOpen(true) : closePreview())}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-rose-700" />
              {previewTitle} — Preview
            </DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] w-full overflow-hidden rounded-lg border bg-slate-100">
            {previewUrl && <iframe src={previewUrl} title="PDF preview" className="h-full w-full" />}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closePreview}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
            <Button onClick={downloadPdf} className="bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]">
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
