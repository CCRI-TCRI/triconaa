// Supabase database layer — replaces lib/local-storage.ts
import { supabase } from "@/lib/supabase"
import type { User, Candidate, Position, Vote } from "@/lib/supabase"

export type { User, Candidate, Position, Vote }

// PostgREST returns at most ~1000 rows per request, so a plain .select("*")
// silently truncates large tables (the votes table in particular). This pages
// through every row with .range(). Rows are pulled oldest-first so that votes
// being inserted during live polling only ever extend the final page (stable
// pagination — no skipped or duplicated rows), then reversed to preserve the
// previous newest-first ordering callers saw.
const PAGE_SIZE = 1000
async function fetchAllRows<T>(table: string): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) { console.error(`fetchAllRows(${table}):`, error.message); break }
    const batch = (data ?? []) as T[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  all.reverse()
  return all
}

// ── Audit log ─────────────────────────────────────────────────
// Append-only record of admin actions. Never throws — auditing must not break
// the action it records. No-ops gracefully if the table isn't provisioned yet.

function currentActor(): { actor: string; role: string } {
  try {
    return {
      actor: localStorage.getItem("tricona_admin_name") || "Administrator",
      role: localStorage.getItem("tricona_admin_role") || "admin",
    }
  } catch {
    return { actor: "system", role: "system" }
  }
}

export interface AuditEntry {
  id: string
  actor: string | null
  actor_role: string | null
  action: string
  detail: string | null
  created_at: string
}

export const auditDb = {
  log: async (action: string, detail?: string): Promise<void> => {
    try {
      const { actor, role } = currentActor()
      await supabase.from("audit_logs").insert([{ actor, actor_role: role, action, detail: detail ?? null }])
    } catch {
      /* auditing must never break the underlying action */
    }
  },
  list: async (limit = 300): Promise<AuditEntry[]> => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) { console.error("auditDb.list:", error.message); return [] }
    return (data ?? []) as AuditEntry[]
  },
}

// ── Users ─────────────────────────────────────────────────────

export const userDb = {
  getAll: async (): Promise<User[]> => fetchAllRows<User>("users"),

  // Device / session lock: register an active voting session for a code. Returns
  // ok:false if the code already has a live session on another device (within the
  // lock window) and hasn't voted. Degrades to allow if the columns don't exist.
  startSession: async (id: string, existingToken?: string): Promise<{ ok: boolean; token: string; reason?: "in_use" | "voted" }> => {
    const token = existingToken || Math.random().toString(36).slice(2) + Date.now().toString(36)
    const LOCK_MS = 8 * 60_000
    const { data } = await supabase.from("users").select("has_voted, session_token, session_at").eq("id", id).maybeSingle()
    if (data?.has_voted) return { ok: false, token, reason: "voted" }
    // Active session on another device (different token, within the lock window) blocks reuse.
    if (data?.session_at && data.session_token && data.session_token !== existingToken) {
      const age = Date.now() - new Date(data.session_at).getTime()
      if (age < LOCK_MS) return { ok: false, token, reason: "in_use" }
    }
    const { error } = await supabase.from("users").update({ session_token: token, session_at: new Date().toISOString() }).eq("id", id)
    if (error) return { ok: true, token } // columns missing → don't block voting
    return { ok: true, token }
  },

  clearSession: async (id: string): Promise<void> => {
    try { await supabase.from("users").update({ session_token: null, session_at: null }).eq("id", id) } catch { /* ignore */ }
  },

  getById: async (id: string): Promise<User | null> => {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single()
    if (error) return null
    return data
  },

  getByVotingCode: async (votingCode: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("voting_code", votingCode.toUpperCase())
      .single()
    if (error) return null
    return data
  },

  // Marks the voter done and issues a receipt code (no link to their choices).
  // Returns the receipt so the voter can be shown proof they voted.
  markAsVoted: async (id: string): Promise<string> => {
    const receipt = "RC-" + Math.random().toString(36).slice(2, 8).toUpperCase()
    const full = await supabase
      .from("users")
      .update({ has_voted: true, voted_at: new Date().toISOString(), receipt_code: receipt, session_token: null, session_at: null })
      .eq("id", id)
    if (full.error) {
      // receipt_code / session columns may not exist yet — fall back to core fields.
      await supabase.from("users").update({ has_voted: true, voted_at: new Date().toISOString() }).eq("id", id)
    }
    return receipt
  },

  // Reset every voter's has_voted flag (used by the admin "Reset System" action)
  resetAllVotes: async (): Promise<boolean> => {
    const { error } = await supabase
      .from("users")
      .update({ has_voted: false, voted_at: null })
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (error) { console.error("userDb.resetAllVotes:", error.message); return false }
    await auditDb.log("votes.reset", "Reset all voters' has_voted flags")
    return true
  },

  // Store (or clear) a voter's face descriptor for facial recognition login
  setFaceEncoding: async (id: string, encoding: string | null): Promise<boolean> => {
    const { error } = await supabase.from("users").update({ face_encoding: encoding }).eq("id", id)
    if (error) { console.error("userDb.setFaceEncoding:", error.message); return false }
    return true
  },
}

