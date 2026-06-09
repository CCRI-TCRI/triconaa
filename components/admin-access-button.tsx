"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Lock } from "lucide-react"
import { motion } from "framer-motion"
import { setAdminAuthed } from "@/components/admin-guard"

// Admin credentials for accessing the dashboard
const ADMIN_USERNAME = "admin"
const ADMIN_PASSWORD = "Lavender"

export function AdminAccessButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate API call for better UX
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (credentials.username === ADMIN_USERNAME && credentials.password === ADMIN_PASSWORD) {
      setAdminAuthed()
      window.location.href = "/admin/dashboard"
    } else {
      setError("Invalid credentials. Please try again.")
    }

    setIsLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="rounded-full w-14 h-14 bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Shield className="w-6 h-6 text-white" />
          </Button>
        </DialogTrigger>
        <DialogContent className="liquid-glass overflow-hidden border-white/40 sm:max-w-md">
          {/* refraction orbs behind the glass */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-blue-400/40 blur-3xl" />
            <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-rose-400/40 blur-3xl" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-blue-600 shadow-lg ring-1 ring-white/40">
              <Lock className="h-7 w-7 text-white" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-slate-800">Admin Access</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="relative z-10 space-y-4">
            <div>
              <Label htmlFor="username" className="text-slate-700">Username</Label>
              <Input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Enter admin username"
                className="border-white/60 bg-white/60 backdrop-blur"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter admin password"
                className="border-white/60 bg-white/60 backdrop-blur"
                required
              />
            </div>
            {error && <div className="rounded-lg bg-red-500/15 p-2 text-sm text-red-700">{error}</div>}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-rose-600 to-blue-600 shadow-lg hover:from-rose-700 hover:to-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Access Admin Panel"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

export default AdminAccessButton
