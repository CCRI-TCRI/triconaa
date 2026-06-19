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

// ── Users ─────────────────────────────────────────────────────

export const userDb = {
  getAll: async (): Promise<User[]> => fetchAllRows<User>("users"),

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

  markAsVoted: async (id: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .update({ has_voted: true, voted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) { console.error("userDb.markAsVoted:", error.message); return null }
    return data
  },

  // Reset every voter's has_voted flag (used by the admin "Reset System" action)
  resetAllVotes: async (): Promise<boolean> => {
    const { error } = await supabase
      .from("users")
      .update({ has_voted: false, voted_at: null })
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (error) { console.error("userDb.resetAllVotes:", error.message); return false }
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
    return data
  },

  update: async (id: string, updates: Partial<Candidate>): Promise<Candidate | null> => {
    const { data, error } = await supabase.from("candidates").update(updates).eq("id", id).select().single()
    if (error) { console.error("candidateDb.update:", error.message); return null }
    return data
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("candidates").delete().eq("id", id)
    if (error) { console.error("candidateDb.delete:", error.message); return false }
    return true
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
    return data
  },

  update: async (id: string, updates: Partial<Position>): Promise<Position | null> => {
    const { data, error } = await supabase.from("positions").update(updates).eq("id", id).select().single()
    if (error) { console.error("positionDb.update:", error.message); return null }
    return data
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("positions").delete().eq("id", id)
    if (error) { console.error("positionDb.delete:", error.message); return false }
    return true
  },
}

// ── Votes ─────────────────────────────────────────────────────

export const voteDb = {
  getAll: async (): Promise<Vote[]> => fetchAllRows<Vote>("votes"),

  createBatch: async (votes: Omit<Vote, "id" | "created_at">[]): Promise<boolean> => {
    const { error } = await supabase.from("votes").insert(votes)
    if (error) { console.error("voteDb.createBatch:", error.message); return false }
    // Increment vote counts
    for (const vote of votes) {
      await supabase.rpc("increment_vote_count", { candidate_id: vote.candidate_id })
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

export const electionControl = {
  get: async (): Promise<{ status: ElectionStatus; term: string; includeUnopposed: boolean; anonCodesEnabled: boolean }> => {
    // Resilient to optional columns not existing yet (e.g. before a migration is
    // applied): fall back to the core columns so status/term always read correctly.
    let data: any = null
    const full = await supabase
      .from("election_settings")
      .select("election_status, election_term, include_unopposed, anon_codes_enabled")
      .limit(1)
      .single()
    if (!full.error) {
      data = full.data
    } else {
      const core = await supabase.from("election_settings").select("election_status, election_term").limit(1).single()
      data = core.data
    }
    return {
      status: (data?.election_status as ElectionStatus) || "active",
      term: data?.election_term || "2027 democratic term",
      includeUnopposed: !!data?.include_unopposed,
      anonCodesEnabled: !!data?.anon_codes_enabled,
    }
  },

  setStatus: async (status: ElectionStatus): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ election_status: status }).eq("id", row.id)
    if (error) { console.error("electionControl.setStatus:", error.message); return false }
    return true
  },

  // Whether single-candidate (unopposed) positions appear on the ballot.
  setIncludeUnopposed: async (on: boolean): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ include_unopposed: on }).eq("id", row.id)
    if (error) { console.error("electionControl.setIncludeUnopposed:", error.message); return false }
    return true
  },

  // Whether the anonymous voting-codes feature is enabled.
  setAnonCodesEnabled: async (on: boolean): Promise<boolean> => {
    const { data: row } = await supabase.from("election_settings").select("id").limit(1).single()
    if (!row) return false
    const { error } = await supabase.from("election_settings").update({ anon_codes_enabled: on }).eq("id", row.id)
    if (error) { console.error("electionControl.setAnonCodesEnabled:", error.message); return false }
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

  create: async (account: { username: string; password: string; role: AdminRole; full_name?: string }): Promise<AdminAccount | null> => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .insert([{ username: account.username.trim(), password: account.password, role: account.role, full_name: account.full_name?.trim() || null }])
      .select("id, username, role, full_name, created_at")
      .single()
    if (error) { console.error("accountDb.create:", error.message); return null }
    return data as AdminAccount
  },

  update: async (id: string, updates: { password?: string; role?: AdminRole; full_name?: string }): Promise<boolean> => {
    const patch: Record<string, unknown> = {}
    if (updates.password) patch.password = updates.password
    if (updates.role) patch.role = updates.role
    if (updates.full_name !== undefined) patch.full_name = updates.full_name?.trim() || null
    if (Object.keys(patch).length === 0) return true
    const { error } = await supabase.from("admin_accounts").update(patch).eq("id", id)
    if (error) { console.error("accountDb.update:", error.message); return false }
    return true
  },

  remove: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("admin_accounts").delete().eq("id", id)
    if (error) { console.error("accountDb.remove:", error.message); return false }
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
  return rows.map((r) => ({ student_id: r.student_id, voting_code: r.voting_code, full_name: r.full_name }))
}
