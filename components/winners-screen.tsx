"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { getPositionsWithCandidates, voteDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { Crown, Loader2 } from "lucide-react"

interface Winner {
  position: string
  category: string
  name: string
  photo_url?: string
  votes: number
  order: number
}

const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

export function WinnersScreen() {
  const { schoolName, motto, logoUrl, electionTerm } = useSchoolBranding()
  const [winners, setWinners] = useState<Winner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [positions, votes] = await Promise.all([getPositionsWithCandidates(), voteDb.getAll()])
        const list: Winner[] = positions
          .map((p): Winner | null => {
            const pv = votes.filter((v) => v.position_id === p.id)
            const ranked = p.candidates
              .map((c) => ({ ...c, count: pv.filter((v) => v.candidate_id === c.id).length }))
              .sort((a, b) => b.count - a.count)
            const top = ranked[0]
            return top && top.count > 0
              ? { position: p.name, category: p.category, name: top.full_name, photo_url: top.photo_url, votes: top.count, order: p.display_order }
              : null
          })
          .filter((w): w is Winner => w !== null)
          .sort((a, b) => a.order - b.order)
        setWinners(list)
      } catch (error) {
        console.error("Winners load error:", error)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#0a0610] via-[#1a0a14] to-[#0a0610] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-[#7a1f2b]/30 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-amber-500/20 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-2xl ring-2 ring-amber-300/40">
            <img src={logoUrl} alt={schoolName} className="h-16 w-16 object-contain" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300">{electionTerm}</p>
          <h1 className="mt-2 bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-4xl font-black text-transparent sm:text-5xl">
            Meet Your New Prefects
          </h1>
          <p className="mt-2 text-sm italic text-amber-200/70">{schoolName} · "{motto}"</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
          </div>
        ) : winners.length === 0 ? (
          <p className="text-center text-slate-400">Results will appear here once votes are counted.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map((w, i) => (
              <motion.div
                key={`${w.position}-${i}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-white/[0.04] p-5 text-center"
              >
                <div className="relative mx-auto mb-3 h-24 w-24">
                  <div className="h-24 w-24 overflow-hidden rounded-full ring-2 ring-amber-400">
                    {w.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.photo_url} alt={w.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/5 text-2xl font-black text-amber-300">{initials(w.name)}</div>
                    )}
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 shadow-lg">
                    <Crown className="h-4 w-4 text-[#3b0a14]" />
                  </div>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">{w.position}</p>
                <h3 className="mt-1 text-xl font-black">{w.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{w.votes} votes</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