// ── Candidates ────────────────────────────────────────────────

export const candidateDb = {
  getAll: async (): Promise<Candidate[]> => fetchAllRows<Candidate>("candidates"),

  getByPosition: async (positionId: string): Promise<Candidate[]> => {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("position_id", positionId)
      .eq("is_approved", true)
    if (error) return []
    return data ?? []
  },

  create: async (candidate: Omit<Candidate, "id" | "created_at" | "vote_count" | "is_approved">): Promise<Candidate | null> => {
    const { data, error } = await supabase
      .from("candidates")
      .insert([{ ...candidate, vote_count: 0, is_approved: true }])
      .select()
      .single()
    if (error) { console.error("candidateDb.create:", error.message); return null }
    await auditDb.log("candidate.create", `Added candidate "${data.full_name}"`)
    return data
  },

  update: async (id: string, updates: Partial<Candidate>): Promise<Candidate | null> => {
    const { data, error } = await supabase.from("candidates").update(updates).eq("id", id).select().single()
    if (error) { console.error("candidateDb.update:", error.message); return null }
    await auditDb.log("candidate.update", `Edited candidate "${data.full_name}"`)
    return data
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("candidates").delete().eq("id", id)
    if (error) { console.error("candidateDb.delete:", error.message); return false }
    await auditDb.log("candidate.delete", `Deleted candidate ${id}`)
    return true
  },

  // Bulk create candidates (used by the CSV/Excel import on the candidates page).
  createBatch: async (rows: Array<Omit<Candidate, "id" | "created_at" | "vote_count" | "is_approved">>): Promise<number> => {
    if (rows.length === 0) return 0
    const payload = rows.map((r) => ({ ...r, vote_count: 0, is_approved: true }))
    const { data, error } = await supabase.from("candidates").insert(payload).select("id")
    if (error) { console.error("candidateDb.createBatch:", error.message); return 0 }
    const n = data?.length ?? 0
    await auditDb.log("candidate.import", `Imported ${n} candidates`)
    return n
  },
}

// ── Positions ─────────────────────────────────────────────────

export const positionDb = {
  getAll: async (): Promise<Position[]> => {
    const { data, error } = await supabase.from("positions").select("*").order("display_order", { ascending: true })
    if (error) { console.error("positionDb.getAll:", error.message); return [] }
    return data ?? []
  },

  getActive: async (): Promise<Position[]> => {
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
    if (error) return []
    return data ?? []
  },

  create: async (position: Omit<Position, "id" | "created_at">): Promise<Position | null> => {
    const { data, error } = await supabase.from("positions").insert([position]).select().single()
    if (error) { console.error("positionDb.create:", error.message); return null }
    await auditDb.log("position.create", `Added position "${data.name}"`)
    return data
  },

  update: async (id: string, updates: Partial<Position>): Promise<Position | null> => {
    const { data, error } = await supabase.from("positions").update(updates).eq("id", id).select().single()
    if (error) { console.error("positionDb.update:", error.message); return null }
    await auditDb.log("position.update", `Edited position "${data.name}"`)
    return data
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("positions").delete().eq("id", id)
    if (error) { console.error("positionDb.delete:", error.message); return false }
    await auditDb.log("position.delete", `Deleted position ${id}`)
    return true
  },
}

