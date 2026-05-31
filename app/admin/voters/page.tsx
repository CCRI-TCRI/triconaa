"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { supabase, getErrorMessage, isSupabaseConfigured } from "@/lib/supabase"
import {
    Users,
    UserPlus,
    Search,
    Download,
    Trash2,
    Eye,
    EyeOff,
    RefreshCw,
    BarChart3,
    CheckCircle,
    Clock,
    Key,
    Edit,
    AlertTriangle,
  } from "lucide-react"

interface Voter {
  id: string
  student_id: string
  full_name: string
  class: string
  voting_code: string
  has_voted: boolean
  created_at: string
  voted_at?: string
}

export default function VotersPage() {
  const [voters, setVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCodesDialog, setShowCodesDialog] = useState(false)
  const [showCodes, setShowCodes] = useState(false)
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null)
  const [newVoter, setNewVoter] = useState({
    student_id: "",
    full_name: "",
    class: "",
  })
  const [stats, setStats] = useState({
    total: 0,
    voted: 0,
    pending: 0,
    turnout: 0,
  })

  const classes = ["S1A", "S1B", "S2A", "S2B", "S3A", "S3B", "S4A", "S4B", "S5A", "S5B", "S6A", "S6B"]

  useEffect(() => {
    fetchVoters()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [voters])

  const fetchVoters = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })
      if (error) {
        console.error("Supabase error:", getErrorMessage(error))
        setVoters([])
      } else {
        setVoters(data || [])
      }
    } catch (error) {
      console.error("Error fetching voters:", error)
      setVoters([])
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const total = voters.length
    const voted = voters.filter((v) => v.has_voted).length
    const pending = total - voted
    const turnout = total > 0 ? (voted / total) * 100 : 0

    setStats({ total, voted, pending, turnout })
  }

  const generateVotingCode = () => {
    return "VT" + Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const addVoter = async () => {
    if (!newVoter.student_id || !newVoter.full_name || !newVoter.class) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    // Check if student ID already exists
    const existingVoter = voters.find((v) => v.student_id === newVoter.student_id)
    if (existingVoter) {
      toast({
        title: "Error",
        description: "Student ID already exists",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const votingCode = generateVotingCode()
      const voterData = {
        student_id: newVoter.student_id,
        full_name: newVoter.full_name,
        class: newVoter.class,
        voting_code: votingCode,
        has_voted: false,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("users").insert([voterData]).select()
      if (error) throw error
      const newVoterRecord = data![0]
      setVoters((prev) => [newVoterRecord, ...prev])

      toast({
        title: "Success",
        description: `Voter added successfully. Voting code: ${votingCode}`,
      })

      setNewVoter({ student_id: "", full_name: "", class: "" })
      setShowAddDialog(false)
    } catch (error) {
      console.error("Error adding voter:", error)
      toast({
        title: "Error",
        description: "Failed to add voter",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const editVoter = async () => {
    if (!editingVoter) return

    setSaving(true)
    try {
      // Try to update in Supabase if configured
      if (supabase && isSupabaseConfigured()) {
        const { error } = await supabase
          .from("users")
          .update({
            full_name: editingVoter.full_name,
            class: editingVoter.class,
          })
          .eq("id", editingVoter.id)

        if (error) {
          console.error("Supabase error:", getErrorMessage(error))
        }
      }

      setVoters((prev) => prev.map((v) => (v.id === editingVoter.id ? editingVoter : v)))

      toast({
        title: "Success",
        description: "Voter updated successfully",
      })

      setEditingVoter(null)
      setShowEditDialog(false)
    } catch (error) {
      console.error("Error updating voter:", error)
      toast({
        title: "Error",
        description: "Failed to update voter",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteVoter = async (id: string) => {
    setSaving(true)
    try {
      // Try to delete from Supabase if configured
      if (supabase && isSupabaseConfigured()) {
        const { error } = await supabase.from("users").delete().eq("id", id)

        if (error) {
          console.error("Supabase error:", getErrorMessage(error))
        }
      }

      setVoters((prev) => prev.filter((v) => v.id !== id))

      toast({
        title: "Success",
        description: "Voter deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting voter:", error)
      toast({
        title: "Error",
        description: "Failed to delete voter",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const resetVotingCode = async (voterId: string) => {
    setSaving(true)
    try {
      const newCode = generateVotingCode()

      // Try to update in Supabase if configured
      if (supabase && isSupabaseConfigured()) {
        const { error } = await supabase.from("users").update({ voting_code: newCode }).eq("id", voterId)

        if (error) {
          console.error("Supabase error:", getErrorMessage(error))
        }
      }

      // Update local state
      setVoters((prev) => prev.map((v) => (v.id === voterId ? { ...v, voting_code: newCode } : v)))

      toast({
        title: "Success",
        description: `Voting code reset successfully: ${newCode}`,
      })
    } catch (error) {
      console.error("Error resetting code:", error)
      toast({
        title: "Error",
        description: "Failed to reset voting code",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const generateBulkCodes = async () => {
    setSaving(true)
    try {
      const updates = voters.map((voter) => ({
        ...voter,
        voting_code: generateVotingCode(),
      }))

      // Try to update in Supabase if configured
      if (supabase && isSupabaseConfigured()) {
        for (const update of updates) {
          const { error } = await supabase.from("users").update({ voting_code: update.voting_code }).eq("id", update.id)
          if (error) {
            console.error("Supabase error:", getErrorMessage(error))
          }
        }
      }

      setVoters(updates)

      toast({
        title: "Success",
        description: "All voting codes regenerated",
      })
    } catch (error) {
      console.error("Error generating codes:", error)
      toast({
        title: "Error",
        description: "Failed to generate codes",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const exportVoters = () => {
    const csvContent = [
      ["Student ID", "Full Name", "Class", "Voting Code", "Status", "Voted At"].join(","),
      ...voters.map((voter) =>
        [
          voter.student_id,
          `"${voter.full_name}"`,
          voter.class,
          voter.voting_code,
          voter.has_voted ? "Voted" : "Pending",
          voter.voted_at ? new Date(voter.voted_at).toLocaleString() : "N/A",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lubiri-voters-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Voters data exported successfully",
    })
  }

  const filteredVoters = voters.filter((voter) => {
    const matchesSearch =
      voter.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voter.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = classFilter === "all" || voter.class === classFilter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "voted" && voter.has_voted) ||
      (statusFilter === "pending" && !voter.has_voted)

    return matchesSearch && matchesClass && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voter Management</h1>
          <p className="text-muted-foreground">Manage registered voters and voting codes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportVoters} variant="outline" disabled={saving}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button disabled={saving}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Voter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Voter</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="student_id">Student ID</Label>
                  <Input
                    id="student_id"
                    value={newVoter.student_id}
                    onChange={(e) => setNewVoter((prev) => ({ ...prev, student_id: e.target.value.toUpperCase() }))}
                    placeholder="Enter student ID (e.g., LSS001)"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={newVoter.full_name}
                    onChange={(e) => setNewVoter((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="class">Class</Label>
                  <Select
                    value={newVoter.class}
                    onValueChange={(value) => setNewVoter((prev) => ({ ...prev, class: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addVoter} className="w-full" disabled={saving}>
                  {saving ? "Adding..." : "Add Voter"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Voters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voted</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.voted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnout</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.turnout.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="class-filter">Class</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="voted">Voted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voters Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registered Voters</CardTitle>
              <CardDescription>
                {filteredVoters.length} of {voters.length} voters
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={generateBulkCodes} variant="outline" size="sm" disabled={saving}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate All Codes
              </Button>
              <Dialog open={showCodesDialog} onOpenChange={setShowCodesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View Codes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      Voting Codes
                      <Button variant="ghost" size="sm" onClick={() => setShowCodes(!showCodes)}>
                        {showCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {voters.map((voter) => (
                      <div key={voter.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <span className="font-medium">{voter.full_name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({voter.student_id})</span>
                        </div>
                        <div className="font-mono">{showCodes ? voter.voting_code : "••••••"}</div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Voting Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voted At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVoters.map((voter) => (
                <TableRow key={voter.id}>
                  <TableCell className="font-medium">{voter.student_id}</TableCell>
                  <TableCell>{voter.full_name}</TableCell>
                  <TableCell>{voter.class}</TableCell>
                  <TableCell className="font-mono">{voter.voting_code}</TableCell>
                  <TableCell>
                    <Badge variant={voter.has_voted ? "default" : "secondary"}>
                      {voter.has_voted ? "Voted" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{voter.voted_at ? new Date(voter.voted_at).toLocaleString() : "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingVoter(voter)
                          setShowEditDialog(true)
                        }}
                        disabled={saving}
                        title="Edit voter"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetVotingCode(voter.id)}
                        disabled={saving}
                        title="Reset voting code"
                      >
                        <Key className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={saving}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Voter</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {voter.full_name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteVoter(voter.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Voter Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Voter</DialogTitle>
          </DialogHeader>
          {editingVoter && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_student_id">Student ID</Label>
                <Input id="edit_student_id" value={editingVoter.student_id} disabled className="bg-gray-100" />
              </div>
              <div>
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input
                  id="edit_full_name"
                  value={editingVoter.full_name}
                  onChange={(e) => setEditingVoter({ ...editingVoter, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="edit_class">Class</Label>
                <Select
                  value={editingVoter.class}
                  onValueChange={(value) => setEditingVoter({ ...editingVoter, class: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={editVoter} className="w-full" disabled={saving}>
                {saving ? "Updating..." : "Update Voter"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
