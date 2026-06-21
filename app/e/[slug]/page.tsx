"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { electionsDb, setCurrentElectionId, userDb, type Election } from "@/lib/db"
import { BiometricAuth } from "@/components/biometric-auth"
import { VotingBallot } from "@/components/voting-ballot"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { toast } from "sonner"

type State = "loading" | "notfound" | "auth" | "voting" | "complete"

export default function ElectionVotePage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const { logoUrl } = useSchoolBranding()
  const [election, setElection] = useState<Election | null>(null)
  const [state, setState] = useState<State>("loading")
  const [studentId, setStudentId] = useState("")
  const [receipt, setReceipt] = useState("")

  // Per-election login branding (falls back to the global defaults)
  const brand = election
    ? {
        schoolName: election.name,
        logoUrl: election.logo_url || logoUrl,
        subtitle: election.login_subtitle || undefined,
        welcome: election.login_welcome || undefined,
        bgImages: (() => { try { const a = JSON.parse(election.login_bg_images || "[]"); return Array.isArray(a) ? a : [] } catch { return [] } })(),
      }
    : undefined

  useEffect(() => {
    if (!slug) return
    (async () => {
      const e = await electionsDb.getBySlug(slug)
      if (!e) { setState("notfound"); return }
      setElection(e)
      setCurrentElectionId(e.id) // scope all ballot data to this election
      setState("auth")
    })()
    return () => setCurrentElectionId(null)
  }, [slug])

  const handleAuth = async (id: string) => {
    try {
      const user = await userDb.getById(id)
      if (user?.has_voted) { toast.error("This voting code has already been used."); return }
      const existing = sessionStorage.getItem(`vote_session_${id}`) || undefined
      const session = await userDb.startSession(id, existing)
      if (!session.ok) {
        toast.error(session.reason === "voted" ? "This voting code has already been used." : "This code is already in use on another device.")
        return
      }
      sessionStorage.setItem(`vote_session_${id}`, session.token)
    } catch { /* allow through on lookup error */ }
    setStudentId(id)
    setState("voting")
  }

  if (state === "loading") {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-[#168AAD]" /></div>
  }

  if (state === "notfound") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-bold text-slate-900">Election not found</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">This voting link isn’t valid. Please check the link from your election organisers.</p>
      </div>
    )
  }

  if (state === "auth") {
    return (
      <div className="relative min-h-[100dvh]">
        <div className="bg-[#168AAD] py-2 text-center text-sm font-semibold text-white">{election?.name}</div>
        <BiometricAuth onAuthSuccess={handleAuth} brand={brand} />
      </div>
    )
  }

  if (state === "voting") {
    return <VotingBallot studentId={studentId} onVoteComplete={(r) => { if (r) setReceipt(r); setState("complete") }} brand={election ? { schoolName: election.name, motto: election.motto || undefined, logoUrl: election.logo_url || undefined } : undefined} />
  }

  // complete
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-[#168AAD] to-[#1A759F] p-6 text-center text-white">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white">
        <CheckCircle className="h-14 w-14 text-[#168AAD]" />
      </motion.div>
      <h1 className="text-3xl font-bold">Vote submitted!</h1>
      <p className="mt-2 opacity-90">Thank you for voting in {election?.name}.</p>
      {receipt && (
        <div className="mt-6 rounded-xl border border-white/25 bg-white/10 px-6 py-3">
          <p className="text-xs uppercase tracking-widest text-white/70">Your vote receipt</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-wider">{receipt}</p>
        </div>
      )}
    </div>
  )
}
