"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { userDb, currentElectionScope } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { FaceCamera } from "@/components/face-camera"
import { encodeDescriptor } from "@/lib/face-recognition"
import * as XLSX from "xlsx"
import { extractLogoColor } from "@/lib/pdf-logo-color"
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
    Upload,
    FileSpreadsheet,
    FileText,
    FileDown,
    X,
    ScanFace,
    FlaskConical,
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
  face_encoding?: string | null
}

interface ParsedRow {
  full_name: string
  student_id: string
  class: string
  valid: boolean
  note?: string
}

// ── Constituencies (year groups) + streams ──────────────────────
const YEARS = ["S1", "S2", "S3", "S4", "S5", "S6"]
const DEFAULT_STREAMS = ["A", "B", "C", "D"]
const ALL_CLASSES = YEARS.flatMap((y) => DEFAULT_STREAMS.map((s) => y + s))

// Extract the year/constituency (S1–S6) from a class string like "S1A"
function getYear(cls: string): string {
  const m = (cls || "").toUpperCase().match(/^S\s?([1-6])/)
  return m ? "S" + m[1] : "Other"
}
// Extract the stream (the part after the year), e.g. "S1A" → "A"
function getStream(cls: string): string {
  const y = getYear(cls)
  if (y === "Other") return ""
  return (cls || "").toUpperCase().replace(/^S\s?[1-6]\s*/, "")
}

// Combined Year + Stream picker that writes back a single class string
function ClassPicker({
  value,
  onChange,
  streamOptions,
}: {
  value: string
  onChange: (cls: string) => void
  streamOptions: string[]
}) {
  const year = getYear(value) === "Other" ? "" : getYear(value)
  const stream = getStream(value)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={year} onValueChange={(y) => onChange(y + stream)}>
        <SelectTrigger><SelectValue placeholder="Year (S1–S6)" /></SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        list="stream-options"
        placeholder="Stream (e.g. A)"
        value={stream}
        onChange={(e) => onChange(year + e.target.value.toUpperCase())}
      />
      <datalist id="stream-options">
        {streamOptions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  )
}

