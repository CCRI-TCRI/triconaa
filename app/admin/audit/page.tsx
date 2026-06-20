"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, RefreshCw, ShieldCheck } from "lucide-react"
import { auditDb, type AuditEntry } from "@/lib/db"

const ACTION_CLS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  import: "bg-emerald-100 text-emerald-700",
  generate: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  schedule: "bg-blue-100 text-blue-700",
  status: "bg-amber-100 text-amber-700",
  certify: "bg-violet-100 text-violet-700",
  delete: "bg-rose-100 text-rose-700",
  delete_all: "bg-rose-100 text-rose-700",
  reset: "bg-rose-100 text-rose-700",
}

function actionClass(action: string) {
  const key = action.split(".")[1] || ""
  return ACTION_CLS[key] || "bg-slate-100 text-slate-700"
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setEntries(await auditDb.list(400))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100"><History className="h-6 w-6" /> Audit Log</h1>
          <p className="text-muted-foreground">Every administrative action, recorded with who did it and when.</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> {entries.length} recorded action{entries.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No actions recorded yet. (If you just enabled this, run the database migration first.)</p>
          ) : (
            <div className="divide-y dark:divide-white/10">
              {entries.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className={actionClass(e.action)}>{e.action}</Badge>
                      <span className="truncate text-sm text-slate-700 dark:text-slate-200">{e.detail}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {e.actor}{e.actor_role ? ` · ${e.actor_role}` : ""}
                    </p>
                  </div>
                  <span className="flex-none whitespace-nowrap text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
