"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

// Sign-in is now unified at /admin-login (the role is resolved from the account).
export default function HeadteacherLoginRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/admin-login") }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecting to sign in…
    </div>
  )
}
