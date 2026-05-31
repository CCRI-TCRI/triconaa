// Local Storage System - Replaces Supabase
// This manages all election data locally using localStorage

export interface User {
  id: string
  token: string
  full_name: string
  class?: string
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
  created_at: string
}

export interface Position {
  id: string
  name: string
  description: string
  category: string
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

// Storage keys
const STORAGE_KEYS = {
  USERS: "election_users",
  CANDIDATES: "election_candidates",
  POSITIONS: "election_positions",
  VOTES: "election_votes",
  TOKENS: "election_tokens",
  ADMIN_CREDENTIALS: "election_admin_credentials",
}

// Initialize default data if not exists
function initializeDefaultData() {
  if (typeof window === "undefined" || !window.localStorage) return
  
  try {
    // Initialize tokens (100 tokens)
    if (!localStorage.getItem(STORAGE_KEYS.TOKENS)) {
      const tokens: string[] = []
      for (let i = 1; i <= 100; i++) {
        tokens.push(`VOTE${String(i).padStart(3, "0")}`)
      }
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens))
    }

    // Initialize admin credentials
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_CREDENTIALS)) {
      const adminCredentials = {
        username: "admin",
        password: "Lavender",
      }
      localStorage.setItem(STORAGE_KEYS.ADMIN_CREDENTIALS, JSON.stringify(adminCredentials))
    }

    // Initialize empty arrays if they don't exist
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]))
    }
    if (!localStorage.getItem(STORAGE_KEYS.CANDIDATES)) {
      localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify([]))
    }
    if (!localStorage.getItem(STORAGE_KEYS.POSITIONS)) {
      localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify([]))
    }
    if (!localStorage.getItem(STORAGE_KEYS.VOTES)) {
      localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify([]))
    }
  } catch (error) {
    console.error("Error initializing default data:", error)
  }
}

// Initialize on import
if (typeof window !== "undefined") {
  initializeDefaultData()
}

// User operations
export const userStorage = {
  getAll: (): User[] => {
    if (typeof window === "undefined" || !window.localStorage) return []
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error("Error reading users from localStorage:", error)
      return []
    }
  },

  getByToken: (token: string): User | null => {
    const users = userStorage.getAll()
    return users.find((u) => u.token === token.toUpperCase()) || null
  },

  create: (user: Omit<User, "id" | "created_at" | "has_voted">): User => {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new Error("LocalStorage not available")
    }
    const users = userStorage.getAll()
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      has_voted: false,
      created_at: new Date().toISOString(),
    }
    users.push(newUser)
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
    } catch (error) {
      console.error("Error saving user to localStorage:", error)
      throw error
    }
    return newUser
  },

  update: (id: string, updates: Partial<User>): User | null => {
    if (typeof window === "undefined" || !window.localStorage) return null
    try {
      const users = userStorage.getAll()
      const index = users.findIndex((u) => u.id === id)
      if (index === -1) return null
      users[index] = { ...users[index], ...updates }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
      return users[index]
    } catch (error) {
      console.error("Error updating user in localStorage:", error)
      return null
    }
  },

  markAsVoted: (id: string): User | null => {
    return userStorage.update(id, {
      has_voted: true,
      voted_at: new Date().toISOString(),
    })
  },
}

// Token operations
export const tokenStorage = {
  getAll: (): string[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TOKENS)
    return data ? JSON.parse(data) : []
  },

  isAvailable: (token: string): boolean => {
    const users = userStorage.getAll()
    const user = users.find((u) => u.token === token.toUpperCase())
    return !user || !user.has_voted
  },

  isUsed: (token: string): boolean => {
    const users = userStorage.getAll()
    const user = users.find((u) => u.token === token.toUpperCase())
    return user?.has_voted || false
  },
}

