"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { positionStorage, candidateStorage, voteStorage, userStorage, getPositionsWithCandidates } from "@/lib/local-storage"
import { Download, FileText, Calendar, Users, Vote } from "lucide-react"

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)

  const generateReport = async (type: string) => {
    if (typeof window === "undefined") return
    
    setLoading(true)
    try {
      let csvContent = ""
      let filename = ""

      switch (type) {
        case "summary":
          csvContent = await generateSummaryReport()
          filename = `election-summary-${new Date().toISOString().split("T")[0]}.csv`
          break
        case "detailed":
          csvContent = await generateDetailedReport()
          filename = `election-detailed-${new Date().toISOString().split("T")[0]}.csv`
          break
        case "voters":
          csvContent = await generateVotersReport()
          filename = `voters-report-${new Date().toISOString().split("T")[0]}.csv`
          break
        case "candidates":
          csvContent = await generateCandidatesReport()
          filename = `candidates-report-${new Date().toISOString().split("T")[0]}.csv`
          break
      }

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateSummaryReport = async () => {
    const positionsWithCandidates = getPositionsWithCandidates()
    const votes = voteStorage.getAll()

    const header = ["Position", "Total Candidates", "Total Votes", "Winner", "Winner Votes"].join(",")
    const rows = []

    for (const position of positionsWithCandidates) {
      const positionVotes = votes.filter((v) => v.position_id === position.id)
      const candidateVotes = position.candidates.map((candidate) => ({
        ...candidate,
        voteCount: votes.filter((v) => v.candidate_id === candidate.id).length,
      }))

      const winner = candidateVotes.sort((a, b) => b.voteCount - a.voteCount)[0]

      rows.push(
        [
          position.name,
          position.candidates.length,
          positionVotes.length,
          winner?.full_name || "No candidates",
          winner?.voteCount || 0,
        ].join(","),
      )
    }

    return [header, ...rows].join("\n")
  }

  const generateDetailedReport = async () => {
    const votes = voteStorage.getAll()
    const users = userStorage.getAll()
    const candidates = candidateStorage.getAll()
    const positions = positionStorage.getAll()

    const header = ["Vote ID", "Voter Token", "Voter Name", "Candidate Name", "Position", "Vote Time"].join(",")
    const rows = votes.map((vote) => {
      const user = users.find((u) => u.id === vote.user_id)
      const candidate = candidates.find((c) => c.id === vote.candidate_id)
      const position = positions.find((p) => p.id === vote.position_id)

      return [
        vote.id,
        user?.token || "Unknown",
        user?.full_name || "Unknown",
        candidate?.full_name || "Unknown",
        position?.name || "Unknown",
        new Date(vote.created_at).toLocaleString(),
      ].join(",")
    })

    return [header, ...rows].join("\n")
  }

  const generateVotersReport = async () => {
    const users = userStorage.getAll()

    const header = ["Token", "Full Name", "Class", "Has Voted", "Voted At"].join(",")
    const rows = users.map((user) =>
      [
        user.token,
        user.full_name,
        user.class || "N/A",
        user.has_voted ? "Yes" : "No",
        user.voted_at || "N/A",
      ].join(","),
    )

    return [header, ...rows].join("\n")
  }

  const generateCandidatesReport = async () => {
    const candidates = candidateStorage.getAll()
    const positions = positionStorage.getAll()
    const votes = voteStorage.getAll()

    const header = ["Student ID", "Full Name", "Class", "Position", "Vote Count", "Manifesto"].join(",")
    const rows = candidates.map((candidate) => {
      const position = positions.find((p) => p.id === candidate.position_id)
      const voteCount = votes.filter((v) => v.candidate_id === candidate.id).length

      return [
        candidate.student_id,
        candidate.full_name,
        candidate.class,
        position?.name || "Unknown",
        voteCount,
        `"${(candidate.manifesto || "").replace(/"/g, '""')}"`,
      ].join(",")
    })

    return [header, ...rows].join("\n")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and download election reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => generateReport("summary")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Summary Report
            </CardTitle>
            <CardDescription>Overview of all positions and results</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => generateReport("detailed")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Vote className="w-5 h-5" />
              Detailed Report
            </CardTitle>
            <CardDescription>Individual vote records and details</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => generateReport("voters")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Voters Report
            </CardTitle>
            <CardDescription>Complete voter list and status</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => generateReport("candidates")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Candidates Report
            </CardTitle>
            <CardDescription>All candidates and their information</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
