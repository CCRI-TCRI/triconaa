"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSchoolBranding } from "@/components/school-branding-provider"

// Decorative emojis that drift across the intro
const FLOATERS = [
  { e: "🗳️", left: "8%", top: "18%", d: 0, dur: 7, size: 40 },
  { e: "✅", left: "82%", top: "22%", d: 0.6, dur: 8, size: 34 },
  { e: "⭐", left: "16%", top: "70%", d: 1.1, dur: 6.5, size: 28 },
  { e: "🎉", left: "75%", top: "68%", d: 0.3, dur: 7.5, size: 38 },
  { e: "👑", left: "46%", top: "12%", d: 0.9, dur: 9, size: 30 },
  { e: "📣", left: "30%", top: "82%", d: 1.4, dur: 8, size: 30 },
  { e: "✨", left: "90%", top: "50%", d: 0.5, dur: 6, size: 24 },
  { e: "🏆", left: "5%", top: "45%", d: 1.2, dur: 8.5, size: 30 },
]

export function ElectionIntro({ onComplete }: { onComplete: () => void }) {
  const { schoolName, logoUrl } = useSchoolBranding()
  const year = new Date().getFullYear()

  const steps = [
    { big: "DECISION", small: String(year), emoji: "🗳️" },
    { big: "EVERY VOICE", small: "COUNTS", emoji: "📣" },
    { big: "EVERY VOTE", small: "MATTERS", emoji: "✅" },
    { big: schoolName, small: "STUDENT LEADERSHIP ELECTIONS", emoji: "👑", brand: true },
  ]

  const [i, setI] = useState(0)
  const [closing, setClosing] = useState(false)

  const finish = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onComplete, 650)
  }

  useEffect(() => {
    if (closing) return
    if (i >= steps.length) {
      finish()
      return
    }
    const dur = i === steps.length - 1 ? 2000 : 1150
    const t = setTimeout(() => setI((v) => v + 1), dur)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, closing])

  const step = steps[Math.min(i, steps.length - 1)]

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
    >
      {/* Animated democratic backdrop */}
      <div className="animate-royal-gradient absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.15),transparent_60%)]" />
      <motion.div
        className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-amber-400/25 blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, delay: 1 }}
      />

      {/* Floating mascots */}
      {FLOATERS.map((f, idx) => (
        <motion.div
          key={idx}
          className="pointer-events-none absolute select-none"
          style={{ left: f.left, top: f.top, fontSize: f.size }}
          animate={{ y: [0, -22, 0], rotate: [0, 8, -8, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: f.dur, repeat: Infinity, ease: "easeInOut", delay: f.d }}
        >
          {f.e}
        </motion.div>
      ))}

      {/* Zoom-through text */}
      <div className="relative flex flex-col items-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ scale: 0.2, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 2.8, opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            {step.brand && (
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 160, delay: 0.1 }}
                className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ring-amber-300/50"
              >
                <img src={logoUrl} alt={schoolName} className="h-20 w-20 object-contain" />
              </motion.div>
            )}
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="mb-3 text-5xl drop-shadow-lg sm:text-6xl"
            >
              {step.emoji}
            </motion.span>
            <h1 className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-4xl font-black uppercase leading-none tracking-tight text-transparent drop-shadow-2xl sm:text-7xl">
              {step.big}
            </h1>
            <p className="mt-3 text-base font-bold uppercase tracking-[0.4em] text-amber-100/90 sm:text-xl">
              {step.small}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* progress dots */}
        <div className="mt-12 flex gap-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx <= i ? "w-8 bg-amber-300" : "w-3 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={finish}
        className="absolute bottom-6 right-6 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
      >
        Skip intro →
      </button>
    </motion.div>
  )
}