// ── Votes ─────────────────────────────────────────────────────

export const voteDb = {
  getAll: async (): Promise<Vote[]> => fetchAllRows<Vote>("votes"),

  createBatch: async (votes: Array<{ user_id: string; candidate_id: string | null; position_id: string; is_abstain?: boolean }>): Promise<boolean> => {
    let { error } = await supabase.from("votes").insert(votes)
    if (error) {
      // is_abstain column / nullable candidate_id may not exist yet — retry with
      // only real (non-abstain) selections stripped of the extra field.
      const fallback = votes.filter((v) => v.candidate_id).map((v) => ({ user_id: v.user_id, candidate_id: v.candidate_id, position_id: v.position_id }))
      if (fallback.length === 0) return true
      const retry = await supabase.from("votes").insert(fallback)
      if (retry.error) { console.error("voteDb.createBatch:", retry.error.message); return false }
      error = null
    }
    // Increment vote counts (abstentions have no candidate)
    for (const vote of votes) {
      if (vote.candidate_id) await supabase.rpc("increment_vote_count", { candidate_id: vote.candidate_id })
    }
    return true
  },

  getByPosition: async (positionId: string): Promise<Vote[]> => {
    const { data, error } = await supabase.from("votes").select("*").eq("position_id", positionId)
    if (error) { console.error("voteDb.getByPosition:", error.message); return [] }
    return data ?? []
  },

  // Delete all cast votes and reset candidate tallies (admin "Reset System" action)
  deleteAll: async (): Promise<boolean> => {
    const { error: votesErr } = await supabase
      .from("votes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (votesErr) { console.error("voteDb.deleteAll votes:", votesErr.message); return false }

    const { error: candErr } = await supabase
      .from("candidates")
      .update({ vote_count: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (candErr) { console.error("voteDb.deleteAll candidates:", candErr.message); return false }

    await auditDb.log("votes.delete_all", "Deleted all votes and reset tallies")
    return true
  },
}

// ── Positions with candidates (for voting ballot) ─────────────

export async function getPositionsWithCandidates(): Promise<Array<Position & { candidates: Candidate[] }>> {
  const [{ data: positions, error: posErr }, { data: candidates, error: candErr }] = await Promise.all([
    supabase.from("positions").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("candidates").select("*").eq("is_approved", true),
  ])

  if (posErr) { console.error("getPositionsWithCandidates positions:", posErr.message); return [] }

  return (positions ?? []).map((position) => ({
    ...position,
    candidates: (candidates ?? []).filter((c) => c.position_id === position.id),
  }))
}

// ── Election control (status + term) ──────────────────────────

export type ElectionStatus = "active" | "paused" | "stopped" | "completed"

export interface CertificationState {
  certified: boolean
  chair: string | null
  head: string | null
  at: string | null
}

export const electionControl = {
  get: async (): Promise<{
    status: ElectionStatus
    rawStatus: ElectionStatus
    term: string
    includeUnopposed: boolean
    anonCodesEnabled: boolean
    openAt: string | null
    closeAt: string | null
    certification: CertificationState
  }> => {
    // Resilient to optional columns not existing yet: try the widest select,
    // then a narrower one, then the core columns.
    let data: any = null
    for (const cols of [
      "election_status, election_term, include_unopposed, anon_codes_enabled, open_at, close_at, results_certified, certified_chair, certified_head, certified_at",
      "election_status, election_term, include_unopposed, anon_codes_enabled",
      "election_status, election_term",
    ]) {
      const r = await supabase.from("election_settings").select(cols).limit(1).single()
      if (!r.error) { data = r.data; break }
    }
    const rawStatus = (data?.election_status as ElectionStatus) || "active"
    const openAt = data?.open_at || null
    const closeAt = data?.close_at || null

    // Scheduled open/close: derive the effective status from the time window.
    let status = rawStatus
    const now = Date.now()
    if (openAt && now < new Date(openAt).getTime()) status = "stopped"        // not open yet
    else if (closeAt && now > new Date(closeAt).getTime()) status = "stopped" // closed

    return {
      status,
      rawStatus,
      term: data?.election_term || "2027 democratic term",
      includeUnopposed: !!data?.include_unopposed,
      anonCodesEnabled: !!data?.anon_codes_enabled,
      openAt,
      closeAt,
      certification: {
        certified: !!data?.results_certified,
        chair: data?.certified_chair || null,
        head: data?.certified_head || null,
        at: data?.certified_at || null,
      },
    }
  },

  setStatus: async (status: ElectionStatus): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ election_status: status }).eq("id", row.id)
    if (error) { console.error("electionControl.setStatus:", error.message); return false }
    await auditDb.log("election.status", `Election status set to "${status}"`)
    return true
  },

  // Scheduled open/close window. Pass null to clear a bound.
  setSchedule: async (openAt: string | null, closeAt: string | null): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ open_at: openAt, close_at: closeAt }).eq("id", row.id)
    if (error) { console.error("electionControl.setSchedule:", error.message); return false }
    await auditDb.log("election.schedule", `Schedule set — open: ${openAt || "—"}, close: ${closeAt || "—"}`)
    return true
  },

  // Results certification: chairperson and head teacher each sign their slot.
  // When both have signed, results become certified.
  certify: async (slot: "chair" | "head", name: string): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id, certified_chair, certified_head").limit(1).single()
    if (!row) return false
    const patch: Record<string, unknown> = slot === "chair" ? { certified_chair: name } : { certified_head: name }
    const chair = slot === "chair" ? name : row.certified_chair
    const head = slot === "head" ? name : row.certified_head
    if (chair && head) { patch.results_certified = true; patch.certified_at = new Date().toISOString() }
    const { error } = await supabase.from("election_settings").update(patch).eq("id", row.id)
    if (error) { console.error("electionControl.certify:", error.message); return false }
    await auditDb.log("results.certify", `${slot === "chair" ? "Chairperson" : "Head teacher"} (${name}) signed the results`)
    return true
  },

  resetCertification: async (): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ results_certified: false, certified_chair: null, certified_head: null, certified_at: null }).eq("id", row.id)
    if (error) { console.error("electionControl.resetCertification:", error.message); return false }
    await auditDb.log("results.certify_reset", "Certification reset")
    return true
  },

  // Whether single-candidate (unopposed) positions appear on the ballot.
  setIncludeUnopposed: async (on: boolean): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ include_unopposed: on }).eq("id", row.id)
    if (error) { console.error("electionControl.setIncludeUnopposed:", error.message); return false }
    await auditDb.log("ballot.include_unopposed", `Unopposed on ballot: ${on ? "on" : "off"}`)
    return true
  },

  // Whether the anonymous voting-codes feature is enabled.
  setAnonCodesEnabled: async (on: boolean): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ anon_codes_enabled: on }).eq("id", row.id)
    if (error) { console.error("electionControl.setAnonCodesEnabled:", error.message); return false }
    await auditDb.log("settings.anon_codes", `Anonymous voting codes: ${on ? "enabled" : "disabled"}`)
    return true
  },
}

