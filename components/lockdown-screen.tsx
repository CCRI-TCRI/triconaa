"use client"

import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import { useSchoolBranding } from "@/components/school-branding-provider"

export function LockdownScreen() {
  const { schoolName, logoUrl } = useSchoolBranding()
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      {/* flashing red wash */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-red-600"
        animate={{ opacity: [0, 0.28, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* hazard stripes top & bottom */}
      <div
        className="absolute inset-x-0 top-0 h-4"
        style={{ background: "repeating-linear-gradient(45deg, #facc15 0 24px, #000 24px 48px)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-4"
        style={{ background: "repeating-linear-gradient(45deg, #facc15 0 24px, #000 24px 48px)" }}
      />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="flex h-36 w-36 items-center justify-center rounded-2xl bg-red-600 shadow-[0_0_60px_rgba(220,38,38,0.7)]"
        >
          <AlertTriangle className="h-20 w-20 text-yellow-300" strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          className="mt-8 text-5xl font-black uppercase tracking-[0.2em] text-red-500 sm:text-7xl"
        >
          System Lockdown
        </motion.h1>
        <p className="mt-4 text-2xl font-bold text-yellow-300 sm:text-3xl">Please stay where you are.</p>
        <p className="mt-2 max-w-xl text-slate-300">
          This is an emergency notice (Code 7). All voting and result screens are temporarily suspended. Remain calm and
          await further instructions from staff.
        </p>

        <div className="mt-10 flex items-center gap-3 opacity-80">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
            <img src={logoUrl} alt={schoolName} className="h-8 w-8 object-contain" />
          </div>
          <span className="text-sm font-semibold text-slate-300">{schoolName}</span>
        </div>
      </div>
    </div>
  )
}
