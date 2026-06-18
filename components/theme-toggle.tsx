"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch"

/**
 * Dark-mode toggle. Renders a sun/moon labelled switch.
 * `variant="icon"` renders a compact icon button instead (for tight headers).
 */
export function ThemeToggle({ variant = "switch", className = "" }: { variant?: "switch" | "icon"; className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = (mounted ? resolvedTheme || theme : "light") === "dark"
  const toggle = () => setTheme(isDark ? "light" : "dark")

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle dark mode"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20 ${className}`}
      >
        {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Sun className="h-4 w-4 text-amber-500" />
      <Switch checked={mounted ? isDark : false} onCheckedChange={toggle} aria-label="Toggle dark mode" />
      <Moon className="h-4 w-4 text-slate-400 dark:text-slate-300" />
    </div>
  )
}
