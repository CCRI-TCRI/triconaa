"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop())
    }
  }, [stream])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
    } catch {
      toast.error("Camera access denied. Please use manual login.")
      setAuthMethod("manual")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

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

  const handleFaceAuth = async () => {
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast.error("Face recognition is not yet available. Please use manual login.")
      setAuthMethod("manual")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 overflow-hidden">
      <FestiveDecor />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="relative w-full max-w-md"
      >
        {/* glow ring */}
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-blue-500/30 via-amber-400/25 to-indigo-500/30 blur-2xl" />
        <Card className="relative overflow-hidden border-0 bg-white/95 shadow-2xl backdrop-blur">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-amber-400 to-indigo-600" />
          <CardHeader className="text-center space-y-3 pt-6">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative mx-auto h-24 w-24"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-amber-100 shadow-lg" />
              <motion.div
                className="absolute -inset-1 rounded-full border-2 border-dashed border-amber-300/60"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={logoUrl} alt={schoolName} className="h-20 w-20 object-contain drop-shadow" />
              </div>
            </motion.div>
            <div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-700"
              >
                <Vote className="h-3.5 w-3.5" />
                Decision {year}
              </motion.div>
              <CardTitle className="text-2xl font-black text-gray-800">{schoolName}</CardTitle>
              <p className="mt-1 text-gray-600">Student Leadership Elections</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Authentication Method Toggle */}
            <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant={authMethod === "manual" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setAuthMethod("manual"); stopCamera() }}
                className="flex-1"
              >
                <User className="w-4 h-4 mr-2" />
                Manual Login
              </Button>
              <Button
                variant={authMethod === "face" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setAuthMethod("face"); startCamera() }}
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
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
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
                  <div className="relative">
                    <video ref={videoRef} autoPlay muted className="w-full h-64 object-cover rounded-lg bg-gray-100" />
                    <canvas ref={canvasRef} className="hidden" />
                    {!stream && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                        <div className="text-center">
                          <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                          <p className="text-gray-600">Camera access required</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleFaceAuth}
                    disabled={isLoading || !stream}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scanning Face...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Authenticate with Face
                      </>
                    )}
                  </Button>

                  <div className="text-center text-xs text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="font-semibold mb-1 text-yellow-700">Face Recognition</p>
                    <p className="text-yellow-600">This feature is currently under development. Please use manual login for now.</p>
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
