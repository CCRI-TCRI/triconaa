"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Vote, CheckCircle2, Star, Trophy, Crown, Megaphone, type LucideIcon } from "lucide-react"
import { userDb } from "@/lib/db"
import { useSchoolBranding } from "@/components/school-branding-provider"
import { FaceCamera } from "@/components/face-camera"
import { decodeDescriptor, findBestMatch } from "@/lib/face-recognition"
import { toast } from "sonner"

interface BiometricAuthProps {
  onAuthSuccess: (studentId: string) => void
}

// Floating decorative icons around the login card
const DECOR: { Icon: LucideIcon; left: string; top: string; dur: number; d: number; size: number; color: string }[] = [
  { Icon: Vote, left: "6%", top: "16%", dur: 6, d: 0, size: 44, color: "text-blue-500/40" },
  { Icon: CheckCircle2, left: "88%", top: "20%", dur: 7, d: 0.5, size: 36, color: "text-emerald-500/40" },
  { Icon: Star, left: "12%", top: "74%", dur: 5.5, d: 1, size: 28, color: "text-amber-500/50" },
  { Icon: Trophy, left: "84%", top: "70%", dur: 6.5, d: 0.3, size: 38, color: "text-amber-500/40" },
  { Icon: Crown, left: "78%", top: "44%", dur: 8, d: 0.8, size: 30, color: "text-indigo-500/40" },
  { Icon: Megaphone, left: "8%", top: "46%", dur: 7.5, d: 1.3, size: 32, color: "text-sky-500/40" },
]

function FestiveDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity }}
      />
      <motion.div
        className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
      />
      {DECOR.map((f, i) => {
        const Icon = f.Icon
        return (
          <motion.div
            key={i}
            className={`absolute ${f.color}`}
            style={{ left: f.left, top: f.top }}
            animate={{ y: [0, -18, 0], rotate: [0, 8, -8, 0], opacity: [0.5, 0.95, 0.5] }}
            transition={{ duration: f.dur, repeat: Infinity, ease: "easeInOut", delay: f.d }}
          >
            <Icon style={{ width: f.size, height: f.size }} strokeWidth={1.5} />
          </motion.div>
        )
      })}
    </div>
  )
}

export function BiometricAuth({ onAuthSuccess }: BiometricAuthProps) {
  const { schoolName, logoUrl } = useSchoolBranding()
  const year = new Date().getFullYear()
  const [authMethod, setAuthMethod] = useState<"face" | "manual">("manual")
  const [tokenCode, setTokenCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const code = tokenCode.toUpperCase().trim()

      if (!code || code.length < 3) {
        setError("Please enter a valid voting code.")
        return
      }

      // Look up voter directly in Supabase by voting_code
      const voter = await userDb.getByVotingCode(code)

      if (!voter) {
        setError("This voting code is not registered. Please check your code and try again.")
        toast.error("Code not found")
        return
      }

      if (voter.has_voted) {
        setError("This voting code has already been used. Each code can only be used once.")
        toast.error("Already voted")
        return
      }

      toast.success(`Welcome, ${voter.full_name}!`)
      onAuthSuccess(voter.id)
    } catch (err) {
      console.error("Authentication error:", err)
      setError("Authentication failed. Please try again.")
      toast.error("Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFaceDescriptor = async (descriptor: Float32Array) => {
    setIsLoading(true)
    setError("")
    try {
      const users = await userDb.getAll()
      const profiles = users
        .map((u) => ({ id: u.id, descriptor: decodeDescriptor(u.face_encoding) }))
        .filter((p): p is { id: string; descriptor: number[] } => p.descriptor !== null)

      if (profiles.length === 0) {
        setError("No faces have been enrolled yet. Please use your voting code, or ask the committee to enrol your face.")
        return
      }

      const match = findBestMatch(descriptor, profiles)
      if (!match) {
        setError("Face not recognised. Please try again or use your voting code.")
        toast.error("Face not recognised")
        return
      }

      const voter = users.find((u) => u.id === match.id)
      if (!voter) {
        setError("Matched voter could not be found. Please use your voting code.")
        return
      }
      if (voter.has_voted) {
        setError("This voter has already voted. Each voter can only vote once.")
        toast.error("Already voted")
        return
      }

      toast.success(`Welcome, ${voter.full_name}!`)
      onAuthSuccess(voter.id)
    } catch (err) {
      console.error("Face authentication error:", err)
      setError("Face authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#2b303b] px-4 py-8">
      {/* heading */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{schoolName}</h1>
        <p className="mt-1 text-slate-300">Decision {year} · Student Elections</p>
      </div>

      {/* split card */}
      <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2">
        {/* left greeting panel */}
        <div className="hidden flex-col justify-end bg-[#1b1f29] p-8 text-white md:flex">
          <div className="mb-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white">
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          </div>
          <h2 className="text-3xl font-bold">Hello~</h2>
          <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-slate-400">
            Welcome to the {schoolName} student elections. Sign in with your voting code to cast your ballot.
          </p>
        </div>

        {/* right form panel */}
        <div className="bg-white p-6 sm:p-8">
          <div className="space-y-5">
            {/* Authentication Method Toggle */}
            <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant={authMethod === "manual" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setAuthMethod("manual"); setError("") }}
                className="flex-1"
              >
                <User className="w-4 h-4 mr-2" />
                Voting Code
              </Button>
              <Button
                variant={authMethod === "face" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setAuthMethod("face"); setError("") }}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Face Recognition
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {authMethod === "manual" ? (
                <motion.form
                  key="manual"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleManualAuth}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="tokenCode" className="text-gray-700">
                      Voting Token Code
                    </Label>
                    <div className="relative">
                      <Input
                        id="tokenCode"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your voting token"
                        value={tokenCode}
                        onChange={(e) => setTokenCode(e.target.value.toUpperCase())}
                        className="border-gray-300 focus:border-blue-500 pr-10 font-mono text-lg tracking-widest"
                        required
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Your voting token was provided by the election committee</p>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !tokenCode}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Login to Vote
                      </>
                    )}
                  </Button>

                  <div className="text-center text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <p className="font-semibold mb-1 text-gray-700">Need your voting token?</p>
                    <p>Contact your class teacher or the election committee</p>
                    <p>for your unique voting token code</p>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key="face"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <FaceCamera onDescriptor={handleFaceDescriptor} busy={isLoading} actionLabel="Scan & Verify Face" />

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center text-xs text-blue-700">
                    Look straight at the camera in good lighting. Your face must be enrolled by the election committee first.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center text-xs text-gray-500 space-y-1">
              <p>Secure authentication powered by {schoolName}</p>
              <p>Your vote is private and anonymous</p>
              <p className="flex items-center justify-center gap-1.5 font-semibold text-orange-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Each voting code can only be used once
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
