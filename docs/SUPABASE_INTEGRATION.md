# Supabase Integration Documentation

This document provides comprehensive instructions for integrating Supabase into the Election System application. The system is currently running on local storage, and this guide will help you migrate to Supabase when ready.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Database Schema](#database-schema)
4. [Environment Variables](#environment-variables)
5. [Migration Steps](#migration-steps)
6. [Code Changes Required](#code-changes-required)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm/pnpm installed
- Basic understanding of SQL and database concepts

## Supabase Setup

### 1. Create a New Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: Election System (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier

### 2. Get Your Project Credentials

After creating the project:
1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Long string starting with `eyJ...`
   - **service_role key**: (Keep this secret! Only for server-side)

## Database Schema

Run the following SQL in the Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Voters)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  class TEXT,
  voting_code TEXT UNIQUE NOT NULL,
  face_encoding TEXT,
  has_voted BOOLEAN DEFAULT FALSE,
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Election Categories Table
CREATE TABLE election_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Positions Table
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES election_categories(id),
  category TEXT NOT NULL,
  max_candidates INTEGER DEFAULT 5,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates Table
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  class TEXT NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  manifesto TEXT,
  photo_url TEXT,
  vote_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes Table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  category_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Election Settings Table
CREATE TABLE election_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_name TEXT NOT NULL DEFAULT 'Student Elections',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  allow_face_recognition BOOLEAN DEFAULT FALSE,
  require_biometric BOOLEAN DEFAULT FALSE,
  max_votes_per_user INTEGER DEFAULT 10,
  show_results_live BOOLEAN DEFAULT TRUE,
  enable_tutorial BOOLEAN DEFAULT TRUE,
  seasonal_theme TEXT DEFAULT 'default',
  custom_greeting TEXT,
  holiday_popups_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_voting_code ON users(voting_code);
CREATE INDEX idx_users_has_voted ON users(has_voted);
CREATE INDEX idx_candidates_position_id ON candidates(position_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_candidate_id ON votes(candidate_id);
CREATE INDEX idx_votes_position_id ON votes(position_id);
CREATE INDEX idx_votes_created_at ON votes(created_at);

-- Function to update vote_count in candidates
CREATE OR REPLACE FUNCTION update_candidate_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE candidates
    SET vote_count = vote_count + 1
    WHERE id = NEW.candidate_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE candidates
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = OLD.candidate_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update vote counts
CREATE TRIGGER trigger_update_vote_count
AFTER INSERT OR DELETE ON votes
FOR EACH ROW
EXECUTE FUNCTION update_candidate_vote_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_election_settings_updated_at BEFORE UPDATE ON election_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to active positions and candidates
CREATE POLICY "Public can view active positions"
ON positions FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Public can view approved candidates"
ON candidates FOR SELECT
USING (is_approved = TRUE);

-- Policy: Allow authenticated users to insert votes
CREATE POLICY "Users can insert their own votes"
ON votes FOR INSERT
WITH CHECK (true);

-- Policy: Allow public read access to election settings
CREATE POLICY "Public can view election settings"
ON election_settings FOR SELECT
USING (true);

-- Policy: Allow service role full access (for admin operations)
-- Note: This is handled via service_role key, not RLS policies
```

## Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Never commit `.env.local` to version control. Add it to `.gitignore`.

## Migration Steps

### Step 1: Install Supabase Client

The package is already installed. If not:

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

### Step 2: Update lib/supabase.ts

The file already exists. Ensure it has:

```typescript
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (already defined)
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

// ... other types
```

### Step 3: Replace Local Storage with Supabase

For each component that uses local storage:

1. **Import Supabase**:
   ```typescript
   import { supabase } from "@/lib/supabase"
   ```

2. **Replace Storage Calls**:

   **Before (Local Storage)**:
   ```typescript
   const users = userStorage.getAll()
   ```

   **After (Supabase)**:
   ```typescript
   const { data: users, error } = await supabase
     .from("users")
     .select("*")
   ```

3. **Handle Errors**:
   ```typescript
   if (error) {
     console.error("Error fetching users:", error)
     return []
   }
   return users || []
   ```

### Step 4: Update Specific Functions

#### User Operations

**Create User**:
```typescript
const { data, error } = await supabase
  .from("users")
  .insert([{
    student_id: "LSS001",
    full_name: "John Doe",
    class: "S6A",
    voting_code: "VOTE001",
    has_voted: false
  }])
  .select()
  .single()
```

**Update User**:
```typescript
const { data, error } = await supabase
  .from("users")
  .update({ has_voted: true, voted_at: new Date().toISOString() })
  .eq("id", userId)
  .select()
  .single()
```

**Get User by Token**:
```typescript
const { data: user, error } = await supabase
  .from("users")
  .select("*")
  .eq("voting_code", token)
  .single()
```

#### Candidate Operations

**Get Candidates by Position**:
```typescript
const { data: candidates, error } = await supabase
  .from("candidates")
  .select("*")
  .eq("position_id", positionId)
  .eq("is_approved", true)
```

**Create Candidate**:
```typescript
const { data, error } = await supabase
  .from("candidates")
  .insert([{
    student_id: "LSS002",
    full_name: "Jane Smith",
    class: "S6B",
    position_id: positionId,
    manifesto: "I will work for better facilities..."
  }])
  .select()
  .single()
```

#### Vote Operations

**Submit Votes**:
```typescript
const voteRecords = positions.map(position => ({
  user_id: userId,
  candidate_id: selectedCandidateId,
  position_id: position.id
}))

const { error } = await supabase
  .from("votes")
  .insert(voteRecords)
```

**Get Vote Counts**:
```typescript
const { count, error } = await supabase
  .from("votes")
  .select("*", { count: "exact", head: true })
  .eq("candidate_id", candidateId)
```

#### Positions with Candidates

```typescript
const { data: positions, error } = await supabase
  .from("positions")
  .select(`
    *,
    candidates (*)
  `)
  .eq("is_active", true)
  .eq("candidates.is_approved", true)
  .order("display_order")
```

### Step 5: Real-time Subscriptions

For live updates:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("votes")
    .on("postgres_changes", 
      { event: "INSERT", schema: "public", table: "votes" },
      (payload) => {
        console.log("New vote:", payload)
        // Update UI
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

## Code Changes Required

### Files to Update

1. **lib/local-storage.ts** → Keep for reference, but replace calls
2. **components/biometric-auth.tsx** → Replace `userStorage` with Supabase
3. **components/voting-ballot.tsx** → Replace all storage calls
4. **app/page.tsx** → Update user fetching
5. **app/admin/dashboard/page.tsx** → Already updated (check if needed)
6. **app/admin/candidates/page.tsx** → Replace storage calls
7. **app/admin/voters/page.tsx** → Replace storage calls
8. **app/admin/votes/page.tsx** → Replace storage calls
9. **app/admin/live-results/page.tsx** → Replace storage calls
10. **app/admin/analytics/page.tsx** → Replace storage calls
11. **app/admin/reports/page.tsx** → Replace storage calls
12. **app/admin/control/page.tsx** → Replace storage calls
13. **app/admin/settings/page.tsx** → Replace storage calls
14. **app/admin/results/page.tsx** → Replace storage calls

### Example Migration Pattern

**Before**:
```typescript
// Local Storage
const users = userStorage.getAll()
const user = userStorage.getByToken(token)
userStorage.create({ token, full_name })
userStorage.markAsVoted(userId)
```

**After**:
```typescript
// Supabase
const { data: users } = await supabase.from("users").select("*")
const { data: user } = await supabase
  .from("users")
  .select("*")
  .eq("voting_code", token)
  .single()

const { data: newUser } = await supabase
  .from("users")
  .insert([{ voting_code: token, full_name }])
  .select()
  .single()

await supabase
  .from("users")
  .update({ has_voted: true, voted_at: new Date().toISOString() })
  .eq("id", userId)
```

## Testing

### 1. Test Database Connection

```typescript
const { data, error } = await supabase.from("users").select("count", { count: "exact", head: true })
if (error) console.error("Connection failed:", error)
else console.log("Connected! User count:", data)
```

### 2. Test CRUD Operations

- Create a test user
- Read users
- Update user
- Delete user (if needed)

### 3. Test Voting Flow

1. Create test positions
2. Create test candidates
3. Create test user
4. Submit votes
5. Verify vote counts update

### 4. Test Real-time Updates

Open two browser windows and verify updates appear in real-time.

## Troubleshooting

### Common Issues

1. **"Invalid API key"**
   - Check `.env.local` has correct keys
   - Restart dev server after adding env vars

2. **"Row Level Security policy violation"**
   - Check RLS policies in Supabase dashboard
   - Ensure policies allow your operations

3. **"Relation does not exist"**
   - Run the SQL schema in Supabase SQL Editor
   - Check table names match exactly

4. **"Connection timeout"**
   - Check internet connection
   - Verify Supabase project is active
   - Check region selection

5. **"Vote counts not updating"**
   - Verify trigger is created
   - Check trigger function is correct
   - Manually refresh candidate vote_count if needed

### Debugging Tips

1. Enable Supabase logging in dashboard
2. Use browser DevTools Network tab
3. Check Supabase dashboard → Logs
4. Add console.logs for error handling
5. Test queries in Supabase SQL Editor first

## Security Best Practices

1. **Never expose service_role key** in client-side code
2. **Use RLS policies** to restrict data access
3. **Validate input** before database operations
4. **Use prepared statements** (Supabase handles this)
5. **Rate limiting** - Consider implementing for vote submissions
6. **Backup regularly** - Use Supabase backup features

## Performance Optimization

1. **Add indexes** for frequently queried columns
2. **Use select()** to fetch only needed columns
3. **Implement pagination** for large datasets
4. **Cache frequently accessed data**
5. **Use real-time subscriptions** sparingly

## Migration Checklist

- [ ] Create Supabase project
- [ ] Run database schema SQL
- [ ] Set up environment variables
- [ ] Test database connection
- [ ] Update lib/supabase.ts
- [ ] Replace userStorage calls
- [ ] Replace candidateStorage calls
- [ ] Replace positionStorage calls
- [ ] Replace voteStorage calls
- [ ] Update admin pages
- [ ] Update voting components
- [ ] Test voting flow
- [ ] Test admin operations
- [ ] Test real-time updates
- [ ] Deploy and test production

## Support

For issues:
1. Check Supabase documentation: https://supabase.com/docs
2. Check Supabase Discord community
3. Review error messages in browser console
4. Check Supabase dashboard logs

---

**Note**: This system is currently running on local storage. When ready to go online, follow this documentation to migrate to Supabase. All data will need to be exported from localStorage and imported into Supabase.
