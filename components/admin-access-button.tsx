"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Shield } from "lucide-react"

export function AdminAccessButton() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Link
        href="/admin-login"
        aria-label="Admin access"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition-colors hover:bg-slate-900"
      >
        <Shield className="h-6 w-6" />
      </Link>
    </motion.div>
  )
}

export default AdminAccessButton
