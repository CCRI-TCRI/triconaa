"use client"

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, AlertTriangle, Info, Power, Lock, type LucideIcon } from "lucide-react"
import { broadcastDb, type AnnounceCode } from "@/lib/db"

export const CODE_META: Record<AnnounceCode, { name: string; title: string; desc: string; file: string; color: string; Icon: LucideIcon }> = {
  "3": { name: "Code 3", title: "Election Begun", desc: "The election has officially begun.", file: "/audio/code3.mp3", color: "bg-green-600", Icon: Power },
  "5": { name: "Code 5", title: "Voting Instructions", desc: "How the e-voting works and who to contact for help.", file: "/audio/code5.mp3", color: "bg-blue-600", Icon: Info },
  "9": { name: "Code 9", title: "Voting Closed", desc: "Voting is now officially closed.", file: "/audio/code9.mp3", color: "bg-amber-600", Icon: AlertTriangle },
  "7": { name: "Code 7", title: "System Lockdown", desc: "Emergency — please stay where you are.", file: "/audio/code7.mp3", color: "bg-red-600", Icon: Lock },
}

interface EmergencyCtx {
  lockdown: boolean
  code: AnnounceCode | null
}
const EmergencyContext = createContext<EmergencyCtx>({ lockdown: false, code: null })
export const useEmergency = () => useContext(EmergencyContext)

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const [lockdown, setLockdown] = useState(false)
  const [bannerCode, setBannerCode] = useState<AnnounceCode | null>(null)
  const lastSeen = useRef<string | null>(null)
  const initialized = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chimeRef = useRef<HTMLAudioElement | null>(null)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof Audio === "undefined") return
    audioRef.current = new Audio()
    chimeRef.current = new Audio("/audio/chime.mp3")
  }, [])

  const play = useCallback((code: AnnounceCode) => {
    const meta = CODE_META[code]
    const announce = () => {
      if (!audioRef.current) return
      audioRef.current.src = meta.file
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
    // Airport "ding-dong" chime before every announcement, then the code
    const chime = chimeRef.current
    if (chime) {
      let done = false
      const announceOnce = () => {
        if (done) return
        done = true
        chime.removeEventListener("ended", announceOnce)
        announce()
      }
      chime.addEventListener("ended", announceOnce)
      chime.currentTime = 0
      chime.play().catch(() => announceOnce())
      // fallback in case the 'ended' event is missed
      setTimeout(announceOnce, 4000)
    } else {
      announce()
    }

    setBannerCode(code)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBannerCode((c) => (c === code ? null : c)), 15000)
  }, [])

  const poll = useCallback(async () => {
    try {
      const b = await broadcastDb.get()
      setLockdown(b.lockdown)
      if (!initialized.current) {
        // Don't replay a stale announcement on first load
        lastSeen.current = b.announceAt
        initialized.current = true
        return
      }
      if (b.announceAt && b.announceAt !== lastSeen.current && b.code) {
        lastSeen.current = b.announceAt
        play(b.code)
      }
    } catch {
      /* ignore poll errors */
    }
  }, [play])

  useEffect(() => {
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [poll])

  return (
    <EmergencyContext.Provider value={{ lockdown, code: bannerCode }}>
      {children}
      <EmergencyBanner code={bannerCode} />
    </EmergencyContext.Provider>
  )
}

function EmergencyBanner({ code }: { code: AnnounceCode | null }) {
  return (
    <AnimatePresence>
      {code && (
        <motion.div
          key={code}
          initial={{ opacity: 0, x: 60, y: -8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="fixed right-4 top-4 z-[200] flex max-w-xs items-center gap-3 rounded-xl border border-white/15 bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${CODE_META[code].color}`}>
            {(() => {
              const Icon = CODE_META[code].Icon
              return <Icon className="h-5 w-5" />
            })()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <Volume2 className="h-3.5 w-3.5 text-amber-300" />
              </motion.span>
              <p className="text-sm font-black">
                {CODE_META[code].name} · {CODE_META[code].title}
              </p>
            </div>
            <p className="text-xs text-slate-300">{CODE_META[code].desc}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
