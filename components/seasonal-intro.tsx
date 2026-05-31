"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getCurrentSeason } from "@/lib/seasons"

export function SeasonalIntro() {
  const [season, setSeason] = useState(getCurrentSeason())
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    const currentSeason = getCurrentSeason()
    setSeason(currentSeason)

    // Show seasonal intro for special occasions
    if (currentSeason.theme !== "default") {
      const hasSeenIntro = localStorage.getItem(`seasonal-intro-${currentSeason.theme}`)
      if (!hasSeenIntro) {
        setShowIntro(true)
        setTimeout(() => {
          setShowIntro(false)
          localStorage.setItem(`seasonal-intro-${currentSeason.theme}`, "true")
        }, 3000)
      }
    }
  }, [])

  if (!showIntro || season.theme === "default") {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center text-white border border-white/20 max-w-md mx-4"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="text-6xl mb-4"
          >
            {season.icon}
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">{season.greeting}</h2>
          <p className="text-blue-200">{season.message}</p>

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 3 }}
            className="h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mt-4"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
