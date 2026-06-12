"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ScanFace, AlertCircle } from "lucide-react"
import { loadFaceModels, getFaceDescriptor } from "@/lib/face-recognition"

interface FaceCameraProps {
  onDescriptor: (descriptor: Float32Array) => void | Promise<void>
  actionLabel?: string
  busy?: boolean
}

export function FaceCamera({ onDescriptor, actionLabel = "Scan Face", busy = false }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState("Loading face models…")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadFaceModels()
        if (cancelled) return
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus("ready")
        setMessage("Center your face in the frame, then scan")
      } catch (error) {
        console.error("Face camera setup failed:", error)
        setStatus("error")
        setMessage("Could not start the camera or load models. Check permissions and your connection.")
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const scan = async () => {
    if (!videoRef.current || scanning || busy) return
    setScanning(true)
    setMessage("Scanning…")
    try {
      const descriptor = await getFaceDescriptor(videoRef.current)
      if (!descriptor) {
        setMessage("No face detected. Move closer, face the camera, and try again.")
        return
      }
      await onDescriptor(descriptor)
      setMessage("Center your face in the frame, then scan")
    } catch (error) {
      console.error("Face scan failed:", error)
      setMessage("Scan failed. Please try again.")
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        {/* oval guide */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-[78%] w-[58%] rounded-[50%] border-2 ${scanning ? "border-blue-400" : "border-white/40"}`} />
        </div>
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-center text-white">
            {status === "loading" ? (
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-400" />
            ) : (
              <AlertCircle className="mb-2 h-8 w-8 text-amber-400" />
            )}
            <p className="max-w-[80%] text-xs text-slate-200">{message}</p>
          </div>
        )}
      </div>
      {status === "ready" && <p className="text-center text-xs text-muted-foreground">{message}</p>}
      <Button onClick={scan} disabled={status !== "ready" || scanning || busy} className="w-full">
        {scanning || busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
        {actionLabel}
      </Button>
    </div>
  )
}
