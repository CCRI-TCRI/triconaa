"use client"

import { useState, useEffect } from "react"
import { BiometricAuth } from "@/components/biometric-auth"
import { WelcomeTutorial } from "@/components/welcome-tutorial"
import { VotingBallot } from "@/components/voting-ballot"
import { TutorialPopup } from "@/components/tutorial-popup"
import { HolidayPopup } from "@/components/holiday-popup"
import { SeasonalBackground } from "@/components/seasonal-background"
import { AdminAccessButton } from "@/components/admin-access-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccessibilityControls } from "@/components/accessibility-controls"
import { SeasonalIntro } from "@/components/seasonal-intro"
import { ElectionClosedScreen } from "@/components/election-closed-screen"
import { WinnersScreen } from "@/components/winners-screen"
import { LockdownScreen } from "@/components/lockdown-screen"
import { useEmergency } from "@/components/emergency-broadcast"
import { motion } from "framer-motion"
import { CheckCircle, Trophy, Sparkles, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { userDb } from "@/lib/db"
import { toast } from "sonner"
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
const PARTY_COLORS = ["#168AAD", "#D9ED92", "#34A0A4", "#ffffff", "#76C893", "#1E6091"]

export default function VotingApp() {
  const { schoolName, logoUrl, seasonalTheme, electionStatus } = useSchoolBranding()
  const { lockdown } = useEmergency()
  const [appState, setAppState] = useState<AppState>("auth")
  const [studentId, setStudentId] = useState("")
  const [studentName, setStudentName] = useState("")
  const [showTutorial, setShowTutorial] = useState(false)
  const [showHolidayGreeting, setShowHolidayGreeting] = useState(false)
  const [celebration, setCelebration] = useState<{ headline: string; effect: "confetti" | "fireworks" } | null>(null)
  const [receipt, setReceipt] = useState("")

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

  // After voting, automatically return to the login screen so the next student
  // can vote (no need to tap "Return to Login").
  useEffect(() => {
    if (appState !== "complete") return
    const t = setTimeout(() => {
      setAppState("auth")
      setStudentId("")
      setStudentName("")
      setShowTutorial(false)
      setShowHolidayGreeting(false)
      setCelebration(null)
    }, 8000)
    return () => clearTimeout(t)
  }, [appState])

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("voting-tutorial-seen")
    if (!hasSeenTutorial) setShowTutorial(true)

    const hasSeenHolidayGreeting = localStorage.getItem(`holiday-greeting-${season.theme}`)
    if (!hasSeenHolidayGreeting && season.theme !== "default") {
      setTimeout(() => setShowHolidayGreeting(true), 1000)
    }
    // Note: the global `dark` class is owned by next-themes (user toggle) — the
    // seasonal themes no longer force it on/off.
  }, [season.theme])

  const handleAuthSuccess = async (id: string) => {
    try {
      const user = await userDb.getById(id)
      if (user?.has_voted) {
        toast.error("This voting code has already been used.")
        return
      }
      // Device / session lock — block a code being used on two devices at once.
      const existing = sessionStorage.getItem(`vote_session_${id}`) || undefined
      const session = await userDb.startSession(id, existing)
      if (!session.ok) {
        toast.error(session.reason === "voted"
          ? "This voting code has already been used."
          : "This voting code is already in use on another device. Try again shortly.")
        return
      }
      sessionStorage.setItem(`vote_session_${id}`, session.token)
      setStudentId(id)
      if (user) setStudentName(user.full_name)
    } catch (error) {
      console.error("Error fetching user data:", error)
      setStudentId(id)
    }
    setAppState("tutorial")
  }

  const handleTutorialComplete = () => setAppState("voting")
  const handleVoteComplete = (r?: string) => {
    if (r) setReceipt(r)
    setAppState("complete")
  }

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
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <AccessibilityControls />
          <ThemeToggle variant="icon" />
        </div>
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
      <div className="relative min-h-screen bg-gradient-to-br from-[#1A759F] via-[#168AAD] to-[#1E6091]">
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
              Thank you for voting! Your ballot has been recorded.
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

              {receipt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0 }}
                  className="mx-auto mt-4 w-fit rounded-xl border border-white/25 bg-white/10 px-6 py-3 backdrop-blur-sm"
                >
                  <p className="text-xs uppercase tracking-widest text-white/70">Your vote receipt</p>
                  <p className="mt-1 font-mono text-2xl font-black tracking-wider">{receipt}</p>
                  <p className="mt-1 text-xs text-white/60">Proof you voted · does not reveal your choices</p>
                </motion.div>
              )}

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
                  Return to Login now
                </Button>
                <p className="mt-3 text-sm text-white/70">Returning to the login screen automatically…</p>
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
