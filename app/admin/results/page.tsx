"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Trophy, Users, Vote, Crown, TrendingUp, FileDown, RefreshCw, Award } from "lucide-react"

interface ResultData {
  position_name: string
  category: string
  candidates: { id: string; full_name: string; photo_url?: string; class?: string; vote_count: number; percentage: number }[]
  total_votes: number
}

export default function ResultsPage() {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
  const [results, setResults] = useState<ResultData[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [totalVoters, setTotalVoters] = useState(0)
  const [votedCount, setVotedCount] = useState(0)
  const [turnout, setTurnout] = useState(0)

  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchResults = async () => {
    try {
      const [positionsWithCandidates, votes, users] = await Promise.all([
        getPositionsWithCandidates(),
        voteDb.getAll(),
        userDb.getAll(),
      ])

      const resultsData: ResultData[] = positionsWithCandidates.map((position) => {
        const positionVotes = votes.filter((v) => v.position_id === position.id)
        const total = positionVotes.length
        const candidatesWithVotes = position.candidates
          .map((candidate) => {
            const count = positionVotes.filter((v) => v.candidate_id === candidate.id).length
            return {
              id: candidate.id,
              full_name: candidate.full_name,
              photo_url: candidate.photo_url,
              class: candidate.class,
              vote_count: count,
              percentage: total > 0 ? (count / total) * 100 : 0,
            }
          })
          .sort((a, b) => b.vote_count - a.vote_count)

        return {
          position_name: position.name,
          category: position.category,
          candidates: candidatesWithVotes,
          total_votes: total,
        }
      })

      const voted = users.filter((u) => u.has_voted).length
      setResults(resultsData)
      setTotalVotes(votes.length)
      setTotalVoters(users.length)
      setVotedCount(voted)
      setTurnout(users.length > 0 ? (voted / users.length) * 100 : 0)
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  // ── Designed results PDF ─────────────────────────────────────
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

  const exportResultsPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const M = 48 // page margin
      const maroon: [number, number, number] = [122, 31, 43]
      const ink: [number, number, number] = [33, 37, 41]
      const muted: [number, number, number] = [120, 120, 120]
      const line: [number, number, number] = [210, 200, 202]
      const headerBottom = 96
      const generatedAt = new Date().toLocaleString()

      const logo = await loadLogo()
      const totalCandidates = results.reduce((s, r) => s + r.candidates.length, 0)

      // ── Letterhead (every page) ──────────────────────────────
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
        doc.text("OFFICIAL ELECTION RESULTS", pageW - M, 42, { align: "right" })
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...muted)
        doc.text(generatedAt, pageW - M, 56, { align: "right" })

        // rule
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

      // ── Summary panel (page 1) ───────────────────────────────
      const drawSummary = () => {
        const top = headerBottom + 6
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        doc.setTextColor(...ink)
        doc.text("Results Summary", M, top + 4)

        const boxTop = top + 14
        const panelW = pageW - M * 2
        const colW = panelW / 3
        const stats = [
          { label: "Registered Voters", value: String(totalVoters) },
          { label: "Votes Cast", value: String(totalVotes) },
          { label: "Voter Turnout", value: `${turnout.toFixed(1)}%` },
        ]
        doc.setDrawColor(...line)
        doc.setLineWidth(0.8)
        doc.roundedRect(M, boxTop, panelW, 58, 4, 4, "S")
        stats.forEach((s, i) => {
          const x = M + i * colW
          if (i > 0) {
            doc.setDrawColor(...line)
            doc.setLineWidth(0.5)
            doc.line(x, boxTop + 10, x, boxTop + 48)
          }
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.setTextColor(...muted)
          doc.text(s.label.toUpperCase(), x + 16, boxTop + 24)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(20)
          doc.setTextColor(...maroon)
          doc.text(s.value, x + 16, boxTop + 46)
        })

        // turnout bar
        const barY = boxTop + 74
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...muted)
        doc.text(`Turnout — ${votedCount} of ${totalVoters} students voted`, M, barY)
        doc.text(`${results.length} positions · ${totalCandidates} candidates`, pageW - M, barY, { align: "right" })
        const barW = panelW
        doc.setFillColor(236, 230, 231)
        doc.roundedRect(M, barY + 6, barW, 9, 4, 4, "F")
        doc.setFillColor(...maroon)
        doc.roundedRect(M, barY + 6, Math.max(2, (barW * turnout) / 100), 9, 4, 4, "F")
        return barY + 28
      }

      // ── Grouped results table ────────────────────────────────
      const body: any[] = []
      const winnerRows = new Set<number>()
      results.forEach((pos) => {
        body.push([
          {
            content: `${pos.position_name.toUpperCase()}    ${pos.category} · ${pos.total_votes} vote${pos.total_votes === 1 ? "" : "s"}`,
            colSpan: 4,
            styles: { fillColor: maroon, textColor: 255, fontStyle: "bold", fontSize: 9.5, halign: "left", cellPadding: 5 },
          },
        ])
        if (pos.candidates.length === 0) {
          body.push([{ content: "No candidates registered", colSpan: 4, styles: { textColor: muted, halign: "center", fontStyle: "italic" } }])
          return
        }
        pos.candidates.forEach((c, i) => {
          const isWinner = i === 0 && c.vote_count > 0
          if (isWinner) winnerRows.add(body.length)
          body.push([
            isWinner ? "WIN" : String(i + 1),
            c.full_name + (c.class ? `   ${c.class}` : ""),
            String(c.vote_count),
            `${c.percentage.toFixed(1)}%`,
          ])
        })
      })

      const summaryBottom = drawSummary()

      autoTable(doc, {
        head: [["#", "Candidate", "Votes", "Share"]],
        body,
        theme: "grid",
        startY: summaryBottom,
        margin: { top: headerBottom, left: M, right: M, bottom: 46 },
        styles: { fontSize: 9.5, cellPadding: 6, lineColor: line, lineWidth: 0.5, textColor: ink },
        headStyles: { fillColor: [245, 240, 241], textColor: maroon, fontStyle: "bold", lineColor: line, lineWidth: 0.5 },
        alternateRowStyles: { fillColor: [250, 249, 249] },
        columnStyles: {
          0: { cellWidth: 50, halign: "center", textColor: muted },
          2: { cellWidth: 72, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 72, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && winnerRows.has(data.row.index)) {
            data.cell.styles.fillColor = [255, 248, 230]
            data.cell.styles.textColor = maroon
            data.cell.styles.fontStyle = "bold"
          }
        },
        didDrawPage: () => {
          drawHeader()
        },
      })

      // ── Declaration / sign-off ───────────────────────────────
      let y = (doc as any).lastAutoTable.finalY + 34
      if (y + 120 > pageH - 50) {
        doc.addPage()
        drawHeader()
        y = headerBottom + 10
      }
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(...maroon)
      doc.text("RESULT DECLARATION", M, y)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...ink)
      doc.text(
        "We certify that the figures above are a true and accurate tally of the votes cast in this election.",
        M,
        y + 16,
        { maxWidth: pageW - M * 2 },
      )

      const sigY = y + 64
      const colGap = 40
      const sigW = (pageW - M * 2 - colGap) / 2
      ;[
        { label: "Returning Officer", x: M },
        { label: "Witness", x: M + sigW + colGap },
      ].forEach((s) => {
        doc.setDrawColor(...ink)
        doc.setLineWidth(0.6)
        doc.line(s.x, sigY, s.x + sigW, sigY)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...muted)
        doc.text(`${s.label} — Name & Signature`, s.x, sigY + 12)
        // date line
        doc.line(s.x, sigY + 36, s.x + sigW, sigY + 36)
        doc.text("Date", s.x, sigY + 48)
      })

      const pageCount = (doc as any).getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        drawFooter(i, pageCount)
      }

      doc.save(`election-results-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      console.error("Error exporting results PDF:", error)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-700"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0f1f] via-[#7a1f2b] to-[#3b0a14] p-6 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-amber-300/40">
              <img src={logoUrl} alt={schoolName} className="h-11 w-11 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Election Results</h1>
              <p className="text-sm text-rose-100/80">{schoolName} · official tally</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchResults} variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
            <Button onClick={exportResultsPDF} disabled={exporting || results.length === 0} className="gap-2 bg-amber-400 font-semibold text-rose-950 hover:bg-amber-300">
              {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes Cast</CardTitle>
            <Vote className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalVotes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Voters</CardTitle>
            <Users className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalVoters}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voter Turnout</CardTitle>
            <TrendingUp className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turnout.toFixed(1)}%</div>
            <Progress value={turnout} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">{votedCount} of {totalVoters} students voted</p>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="space-y-6">
        {results.map((position, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-rose-50 to-amber-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-rose-900">
                    <Crown className="w-5 h-5 text-rose-700" />{position.position_name}
                  </CardTitle>
                  <CardDescription>{position.category} • {position.total_votes} votes cast</CardDescription>
                </div>
                <Badge variant="outline" className="border-rose-200 text-rose-700">{position.candidates.length} candidates</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {position.candidates.map((candidate, ci) => {
                  const isWinner = ci === 0 && candidate.vote_count > 0
                  return (
                    <div
                      key={candidate.id}
                      className={`flex items-center gap-4 rounded-lg p-3 ${isWinner ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}
                    >
                      <div className="flex w-8 items-center justify-center">
                        {isWinner ? <Award className="h-5 w-5 text-amber-500" /> : <span className="text-sm font-medium text-muted-foreground">#{ci + 1}</span>}
                      </div>
                      <Avatar className={isWinner ? "ring-2 ring-amber-400" : ""}>
                        <AvatarImage src={candidate.photo_url || "/placeholder.svg"} alt={candidate.full_name} />
                        <AvatarFallback className="bg-rose-100 text-rose-800">
                          {candidate.full_name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{candidate.full_name}</p>
                          {candidate.class && <span className="text-xs text-muted-foreground">{candidate.class}</span>}
                          {isWinner && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Winner</Badge>}
                        </div>
                        <div className="mt-1 flex items-center gap-4">
                          <Progress value={candidate.percentage} className="flex-1" />
                          <div className="min-w-[80px] text-right">
                            <p className="font-bold">{candidate.vote_count} votes</p>
                            <p className="text-sm text-muted-foreground">{candidate.percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {position.candidates.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No candidates registered for this position</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No election data available. Add positions and candidates first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