// ── Emergency / voice-code broadcast ──────────────────────────

export type AnnounceCode = "3" | "5" | "7" | "9"

export interface BroadcastState {
  code: AnnounceCode | null
  announceAt: string | null
  lockdown: boolean
  code5Interval: number
}

export const broadcastDb = {
  get: async (): Promise<BroadcastState> => {
    const { data } = await supabase
      .from("election_settings")
      .select("announce_code, announce_at, lockdown, code5_interval")
      .limit(1)
      .single()
    return {
      code: (data?.announce_code as AnnounceCode) || null,
      announceAt: data?.announce_at || null,
      lockdown: !!data?.lockdown,
      code5Interval: data?.code5_interval ?? 0,
    }
  },

  // Trigger a code: bumps announce_at so listeners play the audio + show the banner
  trigger: async (code: AnnounceCode): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase
      .from("election_settings")
      .update({ announce_code: code, announce_at: new Date().toISOString() })
      .eq("id", row.id)
    if (error) { console.error("broadcastDb.trigger:", error.message); return false }
    return true
  },

  setLockdown: async (on: boolean): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const update = on
      ? { lockdown: true, announce_code: "7", announce_at: new Date().toISOString() }
      : { lockdown: false }
    const { error } = await supabase.from("election_settings").update(update).eq("id", row.id)
    if (error) { console.error("broadcastDb.setLockdown:", error.message); return false }
    return true
  },

  setCode5Interval: async (minutes: number): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ code5_interval: minutes }).eq("id", row.id)
    if (error) { console.error("broadcastDb.setCode5Interval:", error.message); return false }
    return true
  },
}

