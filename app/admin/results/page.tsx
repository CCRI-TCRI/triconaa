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
      const maroon: [number, number, number] = [122, 31, 43]
      const gold: [number, number, number] = [245, 200, 66]
      const headerH = 92
      const generatedAt = new Date().toLocaleString()

      const logo = await loadLogo()
      const totalCandidates = results.reduce((s, r) => s + r.candidates.length, 0)

      const drawHeader = () => {
        doc.setFillColor(...maroon)
        doc.rect(0, 0, pageW, headerH, "F")
        doc.setFillColor(...gold)
        doc.rect(0, headerH, pageW, 3, "F")

        let textX = 40
        if (logo) {
          const box = 58
          const cx = 40 + box / 2
          const cy = headerH / 2
          doc.setFillColor(255, 255, 255)
          doc.circle(cx, cy, box / 2 + 3, "F")
          const ratio = logo.w / logo.h
          let w = box
          let h = box
          if (ratio > 1) h = box / ratio
          else w = box * ratio
          doc.addImage(logo.data, logo.fmt, cx - w / 2, cy - h / 2, w, h)
          textX = 40 + box + 16
        }
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(15)
        doc.text(schoolName.toUpperCase(), textX, 34)
        doc.setFont("helvetica", "italic")
        doc.setFontSize(9)
        doc.setTextColor(...gold)
        doc.text(`"${motto}"`, textX, 50)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(11)
        doc.setTextColor(255, 255, 255)
        doc.text("Official Election Results", textX, 70)
        doc.setFontSize(8)
        doc.setTextColor(255, 230, 230)
        doc.text(`Generated: ${generatedAt}`, pageW - 40, 34, { align: "right" })
      }

      const drawFooter = (page: number, total: number) => {
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`${schoolName} · Royal Ballot Election System`, 40, pageH - 24)
        doc.text(`Page ${page} of ${total}`, pageW - 40, pageH - 24, { align: "right" })
      }

      // Summary block (drawn once, below the header on page 1)
      const drawSummary = () => {
        const top = headerH + 22
        const boxW = (pageW - 80 - 24) / 3
        const stats = [
          { label: "Registered Voters", value: String(totalVoters) },
          { label: "Votes Cast", value: String(totalVotes) },
          { label: "Voter Turnout", value: `${turnout.toFixed(1)}%` },
        ]
        stats.forEach((s, i) => {
          const x = 40 + i * (boxW + 12)
          doc.setFillColor(250, 244, 246)
          doc.roundedRect(x, top, boxW, 52, 6, 6, "F")
          doc.setDrawColor(230, 210, 215)
          doc.roundedRect(x, top, boxW, 52, 6, 6, "S")
          doc.setTextColor(120, 120, 120)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.text(s.label.toUpperCase(), x + 12, top + 18)
          doc.setTextColor(...maroon)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(20)
          doc.text(s.value, x + 12, top + 42)
        })

        // turnout progress bar
        const barY = top + 66
        const barW = pageW - 80
        doc.setTextColor(90, 90, 90)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("Voter Turnout", 40, barY)
        doc.text(`${votedCount} / ${totalVoters} voted`, pageW - 40, barY, { align: "right" })
        doc.setFillColor(235, 228, 230)
        doc.roundedRect(40, barY + 6, barW, 12, 6, 6, "F")
        doc.setFillColor(...maroon)
        const fillW = Math.max(2, (barW * turnout) / 100)
        doc.roundedRect(40, barY + 6, fillW, 12, 6, 6, "F")

        doc.setTextColor(120, 120, 120)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.text(`${results.length} positions · ${totalCandidates} candidates`, 40, barY + 36)
        return barY + 48 // bottom y
      }

      // Build a single grouped table: a position header row, then its candidates
      const body: any[] = []
      const winnerRows = new Set<number>()
      results.forEach((pos) => {
        body.push([
          {
            content: `${pos.position_name.toUpperCase()}   ·   ${pos.category}   ·   ${pos.total_votes} vote${pos.total_votes === 1 ? "" : "s"}`,
            colSpan: 4,
            styles: { fillColor: maroon, textColor: 255, fontStyle: "bold", fontSize: 10, halign: "left", cellPadding: 6 },
          },
        ])
        if (pos.candidates.length === 0) {
          body.push([{ content: "No candidates registered", colSpan: 4, styles: { textColor: [150, 150, 150], halign: "center", fontStyle: "italic" } }])
          return
        }
        pos.candidates.forEach((c, i) => {
          const isWinner = i === 0 && c.vote_count > 0
          if (isWinner) winnerRows.add(body.length)
          body.push([
            isWinner ? "WINNER" : String(i + 1),
            c.full_name + (c.class ? `  (${c.class})` : ""),
            String(c.vote_count),
            `${c.percentage.toFixed(1)}%`,
          ])
        })
      })

      const summaryBottom = drawSummary()

      autoTable(doc, {
        head: [["#", "Candidate", "Votes", "Share"]],
        body,
        startY: summaryBottom + 12,
        margin: { top: headerH + 16, left: 40, right: 40, bottom: 40 },
        styles: { fontSize: 10, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fillColor: [60, 10, 20], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 60, halign: "center" },
          2: { cellWidth: 70, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 70, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && winnerRows.has(data.row.index)) {
            data.cell.styles.fillColor = [255, 247, 224]
            data.cell.styles.textColor = [122, 31, 43]
            data.cell.styles.fontStyle = "bold"
          }
        },
        didDrawPage: () => {
          drawHeader()
        },
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
