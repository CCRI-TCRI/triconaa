"use client"

import { useState, useEffect } from "react"
import { BiometricAuth } from "@/components/biometric-auth"
import { WelcomeTutorial } from "@/components/welcome-tutorial"
import { VotingBallot } from "@/components/voting-ballot"
import { TutorialPopup } from "@/components/tutorial-popup"
import { HolidayPopup } from "@/components/holiday-popup"
import { SeasonalBackground } from "@/components/seasonal-background"
import { AdminAccessButton } from "@/components/admin-access-button"
import { SeasonalIntro } from "@/components/seasonal-intro"
import { ElectionClosedScreen } from "@/components/election-closed-screen"
import { WinnersScreen } from "@/components/winners-screen"
import { LockdownScreen } from "@/components/lockdown-screen"
import { useEmergency } from "@/components/emergency-broadcast"
import { motion } from "framer-motion"
import { CheckCircle, Trophy, Sparkles, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { userDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { getSeasonByTheme, getSeasonalContainerClass } from "@/lib/seasons"

type AppState = "auth" | "tutorial" | "voting" | "complete"

const CELEBRATIONS = [
  "Vote Submitted Successfully!",
  "Boom! Your vote is in!",
  "Your voice has been heard!",
  "Democracy thanks you!",
  "History made — vote recorded!",
  "Nailed it! Ballot cast.",
  "You did your part — legend!",
  "Every vote counts, and yours just did!",
  "Power to the people!",
  "Sealed, stamped, delivered!",
]
const PARTY_COLORS = ["#7a1f2b", "#f5c542", "#2563eb", "#ffffff", "#fbbf24", "#e11d48"]

export default function VotingApp() {
  const { schoolName, logoUrl, seasonalTheme, electionStatus } = useSchoolBranding()
  const { lockdown } = useEmergency()
  const [appState, setAppState] = useState<AppState>("auth")
  const [studentId, setStudentId] = useState("")
  const [studentName, setStudentName] = useState("")
  const [showTutorial, setShowTutorial] = useState(false)
  const [showHolidayGreeting, setShowHolidayGreeting] = useState(false)
  const [celebration, setCelebration] = useState<{ headline: string; effect: "confetti" | "fireworks" } | null>(null)

  // Season is driven by the admin Settings (falls back to date-based when "auto")
  const season = getSeasonByTheme(seasonalTheme)

  // Random celebration (fireworks or confetti) when a vote is submitted
  useEffect(() => {
    if (appState !== "complete") return
    const headline = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]
    const effect: "confetti" | "fireworks" = Math.random() < 0.5 ? "fireworks" : "confetti"
    setCelebration({ headline, effect })
    let cancelled = false
    ;(async () => {
      const confetti = (await import("canvas-confetti")).default
      if (cancelled) return
      if (effect === "confetti") {
        confetti({ particleCount: 170, spread: 95, startVelocity: 45, origin: { y: 0.6 }, colors: PARTY_COLORS })
        confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0 }, colors: PARTY_COLORS })
        confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1 }, colors: PARTY_COLORS })
      } else {
        const end = Date.now() + 3500
        const burst = () => {
          if (cancelled) return
          confetti({
            particleCount: 45,
            startVelocity: 32,
            spread: 360,
            ticks: 70,
            origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.1 },
            colors: PARTY_COLORS,
          })
          if (Date.now() < end) setTimeout(burst, 320)
        }
        burst()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appState])

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("voting-tutorial-seen")
    if (!hasSeenTutorial) setShowTutorial(true)

    const hasSeenHolidayGreeting = localStorage.getItem(`holiday-greeting-${season.theme}`)
    if (!hasSeenHolidayGreeting && season.theme !== "default") {
      setTimeout(() => setShowHolidayGreeting(true), 1000)
    }

    if (season.theme === "halloween") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [season.theme])

  const handleAuthSuccess = async (id: string) => {
    setStudentId(id)
    try {
      const user = await userDb.getById(id)
      if (user) setStudentName(user.full_name)
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
    setAppState("tutorial")
  }

  const handleTutorialComplete = () => setAppState("voting")
  const handleVoteComplete = () => setAppState("complete")

  const handleTutorialClose = () => {
    setShowTutorial(false)
    localStorage.setItem("voting-tutorial-seen", "true")
  }

  const handleTutorialPopupComplete = () => {
    setShowTutorial(false)
    localStorage.setItem("voting-tutorial-seen", "true")
  }

  const handleHolidayClose = () => {
    setShowHolidayGreeting(false)
    localStorage.setItem(`holiday-greeting-${season.theme}`, "true")
  }

  const handleReturnToLogin = () => {
    setAppState("auth")
    setStudentId("")
    setStudentName("")
    setShowTutorial(false)
    setShowHolidayGreeting(false)
    setCelebration(null)
  }

  // Emergency lockdown overrides everything on the public app
  if (lockdown) return <LockdownScreen />

  if (appState === "auth") {
    // Election lifecycle gates the public landing page
    if (electionStatus === "completed") {
      return (
        <div className="relative">
          <WinnersScreen />
          <AdminAccessButton />
        </div>
      )
    }
    if (electionStatus === "paused" || electionStatus === "stopped") {
      return (
        <div className="relative">
          <ElectionClosedScreen />
          <AdminAccessButton />
        </div>
      )
    }
    return (
      <div className={`min-h-screen relative ${getSeasonalContainerClass(season.theme)}`}>
        <SeasonalIntro theme={season.theme} />
        <SeasonalBackground theme={season.theme} />
        <BiometricAuth onAuthSuccess={handleAuthSuccess} />
        <AdminAccessButton />
        {showTutorial && <TutorialPopup onClose={handleTutorialClose} onComplete={handleTutorialPopupComplete} />}
        {showHolidayGreeting && <HolidayPopup onClose={handleHolidayClose} />}
      </div>
    )
  }

  if (appState === "tutorial") {
    return (
      <div className="relative">
        <SeasonalIntro theme={season.theme} />
        <SeasonalBackground theme={season.theme} />
        <WelcomeTutorial onComplete={handleTutorialComplete} studentName={studentName || studentId} />
        <AdminAccessButton />
      </div>
    )
  }

  if (appState === "voting") {
    return (
      <div className="relative">
        <SeasonalIntro theme={season.theme} />
        <SeasonalBackground theme={season.theme} />
        <VotingBallot studentId={studentId} onVoteComplete={handleVoteComplete} />
        <AdminAccessButton />
      </div>
    )
  }

  if (appState === "complete") {
    return (
      <div className={`min-h-screen relative ${getSeasonalContainerClass(season.theme)}`}>
        <SeasonalIntro theme={season.theme} />
        <SeasonalBackground theme={season.theme} />
        <AdminAccessButton />
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center text-white max-w-2xl"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="mx-auto w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl relative"
            >
              <img src={logoUrl} alt={schoolName} className="w-20 h-20 object-contain" />
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center border-4 border-white">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </motion.div>

            <motion.h1
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-4xl md:text-6xl font-bold mb-6"
            >
              {celebration?.headline || "Vote Submitted Successfully!"}
            </motion.h1>

            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl md:text-2xl mb-8 opacity-90"
            >
              Thank you for participating in the Trial Elections
            </motion.p>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center space-x-4 text-lg">
                <Trophy className="w-6 h-6" />
                <span>Your voice matters</span>
                <Sparkles className="w-6 h-6" />
              </div>

              <p className="text-lg opacity-80">Results will be announced after the voting period ends.</p>

              {season.theme !== "default" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.1 }}
                  className="mt-6 p-4 bg-white/10 rounded-lg border border-white/20"
                >
                  <p className="text-lg">
                    {season.icon} {season.greeting.split("!")[0]}! Thank you for voting! {season.icon}
                  </p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className="mt-8"
              >
                <Button
                  onClick={handleReturnToLogin}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                  size="lg"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Return to Login
                </Button>
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="mt-8 text-sm opacity-60"
              >
                System Built By Sinclaire
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  return null
}
