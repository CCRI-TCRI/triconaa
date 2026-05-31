// Supabase database layer — replaces lib/local-storage.ts
import { supabase } from "@/lib/supabase"
import type { User, Candidate, Position, Vote } from "@/lib/supabase"

export type { User, Candidate, Position, Vote }

// ── Users ─────────────────────────────────────────────────────

export const userDb = {
  getAll: async (): Promise<User[]> => {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })
    if (error) { console.error("userDb.getAll:", error.message); return [] }
    return data ?? []
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
}

// ── Candidates ────────────────────────────────────────────────

export const candidateDb = {
  getAll: async (): Promise<Candidate[]> => {
    const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: false })
    if (error) { console.error("candidateDb.getAll:", error.message); return [] }
    return data ?? []
  },

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
  getAll: async (): Promise<Vote[]> => {
    const { data, error } = await supabase.from("votes").select("*").order("created_at", { ascending: false })
    if (error) { console.error("voteDb.getAll:", error.message); return [] }
    return data ?? []
  },

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