// Candidate operations
export const candidateStorage = {
  getAll: (): Candidate[] => {
    if (typeof window === "undefined" || !window.localStorage) return []
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CANDIDATES)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error("Error reading candidates from localStorage:", error)
      return []
    }
  },

  getById: (id: string): Candidate | null => {
    const candidates = candidateStorage.getAll()
    return candidates.find((c) => c.id === id) || null
  },

  getByPosition: (positionId: string): Candidate[] => {
    const candidates = candidateStorage.getAll()
    return candidates.filter((c) => c.position_id === positionId)
  },

  create: (candidate: Omit<Candidate, "id" | "created_at" | "vote_count">): Candidate => {
    const candidates = candidateStorage.getAll()
    const newCandidate: Candidate = {
      ...candidate,
      id: `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vote_count: 0,
      created_at: new Date().toISOString(),
    }
    candidates.push(newCandidate)
    localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(candidates))
    return newCandidate
  },

  update: (id: string, updates: Partial<Candidate>): Candidate | null => {
    const candidates = candidateStorage.getAll()
    const index = candidates.findIndex((c) => c.id === id)
    if (index === -1) return null
    candidates[index] = { ...candidates[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(candidates))
    return candidates[index]
  },

  incrementVote: (id: string): Candidate | null => {
    const candidate = candidateStorage.getById(id)
    if (!candidate) return null
    return candidateStorage.update(id, { vote_count: candidate.vote_count + 1 })
  },

  delete: (id: string): boolean => {
    const candidates = candidateStorage.getAll()
    const filtered = candidates.filter((c) => c.id !== id)
    if (filtered.length === candidates.length) return false
    localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(filtered))
    return true
  },
}

// Position operations
export const positionStorage = {
  getAll: (): Position[] => {
    if (typeof window === "undefined" || !window.localStorage) return []
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POSITIONS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error("Error reading positions from localStorage:", error)
      return []
    }
  },

  getById: (id: string): Position | null => {
    const positions = positionStorage.getAll()
    return positions.find((p) => p.id === id) || null
  },

  getActive: (): Position[] => {
    const positions = positionStorage.getAll()
    return positions.filter((p) => p.is_active).sort((a, b) => a.display_order - b.display_order)
  },

  create: (position: Omit<Position, "id" | "created_at">): Position => {
    const positions = positionStorage.getAll()
    const newPosition: Position = {
      ...position,
      id: `position_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    }
    positions.push(newPosition)
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions))
    return newPosition
  },

  update: (id: string, updates: Partial<Position>): Position | null => {
    const positions = positionStorage.getAll()
    const index = positions.findIndex((p) => p.id === id)
    if (index === -1) return null
    positions[index] = { ...positions[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions))
    return positions[index]
  },
}

// Vote operations
export const voteStorage = {
  getAll: (): Vote[] => {
    if (typeof window === "undefined" || !window.localStorage) return []
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOTES)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error("Error reading votes from localStorage:", error)
      return []
    }
  },

  getByUser: (userId: string): Vote[] => {
    const votes = voteStorage.getAll()
    return votes.filter((v) => v.user_id === userId)
  },

  getByCandidate: (candidateId: string): Vote[] => {
    const votes = voteStorage.getAll()
    return votes.filter((v) => v.candidate_id === candidateId)
  },

  getByPosition: (positionId: string): Vote[] => {
    const votes = voteStorage.getAll()
    return votes.filter((v) => v.position_id === positionId)
  },

  create: (vote: Omit<Vote, "id" | "created_at">): Vote => {
    const votes = voteStorage.getAll()
    const newVote: Vote = {
      ...vote,
      id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    }
    votes.push(newVote)
    localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes))
    
    // Increment candidate vote count
    candidateStorage.incrementVote(vote.candidate_id)
    
    return newVote
  },

  createBatch: (votes: Omit<Vote, "id" | "created_at">[]): Vote[] => {
    const createdVotes: Vote[] = []
    votes.forEach((vote) => {
      createdVotes.push(voteStorage.create(vote))
    })
    return createdVotes
  },
}

// Admin operations
export const adminStorage = {
  verify: (username: string, password: string): boolean => {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_CREDENTIALS)
    if (!data) return false
    const credentials = JSON.parse(data)
    return credentials.username === username && credentials.password === password
  },

  updateCredentials: (username: string, password: string): void => {
    const credentials = { username, password }
    localStorage.setItem(STORAGE_KEYS.ADMIN_CREDENTIALS, JSON.stringify(credentials))
  },
}

// Helper function to get positions with candidates
export function getPositionsWithCandidates(): Array<Position & { candidates: Candidate[] }> {
  if (typeof window === "undefined" || !window.localStorage) return []
  
  try {
    const positions = positionStorage.getActive()
    const candidates = candidateStorage.getAll()
    
    return positions.map((position) => ({
      ...position,
      candidates: candidates.filter((c) => c.position_id === position.id),
    }))
  } catch (error) {
    console.error("Error getting positions with candidates:", error)
    return []
  }
}
