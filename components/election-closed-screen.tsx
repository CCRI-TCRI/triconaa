"use client"

import { motion } from "framer-motion"
import { useSchoolBranding } from "@/components/school-branding-provider"

export function ElectionClosedScreen() {
  const { schoolName, motto, logoUrl, electionTerm } = useSchoolBranding()

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1a24] via-[#0d2535] to-[#0a1a24] px-6 text-center text-white">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-[#168AAD]/30 blur-[140px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-40 bottom-1/4 h-[32rem] w-[32rem] rounded-full bg-[#76C893]/20 blur-[140px]"
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 9, repeat: Infinity, delay: 1 }}
        />
      </div>

      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 14 }} className="relative z-10">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ring-[#D9ED92]/40">
          <img src={logoUrl} alt={schoolName} className="h-28 w-28 object-contain" />
          <motion.div className="absolute -inset-2 rounded-full border-2 border-dashed border-[#D9ED92]/40" animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
        </motion.div>
      </motion.div>

      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="relative z-10 mt-8 text-3xl font-black tracking-tight sm:text-4xl">
        {schoolName}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="relative z-10 mt-1 text-sm italic text-[#D9ED92]/80">
        "{motto}"
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="relative z-10 mt-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#D9ED92]">Student Leadership</p>
        <h2 className="mt-3 bg-gradient-to-r from-[#D9ED92] via-white to-[#D9ED92] bg-clip-text text-2xl font-black leading-snug text-transparent sm:text-4xl">
          Elections are happening in the {electionTerm}
        </h2>
        <p className="mt-4 text-slate-400">Voting is not open right now. Please check back when the polls go live.</p>
      </motion.div>

      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.9, duration: 1 }} className="relative z-10 mt-10 h-1 w-48 rounded-full bg-gradient-to-r from-transparent via-[#D9ED92] to-transparent" />
    </div>
  )
}