export default function VotersPage() {
  const { schoolName, motto, logoUrl } = useSchoolBranding()
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
  // Quick-add a whole class at once
  const [classBulk, setClassBulk] = useState({ class: "", count: "40", prefix: "" })
  const [stats, setStats] = useState({
    total: 0,
    voted: 0,
    pending: 0,
    turnout: 0,
  })

  // Bulk import state
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState("")
  const [importFileName, setImportFileName] = useState("")
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importClass, setImportClass] = useState("") // when set, all imported rows go to this class
  const [importProgress, setImportProgress] = useState(0)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [enrollVoter, setEnrollVoter] = useState<Voter | null>(null)
  const [enrollBusy, setEnrollBusy] = useState(false)
  const [testCount, setTestCount] = useState("50")
  const [generatingTest, setGeneratingTest] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [yearFilter, setYearFilter] = useState("all")

  const classes = ALL_CLASSES
  // Streams that actually appear in the data (plus the defaults), for the picker datalist
  const streamOptions = Array.from(
    new Set([...DEFAULT_STREAMS, ...voters.map((v) => getStream(v.class)).filter(Boolean)]),
  ).sort()

  useEffect(() => {
    fetchVoters()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [voters])

  const fetchVoters = async () => {
    try {
      setLoading(true)
      // Use the paginated userDb.getAll so the list isn't truncated at PostgREST's
      // 1000-row cap once the roll grows past 1000 voters.
      const data = await userDb.getAll()
      setVoters(data)
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

  // ── Bulk import helpers ───────────────────────────────────────
  // Turn a raw matrix of cells (from a file or pasted text) into validated rows.
  const rowsToParsed = (matrix: any[][]): ParsedRow[] => {
    const cleaned = matrix
      .map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c).trim())) : [String(r).trim()]))
      .filter((r) => r.some((c) => c !== ""))
    if (cleaned.length === 0) return []

    const header = cleaned[0].map((c) => c.toLowerCase())
    const hasHeader = header.some(
      (h) => h.includes("name") || h.includes("student") || h.includes("class") || h.includes("stream"),
    )

    let nameIdx = 0
    let idIdx = -1
    let classIdx = -1
    let dataRows = cleaned

    if (hasHeader) {
      nameIdx = header.findIndex((h) => h.includes("name"))
      idIdx = header.findIndex(
        (h) => h.includes("student") || h.includes("reg") || h.includes("index") || h.includes("adm") || h.includes("number") || h === "id",
      )
      classIdx = header.findIndex((h) => h.includes("class") || h.includes("stream") || h.includes("form"))
      if (nameIdx === -1) nameIdx = 0
      dataRows = cleaned.slice(1)
    } else {
      // Positional: [name, student id, class]
      const width = cleaned[0].length
      idIdx = width > 1 ? 1 : -1
      classIdx = width > 2 ? 2 : -1
    }

    return dataRows.map((r) => {
      const full_name = (r[nameIdx] || "").trim()
      const student_id = idIdx >= 0 ? (r[idIdx] || "").trim() : ""
      const cls = classIdx >= 0 ? (r[classIdx] || "").trim() : ""
      const valid = full_name.length > 0
      return { full_name, student_id, class: cls, valid, note: valid ? undefined : "Missing name — will be skipped" }
    })
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportText("")
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" })
      const rows = rowsToParsed(matrix)
      setParsedRows(rows)
      if (rows.length === 0) {
        toast({ title: "No rows found", description: "The file appears to be empty.", variant: "destructive" })
      }
    } catch (err) {
      console.error("Error parsing file:", err)
      toast({ title: "Error", description: "Could not read that file. Use .csv, .xlsx or .xls.", variant: "destructive" })
    } finally {
      e.target.value = "" // allow re-uploading the same file
    }
  }

  const handleImportTextChange = (value: string) => {
    setImportText(value)
    setImportFileName("")
    const matrix = value
      .split(/\r?\n/)
      .map((line) => (line.includes("\t") ? line.split("\t") : line.includes(",") ? line.split(",") : [line]))
    setParsedRows(value.trim() ? rowsToParsed(matrix) : [])
  }

  const clearImport = () => {
    setParsedRows([])
    setImportText("")
    setImportFileName("")
    setImportClass("")
    setImportProgress(0)
  }

  const downloadTemplate = () => {
    const csv = "Full Name,Student ID,Class\nJohn Doe,STH00001,S1A\nJane Smith,,S2B\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "voters-import-template.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const runImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid)
    if (validRows.length === 0) {
      toast({ title: "Nothing to import", description: "No valid names were found.", variant: "destructive" })
      return
    }

    setImporting(true)
    setImportProgress(0)
    try {
      const usedIds = new Set(voters.map((v) => v.student_id))
      const usedCodes = new Set(voters.map((v) => v.voting_code))
      let seq = 1
      const genId = () => {
        let id: string
        do {
          id = "STH" + String(seq++).padStart(5, "0")
        } while (usedIds.has(id))
        usedIds.add(id)
        return id
      }
      const genCode = () => {
        let c: string
        do {
          c = generateVotingCode()
        } while (usedCodes.has(c))
        usedCodes.add(c)
        return c
      }

      const election_id = await currentElectionScope()
      const toInsert: any[] = []
      let skipped = 0
      for (const r of validRows) {
        let sid = r.student_id
        if (sid) {
          if (usedIds.has(sid)) {
            skipped++
            continue // duplicate student ID — skip
          }
          usedIds.add(sid)
        } else {
          sid = genId()
        }
        toInsert.push({
          student_id: sid,
          full_name: r.full_name,
          class: importClass || r.class || "N/A",
          voting_code: genCode(),
          has_voted: false,
          ...(election_id ? { election_id } : {}),
        })
      }

      const chunkSize = 200
      let inserted = 0
      let failed = 0
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize)
        const { error } = await supabase.from("users").insert(chunk)
        if (error) {
          console.error("Bulk insert error:", getErrorMessage(error))
          failed += chunk.length
        } else {
          inserted += chunk.length
        }
        setImportProgress(Math.round(((i + chunk.length) / toInsert.length) * 100))
      }

      await fetchVoters()
      toast({
        title: "Import complete",
        description:
          `${inserted} voter${inserted === 1 ? "" : "s"} added` +
          (skipped ? `, ${skipped} duplicate ID${skipped === 1 ? "" : "s"} skipped` : "") +
          (failed ? `, ${failed} failed` : ""),
        variant: failed ? "destructive" : undefined,
      })
      clearImport()
      setShowImportDialog(false)
    } catch (error) {
      console.error("Error importing voters:", error)
      toast({ title: "Error", description: "Failed to import voters.", variant: "destructive" })
    } finally {
      setImporting(false)
    }
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
      const election_id = await currentElectionScope()
      const voterData = {
        student_id: newVoter.student_id,
        full_name: newVoter.full_name,
        class: newVoter.class,
        voting_code: votingCode,
        has_voted: false,
        created_at: new Date().toISOString(),
        ...(election_id ? { election_id } : {}),
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

  // Quick-add a whole class: generate N registered voters in one class,
  // each with an auto student ID (STH#####) and a unique voting code.
  const addClass = async () => {
    const cls = classBulk.class.trim()
    const n = Math.min(300, Math.max(1, parseInt(classBulk.count) || 0))
    if (!cls) {
      toast({ title: "Pick a class", description: "Choose a year and stream first (e.g. S2B).", variant: "destructive" })
      return
    }
    if (!classBulk.count || n < 1) {
      toast({ title: "Enter a count", description: "How many voters should this class have?", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const usedIds = new Set(voters.map((v) => v.student_id))
      const usedCodes = new Set(voters.map((v) => v.voting_code))
      let seq = 1
      const genId = () => {
        let id: string
        do {
          id = "STH" + String(seq++).padStart(5, "0")
        } while (usedIds.has(id))
        usedIds.add(id)
        return id
      }
      const genCode = () => {
        let c: string
        do {
          c = generateVotingCode()
        } while (usedCodes.has(c))
        usedCodes.add(c)
        return c
      }

      const prefix = classBulk.prefix.trim() || `${cls} Student`
      // Continue numbering after any existing voters that share this name prefix
      const existingInClass = voters.filter((v) => v.class === cls && v.full_name.startsWith(prefix)).length
      const election_id = await currentElectionScope()
      const rows = Array.from({ length: n }, (_, i) => ({
        student_id: genId(),
        full_name: `${prefix} ${existingInClass + i + 1}`,
        class: cls,
        voting_code: genCode(),
        has_voted: false,
        ...(election_id ? { election_id } : {}),
      }))

      const { error } = await supabase.from("users").insert(rows)
      if (error) throw error

      await fetchVoters()
      toast({ title: "Class added", description: `${n} voter${n === 1 ? "" : "s"} added to ${cls}.` })
      setClassBulk({ class: "", count: "40", prefix: "" })
      setShowAddDialog(false)
    } catch (error) {
      console.error("Error adding class:", error)
      toast({ title: "Error", description: "Failed to add the class.", variant: "destructive" })
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

  const handleEnrollFace = async (descriptor: Float32Array) => {
    if (!enrollVoter) return
    setEnrollBusy(true)
    try {
      const encoding = encodeDescriptor(descriptor)
      const { error } = await supabase.from("users").update({ face_encoding: encoding }).eq("id", enrollVoter.id)
      if (error) throw error
      setVoters((prev) => prev.map((v) => (v.id === enrollVoter.id ? { ...v, face_encoding: encoding } : v)))
      toast({ title: "Face enrolled", description: `${enrollVoter.full_name} can now log in with their face.` })
      setEnrollVoter(null)
    } catch (error) {
      console.error("Error enrolling face:", error)
      toast({ title: "Error", description: "Failed to save face.", variant: "destructive" })
    } finally {
      setEnrollBusy(false)
    }
  }

  const removeFace = async (voter: Voter) => {
    setEnrollBusy(true)
    try {
      const { error } = await supabase.from("users").update({ face_encoding: null }).eq("id", voter.id)
      if (error) throw error
      setVoters((prev) => prev.map((v) => (v.id === voter.id ? { ...v, face_encoding: null } : v)))
      toast({ title: "Face removed", description: `Face login disabled for ${voter.full_name}.` })
      setEnrollVoter(null)
    } catch (error) {
      console.error("Error removing face:", error)
      toast({ title: "Error", description: "Failed to remove face.", variant: "destructive" })
    } finally {
      setEnrollBusy(false)
    }
  }

  // ── Test voting codes (named Voter 1, Voter 2, …) ─────────────
  const generateTestCodes = async () => {
    const n = Math.min(500, Math.max(1, parseInt(testCount) || 0))
    setGeneratingTest(true)
    try {
      // Replace any existing test voters (student_id TST###)
      await supabase.from("users").delete().like("student_id", "TST%")
      const rows = Array.from({ length: n }, (_, i) => {
        const num = i + 1
        return {
          student_id: "TST" + String(num).padStart(3, "0"),
          full_name: "Voter " + num,
          class: classes[num % classes.length],
          voting_code: "VOTE" + String(num).padStart(3, "0"),
          has_voted: false,
        }
      })
      const { error } = await supabase.from("users").insert(rows)
      if (error) throw error
      toast({ title: "Test codes ready", description: `${n} test voting codes created (VOTE001–VOTE${String(n).padStart(3, "0")}).` })
      fetchVoters()
    } catch (error) {
      console.error("Error generating test codes:", error)
      toast({ title: "Error", description: "Failed to generate test codes.", variant: "destructive" })
    } finally {
      setGeneratingTest(false)
    }
  }

  const clearTestCodes = async () => {
    setGeneratingTest(true)
    try {
      await supabase.from("users").delete().like("student_id", "TST%")
      toast({ title: "Test codes cleared", description: "All test voters were removed." })
      fetchVoters()
    } catch (error) {
      console.error("Error clearing test codes:", error)
      toast({ title: "Error", description: "Failed to clear test codes.", variant: "destructive" })
    } finally {
      setGeneratingTest(false)
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
    a.download = `st-theresa-voters-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Voters data exported successfully",
    })
  }

  // ── Designed PDF export (logo + school header) ────────────────
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

  // Build one designed voters PDF (logo header + table) for a given list. Shared by the
  // combined export and the per-class export so both look identical.
  const makeVotersDoc = (
    jsPDFCtor: any,
    autoTable: any,
    list: Voter[],
    reportTitle: string,
    logo: { data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null,
    maroon: [number, number, number],
    gold: [number, number, number],
  ) => {
    const doc = new jsPDFCtor({ orientation: "portrait", unit: "pt", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const headerH = 92
    const generatedAt = new Date().toLocaleString()

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
      doc.text(reportTitle, textX, 70)

      doc.setFontSize(8)
      doc.setTextColor(255, 230, 230)
      doc.text(`Generated: ${generatedAt}`, pageW - 40, 30, { align: "right" })
      doc.text(`Total voters: ${list.length}`, pageW - 40, 44, { align: "right" })
      doc.text(`Voted: ${list.filter((v) => v.has_voted).length}`, pageW - 40, 58, { align: "right" })
    }

    const drawFooter = (page: number, total: number) => {
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`${schoolName} · Royal Ballot Election System`, 40, pageH - 24)
      doc.text(`Page ${page} of ${total}`, pageW - 40, pageH - 24, { align: "right" })
    }

    autoTable(doc, {
      head: [["#", "Student ID", "Full Name", "Class", "Voting Code", "Status"]],
      body: list.map((v, i) => [
        i + 1,
        v.student_id,
        v.full_name,
        v.class,
        v.voting_code,
        v.has_voted ? "Voted" : "Pending",
      ]),
      startY: headerH + 18,
      margin: { top: headerH + 18, left: 40, right: 40, bottom: 40 },
      styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: maroon, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [251, 240, 233] },
      columnStyles: {
        0: { cellWidth: 28, halign: "center" },
        1: { cellWidth: 80 },
        3: { cellWidth: 50, halign: "center" },
        4: { font: "courier", fontStyle: "bold", textColor: maroon },
        5: { cellWidth: 60, halign: "center" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5) {
          data.cell.styles.textColor = data.cell.raw === "Voted" ? [22, 130, 70] : [180, 120, 0]
        }
      },
    })

    const pageCount = (doc as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      drawHeader()
      drawFooter(i, pageCount)
    }
    return doc
  }

  // Shared logo + brand-colour loading for the PDF exports.
  const loadPdfBrand = async (): Promise<{
    logo: { data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null
    maroon: [number, number, number]
    gold: [number, number, number]
  }> => {
    const logo = await loadLogo()
    const maroon: [number, number, number] = logo ? await extractLogoColor(logo.data) : [22, 138, 173]
    const gold: [number, number, number] = [245, 200, 66]
    return { logo, maroon, gold }
  }

  const exportVotersPDF = async () => {
    setExportingPdf(true)
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const { logo, maroon, gold } = await loadPdfBrand()
      const doc = makeVotersDoc(jsPDF, autoTable, filteredVoters, "Registered Voters Report", logo, maroon, gold)
      doc.save(`st-theresa-voters-${new Date().toISOString().split("T")[0]}.pdf`)
      toast({ title: "PDF ready", description: `Exported ${filteredVoters.length} voters as PDF.` })
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" })
    } finally {
      setExportingPdf(false)
    }
  }

  // Export one PDF per class (of the currently filtered voters), bundled into a single ZIP.
  const exportVotersByClassPDF = async () => {
    setExportingPdf(true)
    try {
      const list = filteredVoters
      if (list.length === 0) {
        toast({ title: "Nothing to export", description: "No voters match the current filters.", variant: "destructive" })
        return
      }

      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const JSZip = (await import("jszip")).default
      const { logo, maroon, gold } = await loadPdfBrand()

      // Group by class, keeping each class's voters together.
      const groups = new Map<string, Voter[]>()
      for (const v of list) {
        const key = (v.class || "").trim() || "Unassigned"
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(v)
      }
      const classNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

      const zip = new JSZip()
      for (const cls of classNames) {
        const doc = makeVotersDoc(jsPDF, autoTable, groups.get(cls)!, `Voting Codes — Class ${cls}`, logo, maroon, gold)
        const safe = cls.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "class"
        zip.file(`${safe}-voting-codes.pdf`, doc.output("blob"))
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `voting-codes-by-class-${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: "Class PDFs ready",
        description: `Exported ${classNames.length} class${classNames.length === 1 ? "" : "es"} as separate PDFs in a ZIP.`,
      })
    } catch (error) {
      console.error("Error exporting per-class PDFs:", error)
      toast({ title: "Error", description: "Failed to generate per-class PDFs.", variant: "destructive" })
    } finally {
      setExportingPdf(false)
    }
  }

  // Search/class/year only — used both by the main table filter (which also
  // applies the voted/pending status filter) and by the "delete by code
  // status" actions below (which need to ignore the current status filter so
  // both the used-codes and unused-codes counts stay meaningful regardless of
  // what's currently selected in that dropdown).
  const matchesBaseFilters = (voter: Voter) => {
    const matchesSearch =
      voter.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voter.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = classFilter === "all" || voter.class === classFilter
    const matchesYear = yearFilter === "all" || getYear(voter.class) === yearFilter
    return matchesSearch && matchesClass && matchesYear
  }

  const filteredVoters = voters.filter((voter) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "voted" && voter.has_voted) ||
      (statusFilter === "pending" && !voter.has_voted)
    return matchesBaseFilters(voter) && matchesStatus
  })

  // Used vs. unused voting codes within the current search/class/year scope —
  // powers the "Delete used/unused codes" actions.
  const usedCodeVoters = voters.filter((v) => matchesBaseFilters(v) && v.has_voted)
  const unusedCodeVoters = voters.filter((v) => matchesBaseFilters(v) && !v.has_voted)

  // Per-constituency (year group) turnout
  const constituencies = [...YEARS, "Other"]
    .map((y) => {
      const list = voters.filter((v) => getYear(v.class) === y)
      const voted = list.filter((v) => v.has_voted).length
      return { year: y, total: list.length, voted, pending: list.length - voted, turnout: list.length ? (voted / list.length) * 100 : 0 }
    })
    .filter((c) => c.total > 0)

  // ── Selection + bulk delete ───────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allFilteredSelected = filteredVoters.length > 0 && filteredVoters.every((v) => selected.has(v.id))

  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredVoters.forEach((v) => next.delete(v.id))
      else filteredVoters.forEach((v) => next.add(v.id))
      return next
    })

  const deleteSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    setSaving(true)
    try {
      const { error } = await supabase.from("users").delete().in("id", ids)
      if (error) throw error
      setVoters((prev) => prev.filter((v) => !selected.has(v.id)))
      setSelected(new Set())
      toast({ title: "Deleted", description: `${ids.length} voter${ids.length === 1 ? "" : "s"} removed.` })
    } catch (error) {
      console.error("Error deleting selected:", error)
      toast({ title: "Error", description: "Failed to delete selected voters.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Delete every voter matching the current search/class/year scope that has
  // (or hasn't) used their voting code yet.
  const deleteByCodeStatus = async (used: boolean) => {
    const list = used ? usedCodeVoters : unusedCodeVoters
    const ids = list.map((v) => v.id)
    if (ids.length === 0) return
    setSaving(true)
    try {
      const { error } = await supabase.from("users").delete().in("id", ids)
      if (error) throw error
      const idSet = new Set(ids)
      setVoters((prev) => prev.filter((v) => !idSet.has(v.id)))
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next })
      toast({
        title: "Deleted",
        description: `${ids.length} voter${ids.length === 1 ? "" : "s"} with ${used ? "used" : "unused"} codes removed.`,
      })
    } catch (error) {
      console.error("Error deleting by code status:", error)
      toast({ title: "Error", description: "Failed to delete voters.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const clearAllVoters = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from("users").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      setVoters([])
      setSelected(new Set())
      toast({ title: "All voters cleared", description: "Every voter has been removed." })
    } catch (error) {
      console.error("Error clearing voters:", error)
      toast({ title: "Error", description: "Failed to clear voters.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

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
            Export CSV
          </Button>
          <Button
            onClick={exportVotersPDF}
            variant="outline"
            disabled={saving || exportingPdf || voters.length === 0}
            className="border-rose-300 text-rose-800 hover:bg-rose-50"
          >
            {exportingPdf ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
          <Button
            onClick={exportVotersByClassPDF}
            variant="outline"
            disabled={saving || exportingPdf || voters.length === 0}
            className="border-rose-300 text-rose-800 hover:bg-rose-50"
            title="One PDF per class, bundled into a ZIP"
          >
            {exportingPdf ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            PDF per Class
          </Button>
          <Dialog
            open={showImportDialog}
            onOpenChange={(open) => {
              setShowImportDialog(open)
              if (!open) clearImport()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" disabled={saving}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-rose-700" />
                  Bulk Import Voters
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a <strong>CSV / Excel</strong> file or paste a list of names. Only the{" "}
                  <strong>Full Name</strong> is required — Student ID and Class are filled automatically when missing.
                  Each voter gets a unique voting code.
                </p>

                {/* Assign all to one class (optional) */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Import into a class (optional)</Label>
                    {importClass && (
                      <button
                        onClick={() => setImportClass("")}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <ClassPicker value={importClass} onChange={setImportClass} streamOptions={streamOptions} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {importClass
                      ? `Every imported voter will be placed in ${importClass}, ignoring any class column in the file.`
                      : "Leave blank to use the Class column from your file (or N/A when missing)."}
                  </p>
                </div>

                {/* File upload */}
                <div>
                  <Label>Upload file (.csv, .xlsx, .xls)</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/50 px-4 py-6 text-center transition hover:border-rose-400 hover:bg-rose-50">
                        <Upload className="h-5 w-5 text-rose-600" />
                        <span className="text-sm font-medium text-rose-800">
                          {importFileName || "Choose a CSV or Excel file"}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={handleImportFile}
                      />
                    </label>
                  </div>
                  <button onClick={downloadTemplate} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:underline">
                    <FileText className="h-3 w-3" />
                    Download template
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  or paste names
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Paste area */}
                <div>
                  <Label htmlFor="paste-names">Paste names (one per line)</Label>
                  <Textarea
                    id="paste-names"
                    value={importText}
                    onChange={(e) => handleImportTextChange(e.target.value)}
                    placeholder={"John Doe\nJane Smith, STH00002, S2B\nPeter Okello"}
                    rows={6}
                    className="mt-1.5 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tip: you can also paste comma- or tab-separated columns as “Name, Student ID, Class”.
                  </p>
                </div>

                {/* Preview */}
                {parsedRows.length > 0 && (
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium">
                        {parsedRows.filter((r) => r.valid).length} valid
                        {parsedRows.some((r) => !r.valid) && (
                          <span className="text-amber-600">
                            {" "}
                            · {parsedRows.filter((r) => !r.valid).length} skipped
                          </span>
                        )}
                      </span>
                      <button onClick={clearImport} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8">Full Name</TableHead>
                            <TableHead className="h-8">Student ID</TableHead>
                            <TableHead className="h-8">Class</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedRows.slice(0, 100).map((r, i) => (
                            <TableRow key={i} className={r.valid ? "" : "opacity-50"}>
                              <TableCell className="py-1.5">{r.full_name || <span className="text-amber-600">— missing —</span>}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{r.student_id || "auto"}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">
                                {importClass ? (
                                  <span className="font-medium text-sky-700">{importClass}</span>
                                ) : (
                                  r.class || "N/A"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {parsedRows.length > 100 && (
                        <p className="px-3 py-2 text-center text-xs text-muted-foreground">
                          …and {parsedRows.length - 100} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {importing && (
                  <div>
                    <Progress value={importProgress} className="h-2" />
                    <p className="mt-1 text-center text-xs text-muted-foreground">Importing… {importProgress}%</p>
                  </div>
                )}

                <Button
                  onClick={runImport}
                  className="w-full bg-[#7a1f2b] text-white hover:bg-[#5c0f1f]"
                  disabled={importing || parsedRows.filter((r) => r.valid).length === 0}
                >
                  {importing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Import {parsedRows.filter((r) => r.valid).length || ""} Voter
                      {parsedRows.filter((r) => r.valid).length === 1 ? "" : "s"}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button disabled={saving}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Voter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Voters</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">Single Voter</TabsTrigger>
                  <TabsTrigger value="class">Whole Class</TabsTrigger>
                </TabsList>

                {/* Single voter */}
                <TabsContent value="single" className="space-y-4 pt-4">
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
                    <Label>Class (Year &amp; Stream)</Label>
                    <ClassPicker
                      value={newVoter.class}
                      onChange={(cls) => setNewVoter((prev) => ({ ...prev, class: cls }))}
                      streamOptions={streamOptions}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Pick a constituency (S1–S6), then a stream (e.g. A, B, or a custom one).</p>
                  </div>
                  <Button onClick={addVoter} className="w-full" disabled={saving}>
                    {saving ? "Adding..." : "Add Voter"}
                  </Button>
                </TabsContent>

                {/* Whole class */}
                <TabsContent value="class" className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Register a whole class at once. Each voter gets an automatic student ID and a unique voting code —
                    rename them individually later if you like.
                  </p>
                  <div>
                    <Label>Class (Year &amp; Stream)</Label>
                    <ClassPicker
                      value={classBulk.class}
                      onChange={(cls) => setClassBulk((prev) => ({ ...prev, class: cls }))}
                      streamOptions={streamOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="class-count">Number of voters</Label>
                      <Input
                        id="class-count"
                        type="number"
                        min={1}
                        max={300}
                        value={classBulk.count}
                        onChange={(e) => setClassBulk((prev) => ({ ...prev, count: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="class-prefix">Name prefix (optional)</Label>
                      <Input
                        id="class-prefix"
                        value={classBulk.prefix}
                        onChange={(e) => setClassBulk((prev) => ({ ...prev, prefix: e.target.value }))}
                        placeholder={classBulk.class ? `${classBulk.class} Student` : "e.g. S2B Student"}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Creates names like “{(classBulk.prefix.trim() || (classBulk.class ? `${classBulk.class} Student` : "S2B Student"))} 1”,
                    “… 2”, and so on.
                  </p>
                  <Button onClick={addClass} className="w-full" disabled={saving}>
                    {saving
                      ? "Adding..."
                      : `Add ${Math.min(300, Math.max(1, parseInt(classBulk.count) || 0))} voter${
                          Math.min(300, Math.max(1, parseInt(classBulk.count) || 0)) === 1 ? "" : "s"
                        }${classBulk.class ? ` to ${classBulk.class}` : ""}`}
                  </Button>
                </TabsContent>
              </Tabs>
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

      {/* Constituencies (year groups) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Voting Constituencies</CardTitle>
              <CardDescription>Turnout by year group · click a constituency to filter the list below</CardDescription>
            </div>
            {yearFilter !== "all" && (
              <Button variant="outline" size="sm" onClick={() => setYearFilter("all")} className="gap-1">
                <X className="h-3.5 w-3.5" /> Clear filter ({yearFilter})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {constituencies.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No voters yet. Add voters with classes like S1A, S2B…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {constituencies.map((c) => {
                const active = yearFilter === c.year
                return (
                  <button
                    key={c.year}
                    onClick={() => setYearFilter(active ? "all" : c.year)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active ? "border-sky-400 bg-sky-50 ring-1 ring-sky-300" : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{c.year}</span>
                      <span className="text-xs font-semibold text-sky-700">{c.turnout.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                      <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${c.turnout}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-emerald-600">{c.voted}</span> voted ·{" "}
                      <span className="font-semibold text-orange-500">{c.pending}</span> pending
                    </p>
                    <p className="text-[11px] text-slate-400">{c.total} registered</p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Voting Codes */}
      {(() => {
        const testVoters = voters
          .filter((v) => v.student_id?.startsWith("TST"))
          .sort((a, b) => (parseInt(a.student_id.slice(3)) || 0) - (parseInt(b.student_id.slice(3)) || 0))
        const testUsed = testVoters.filter((v) => v.has_voted).length
        return (
          <Card className="border-amber-200">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-amber-600" />
                    Test Voting Codes
                  </CardTitle>
                  <CardDescription>
                    Create and monitor open test codes (named Voter 1, Voter 2, …) for trying out the system.
                  </CardDescription>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <Label htmlFor="test-count" className="text-xs">How many</Label>
                    <Input
                      id="test-count"
                      type="number"
                      min={1}
                      max={500}
                      value={testCount}
                      onChange={(e) => setTestCount(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <Button onClick={generateTestCodes} disabled={generatingTest} className="bg-amber-500 text-white hover:bg-amber-600">
                    {generatingTest ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                    Generate
                  </Button>
                  {testVoters.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={generatingTest} className="border-red-200 text-red-600 hover:bg-red-50">
                          <Trash2 className="mr-2 h-4 w-4" />Clear
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear all test codes?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes every test voter (Voter 1–{testVoters.length}). Real voters are not affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={clearTestCodes} className="bg-red-600 hover:bg-red-700">Clear test codes</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {testVoters.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No test codes yet. Choose a number and click Generate to create open codes (VOTE001, VOTE002, …).
                </p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-4 text-sm">
                    <span className="font-medium">Total: <strong>{testVoters.length}</strong></span>
                    <span className="text-green-700">Used: <strong>{testUsed}</strong></span>
                    <span className="text-amber-700">Unused: <strong>{testVoters.length - testUsed}</strong></span>
                  </div>
                  <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
                    {testVoters.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm ${
                          v.has_voted ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted-foreground">{v.full_name}</p>
                          <p className="font-mono font-semibold">{v.voting_code}</p>
                        </div>
                        <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${v.has_voted ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                          {v.has_voted ? "USED" : "OPEN"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )
      })()}

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Registered Voters</CardTitle>
              <CardDescription>
                {selected.size > 0 ? `${selected.size} selected` : `${filteredVoters.length} of ${voters.length} voters`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={saving}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete selected ({selected.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selected.size} selected voter{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
                      <AlertDialogDescription>This permanently removes them and their votes. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteSelected} className="bg-red-600 hover:bg-red-700">Delete selected</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving || usedCodeVoters.length === 0} className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Used Codes ({usedCodeVoters.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {usedCodeVoters.length} voter{usedCodeVoters.length === 1 ? "" : "s"} with used codes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes every voter who has already voted (matching the current class/year/search filters) along with their votes and codes. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteByCodeStatus(true)} className="bg-red-600 hover:bg-red-700">Delete used codes</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving || unusedCodeVoters.length === 0} className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Unused Codes ({unusedCodeVoters.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {unusedCodeVoters.length} voter{unusedCodeVoters.length === 1 ? "" : "s"} with unused codes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes every voter who hasn't voted yet (matching the current class/year/search filters) along with their unused voting codes. This cannot be undone — those voters won't be able to vote.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteByCodeStatus(false)} className="bg-red-600 hover:bg-red-700">Delete unused codes</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={generateBulkCodes} variant="outline" size="sm" disabled={saving}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate All Codes
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving || voters.length === 0} className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Voters
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all {voters.length} voters?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes every voter (including test codes) and all their votes. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllVoters} className="bg-red-600 hover:bg-red-700">Delete everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                <TableHead className="w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </TableHead>
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
                <TableRow key={voter.id} data-state={selected.has(voter.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(voter.id)} onCheckedChange={() => toggleSelect(voter.id)} aria-label={`Select ${voter.full_name}`} />
                  </TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEnrollVoter(voter)}
                        disabled={saving}
                        title={voter.face_encoding ? "Face enrolled — manage" : "Enroll face"}
                        className={voter.face_encoding ? "border-green-300 text-green-700" : ""}
                      >
                        <ScanFace className="w-3 h-3" />
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
                <Label htmlFor="edit_class">Class (Year &amp; Stream)</Label>
                <ClassPicker
                  value={editingVoter.class}
                  onChange={(cls) => setEditingVoter({ ...editingVoter, class: cls })}
                  streamOptions={streamOptions}
                />
              </div>
              <Button onClick={editVoter} className="w-full" disabled={saving}>
                {saving ? "Updating..." : "Update Voter"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Face enrollment dialog */}
      <Dialog open={!!enrollVoter} onOpenChange={(o) => !o && !enrollBusy && setEnrollVoter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-rose-700" />
              Face Enrollment
            </DialogTitle>
          </DialogHeader>
          {enrollVoter && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{enrollVoter.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {enrollVoter.student_id} · {enrollVoter.class} · Code {enrollVoter.voting_code}
                </p>
                {enrollVoter.face_encoding && (
                  <p className="mt-1 text-xs font-medium text-green-700">A face is already enrolled. Re-scan to replace it.</p>
                )}
              </div>

              <FaceCamera onDescriptor={handleEnrollFace} busy={enrollBusy} actionLabel="Capture & Save Face" />

              {enrollVoter.face_encoding && (
                <Button
                  variant="outline"
                  onClick={() => removeFace(enrollVoter)}
                  disabled={enrollBusy}
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  Remove enrolled face
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Ask the student to look straight at the camera in good lighting.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