// ── Admin accounts & roles ────────────────────────────────────

export type AdminRole = "admin" | "chairperson" | "headteacher"

export interface AdminAccount {
  id: string
  username: string
  role: AdminRole
  full_name: string | null
  created_at?: string
}

export const accountDb = {
  // Validate a login. Returns the account (without password) or null.
  authenticate: async (username: string, password: string): Promise<AdminAccount | null> => {
    const uname = username.trim()
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("id, username, role, full_name, password")
      .eq("username", uname)
      .limit(1)
      .maybeSingle()
    if (!error && data && data.password === password) {
      return { id: data.id, username: data.username, role: data.role as AdminRole, full_name: data.full_name }
    }
    // Built-in administrator fallback — guarantees the admin is never locked out,
    // and covers the window before the admin_accounts table is provisioned.
    if (uname === "admin" && password === "Lavender") {
      return { id: "builtin-admin", username: "admin", role: "admin", full_name: "Administrator" }
    }
    return null
  },

  list: async (): Promise<AdminAccount[]> => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("id, username, role, full_name, created_at")
      .order("created_at", { ascending: true })
    if (error) { console.error("accountDb.list:", error.message); return [] }
    return (data ?? []) as AdminAccount[]
  },

  create: async (account: { username: string; password: string; role: AdminRole; full_name?: string; securityQuestion?: string; securityAnswer?: string }): Promise<AdminAccount | null> => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .insert([{
        username: account.username.trim(),
        password: account.password,
        role: account.role,
        full_name: account.full_name?.trim() || null,
        security_question: account.securityQuestion || null,
        security_answer: account.securityAnswer || null,
      }])
      .select("id, username, role, full_name, created_at")
      .single()
    if (error) { console.error("accountDb.create:", error.message); return null }
    await auditDb.log("account.create", `Created ${account.role} account "${account.username}"`)
    return data as AdminAccount
  },

  update: async (id: string, updates: { password?: string; role?: AdminRole; full_name?: string; securityQuestion?: string; securityAnswer?: string }): Promise<boolean> => {
    const patch: Record<string, unknown> = {}
    if (updates.password) patch.password = updates.password
    if (updates.role) patch.role = updates.role
    if (updates.full_name !== undefined) patch.full_name = updates.full_name?.trim() || null
    if (updates.securityQuestion !== undefined) patch.security_question = updates.securityQuestion || null
    if (updates.securityAnswer !== undefined) patch.security_answer = updates.securityAnswer || null
    if (Object.keys(patch).length === 0) return true
    const { error } = await supabase.from("admin_accounts").update(patch).eq("id", id)
    if (error) { console.error("accountDb.update:", error.message); return false }
    await auditDb.log("account.update", `Updated account ${id}`)
    return true
  },

  remove: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("admin_accounts").delete().eq("id", id)
    if (error) { console.error("accountDb.remove:", error.message); return false }
    await auditDb.log("account.delete", `Deleted account ${id}`)
    return true
  },

  // Self-service password reset via security question.
  getSecurityQuestion: async (username: string): Promise<string | null> => {
    const { data } = await supabase.from("admin_accounts").select("security_question").eq("username", username.trim()).maybeSingle()
    return data?.security_question || null
  },

  resetPassword: async (username: string, answer: string, newPassword: string): Promise<boolean> => {
    const { data } = await supabase.from("admin_accounts").select("id, security_answer").eq("username", username.trim()).maybeSingle()
    if (!data || !data.security_answer) return false
    if (data.security_answer.trim().toLowerCase() !== answer.trim().toLowerCase()) return false
    const { error } = await supabase.from("admin_accounts").update({ password: newPassword }).eq("id", data.id)
    if (error) { console.error("accountDb.resetPassword:", error.message); return false }
    await auditDb.log("account.password_reset", `Password reset for "${username}"`)
    return true
  },
}

