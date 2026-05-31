import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = () =>
  !!(supabaseUrl && supabaseAnonKey && supabaseUrl.includes("supabase.co"))

export const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error"
  if (typeof error === "string") return error
  if (error.message) return error.message
  return JSON.stringify(error)
}

// ── Shared types ──────────────────────────────────────────────

export interface User {
  id: string
  student_id: string
  full_name: string
  class: string
  voting_code: string
  face_encoding?: string
  has_voted: boolean
  voted_at?: string
  created_at: string
}

export interface Candidate {
  id: string
  student_id: string
  full_name: string
  class: string
  position_id: string
  manifesto: string
  photo_url?: string
  vote_count: number
  is_approved: boolean
  created_at: string
}

export interface Position {
  id: string
  name: string
  category: string
  description: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Vote {
  id: string
  user_id: string
  candidate_id: string
  position_id: string
  created_at: string
}

export interface ElectionSettings {
  id?: string
  election_name: string
  start_date: string
  end_date: string
  is_active: boolean
  allow_face_recognition: boolean
  require_biometric: boolean
  max_votes_per_user: number
  show_results_live: boolean
  enable_tutorial: boolean
  seasonal_theme: string
  custom_greeting: string
  holiday_popups_enabled: boolean
}
