"use client"

import { useEffect, useState } from "react"
import { electionsDb, getCurrentElectionId, type Election } from "@/lib/db"

export interface ManagedElection {
  election: Election | null
  isPrimary: boolean
  ready: boolean
}

/**
 * Resolves which election the current view is scoped to (set by the admin
 * election switcher, an admin account's assigned election, or a public
 * /e/[slug] voter link) so pages can show THAT election's own name, logo and
 * motto instead of always falling back to the global school branding.
 *
 * `ready` is false only while a *specific* (non-primary) election's details
 * are still loading — callers should hold off rendering branded text during
 * that short window rather than flashing the global default (e.g. "St.
 * Theresa") before swapping to the correct one.
 */
export function useManagedElection(): ManagedElection {
  const initialId = typeof window !== "undefined" ? getCurrentElectionId() : null
  const [election, setElection] = useState<Election | null>(null)
  const [ready, setReady] = useState(!initialId)

  useEffect(() => {
    let cancelled = false
    const id = getCurrentElectionId()
    if (!id) {
      setElection(null)
      setReady(true)
      return
    }
    setReady(false)
    electionsDb.getById(id).then((e) => {
      if (cancelled) return
      setElection(e)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // Re-resolve if the caller navigates while mounted (rare, but the switcher
    // can change the id without a full page reload on the dashboard).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof window !== "undefined" ? getCurrentElectionId() : null])

  return { election, isPrimary: !election, ready }
}