// ── Anonymous voting codes ────────────────────────────────────
// Creates voter rows that aren't tied to a real student — the code itself is the
// identity. Still backed by users rows so has_voted / vote integrity work normally.

const randomCode = () => "VT" + Math.random().toString(36).substring(2, 8).toUpperCase()

export async function createAnonymousVoters(count: number, prefix = "Voter"): Promise<{ student_id: string; voting_code: string; full_name: string }[]> {
  const n = Math.min(1000, Math.max(1, Math.floor(count)))
  // Avoid colliding with existing codes
  const existing = await fetchAllRows<User>("users")
  const usedCodes = new Set(existing.map((u) => u.voting_code))
  const usedIds = new Set(existing.map((u) => u.student_id))
  const stamp = Date.now().toString(36).toUpperCase().slice(-4)

  const rows: { student_id: string; full_name: string; class: string; voting_code: string; has_voted: boolean; is_anonymous: boolean; created_at: string }[] = []
  for (let i = 0; i < n; i++) {
    let code = randomCode()
    while (usedCodes.has(code)) code = randomCode()
    usedCodes.add(code)
    let sid = `ANON-${stamp}-${String(i + 1).padStart(4, "0")}`
    while (usedIds.has(sid)) sid = `ANON-${stamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    usedIds.add(sid)
    rows.push({
      student_id: sid,
      full_name: `${prefix} ${i + 1}`,
      class: "—",
      voting_code: code,
      has_voted: false,
      is_anonymous: true,
      created_at: new Date().toISOString(),
    })
  }

  const { error } = await supabase.from("users").insert(rows)
  if (error) { console.error("createAnonymousVoters:", error.message); throw new Error(error.message) }
  await auditDb.log("codes.generate", `Generated ${rows.length} anonymous voting codes`)
  return rows.map((r) => ({ student_id: r.student_id, voting_code: r.voting_code, full_name: r.full_name }))
}

// ── Historical elections archive ──────────────────────────────

export interface ElectionArchive {
  id: string
  title: string
  term: string | null
  snapshot: any
  total_votes: number | null
  turnout: number | null
  created_at: string
}

export const archiveDb = {
  list: async (): Promise<ElectionArchive[]> => {
    const { data, error } = await supabase.from("election_archives").select("*").order("created_at", { ascending: false })
    if (error) { console.error("archiveDb.list:", error.message); return [] }
    return (data ?? []) as ElectionArchive[]
  },

  create: async (title: string, term: string, snapshot: any, totalVotes: number, turnout: number): Promise<boolean> => {
    const { error } = await supabase.from("election_archives").insert([{ title, term, snapshot, total_votes: totalVotes, turnout }])
    if (error) { console.error("archiveDb.create:", error.message); return false }
    await auditDb.log("archive.create", `Archived election "${title}"`)
    return true
  },

  remove: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("election_archives").delete().eq("id", id)
    if (error) { console.error("archiveDb.remove:", error.message); return false }
    await auditDb.log("archive.delete", `Deleted archive ${id}`)
    return true
  },
}
