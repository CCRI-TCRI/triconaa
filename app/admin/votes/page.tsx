"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { voteDb, userDb, candidateDb, positionDb } from "@/lib/db"
import { Search, Vote, Clock, CheckCircle } from "lucide-react"

interface VoteRecord {
  id: string
  voter_name: string
  voter_code: string
  candidate_name: string
  candidate_photo?: string
  position_name: string
  vote_time: string
}

export default function VotesPage() {
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [positionFilter, setPositionFilter] = useState("all")
  const [positions, setPositions] = useState<string[]>([])

  useEffect(() => {
    fetchVotes()
  }, [])

  const fetchVotes = async () => {
    try {
      const [votesData, users, candidates, positionsData] = await Promise.all([
        voteDb.getAll(),
        userDb.getAll(),
        candidateDb.getAll(),
        positionDb.getAll(),
      ])

      const formattedVotes: VoteRecord[] = votesData.map((vote) => {
        const user = users.find((u) => u.id === vote.user_id)
        const candidate = candidates.find((c) => c.id === vote.candidate_id)
        const position = positionsData.find((p) => p.id === vote.position_id)

        return {
          id: vote.id,
          voter_name: user?.full_name || "Unknown",
          voter_code: user?.voting_code || "Unknown",
          candidate_name: candidate?.full_name || "Unknown",
          candidate_photo: candidate?.photo_url,
          position_name: position?.name || "Unknown",
          vote_time: vote.created_at,
        }
      })

      setVotes(formattedVotes)
      setPositions([...new Set(formattedVotes.map((v) => v.position_name))])
    } catch (error) {
      console.error("Error fetching votes:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVotes = votes.filter((vote) => {
    const matchesSearch =
      vote.voter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vote.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vote.voter_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPosition = positionFilter === "all" || vote.position_name === positionFilter
    return matchesSearch && matchesPosition
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const recentVotesCount = votes.filter((v) => {
    const voteTime = new Date(v.vote_time)
    return voteTime > new Date(Date.now() - 60 * 60 * 1000)
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vote Management</h1>
        <p className="text-muted-foreground">Monitor and verify individual votes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{votes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Votes</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{votes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Votes (1h)</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{recentVotesCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="search" placeholder="Search by voter, candidate, or code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div>
              <Label htmlFor="position-filter">Position</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positions.map((position) => (
                    <SelectItem key={position} value={position}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vote Records</CardTitle>
          <CardDescription>{filteredVotes.length} of {votes.length} votes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVotes.map((vote) => (
                <TableRow key={vote.id}>
                  <TableCell className="font-medium">{vote.voter_name}</TableCell>
                  <TableCell><Badge variant="outline">{vote.voter_code}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>{vote.candidate_name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <span>{vote.candidate_name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{vote.position_name}</Badge></TableCell>
                  <TableCell>{new Date(vote.vote_time).toLocaleString()}</TableCell>
                  <TableCell><Badge>Verified</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredVotes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No votes found matching your criteria</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
