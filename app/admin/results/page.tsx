"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getPositionsWithCandidates, voteDb, userDb } from "@/lib/db"
import { Trophy, Users, Vote, Crown, TrendingUp } from "lucide-react"

interface ResultData {
  position_name: string
  category: string
  candidates: { id: string; full_name: string; photo_url?: string; vote_count: number; percentage: number }[]
  total_votes: number
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVotes, setTotalVotes] = useState(0)
  const [totalVoters, setTotalVoters] = useState(0)
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
        const totalVotesForPosition = positionVotes.length

        const candidatesWithVotes = position.candidates.map((candidate) => ({
          ...candidate,
          vote_count: candidate.vote_count,
          percentage: totalVotesForPosition > 0 ? (candidate.vote_count / totalVotesForPosition) * 100 : 0,
        }))

        return {
          position_name: position.name,
          category: position.category,
          candidates: candidatesWithVotes.sort((a, b) => b.vote_count - a.vote_count),
          total_votes: totalVotesForPosition,
        }
      })

      const votedCount = users.filter((u) => u.has_voted).length

      setResults(resultsData)
      setTotalVotes(votes.length)
      setTotalVoters(users.length)
      setTurnout(users.length > 0 ? (votedCount / users.length) * 100 : 0)
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Results</h1>
        <p className="text-muted-foreground">Real-time election results and statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes Cast</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalVotes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Voters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalVoters}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voter Turnout</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turnout.toFixed(1)}%</div>
            <Progress value={turnout} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {results.map((position, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5" />{position.position_name}
                  </CardTitle>
                  <CardDescription>{position.category} • {position.total_votes} votes cast</CardDescription>
                </div>
                <Badge variant="outline">{position.candidates.length} candidates</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {position.candidates.map((candidate, ci) => (
                  <div key={candidate.id} className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex items-center gap-2">
                        {ci === 0 && candidate.vote_count > 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                        <span className="text-sm font-medium text-muted-foreground">#{ci + 1}</span>
                      </div>
                      <Avatar>
                        <AvatarImage src={candidate.photo_url || "/placeholder.svg"} alt={candidate.full_name} />
                        <AvatarFallback>{candidate.full_name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{candidate.full_name}</p>
                        <div className="flex items-center gap-4">
                          <Progress value={candidate.percentage} className="flex-1" />
                          <div className="text-right min-w-[80px]">
                            <p className="font-bold">{candidate.vote_count} votes</p>
                            <p className="text-sm text-muted-foreground">{candidate.percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
