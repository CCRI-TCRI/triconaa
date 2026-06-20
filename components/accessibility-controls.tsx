"use client"

import { useEffect, useState } from "react"
import { Accessibility, Type, Contrast } from "lucide-react"

type TextSize = "normal" | "large" | "xlarge"

const TEXT_KEY = "a11y-text"
const CONTRAST_KEY = "a11y-contrast"

function applyPrefs(size: TextSize, contrast: boolean) {
  const el = document.documentElement
  el.classList.remove("a11y-large", "a11y-xlarge")
  if (size === "large") el.classList.add("a11y-large")
  else if (size === "xlarge") el.classList.add("a11y-xlarge")
  el.classList.toggle("a11y-contrast", contrast)
}

/**
 * Accessibility controls: a small button that opens text-size and high-contrast
 * options. Preferences persist in localStorage and apply site-wide.
 */
export function AccessibilityControls({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState<TextSize>("normal")
  const [contrast, setContrast] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Apply saved prefs on mount
  useEffect(() => {
    const s = (localStorage.getItem(TEXT_KEY) as TextSize) || "normal"
    const c = localStorage.getItem(CONTRAST_KEY) === "1"
    setSize(s); setContrast(c); setMounted(true)
    applyPrefs(s, c)
  }, [])

  const updateSize = (s: TextSize) => {
    setSize(s); localStorage.setItem(TEXT_KEY, s); applyPrefs(s, contrast)
  }
  const updateContrast = (c: boolean) => {
    setContrast(c); localStorage.setItem(CONTRAST_KEY, c ? "1" : "0"); applyPrefs(size, c)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Accessibility options"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
      >
        <Accessibility className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Type className="h-3.5 w-3.5" /> Text size
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {([["normal", "A"], ["large", "A+"], ["xlarge", "A++"]] as [TextSize, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => updateSize(val)}
                  className={`rounded-lg border px-2 py-1.5 text-sm font-bold transition ${
                    mounted && size === val
                      ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => updateContrast(!contrast)}
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <span className="flex items-center gap-1.5"><Contrast className="h-4 w-4" /> High contrast</span>
              <span className={`relative h-5 w-9 rounded-full transition ${mounted && contrast ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${mounted && contrast ? "left-4" : "left-0.5"}`} />
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
