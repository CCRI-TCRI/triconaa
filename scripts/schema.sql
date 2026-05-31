-- ============================================================
-- TRICONA Election System - Complete Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Drop existing tables if re-running (order matters for FK)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS election_settings CASCADE;

-- ── Users (voters) ──────────────────────────────────────────
CREATE TABLE users (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   VARCHAR(50)  UNIQUE NOT NULL,
  full_name    VARCHAR(255) NOT NULL,
  class        VARCHAR(50)  NOT NULL,
  voting_code  VARCHAR(50)  UNIQUE NOT NULL,
  face_encoding TEXT,
  has_voted    BOOLEAN DEFAULT FALSE,
  voted_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Positions ────────────────────────────────────────────────
CREATE TABLE positions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  description   TEXT,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Candidates ───────────────────────────────────────────────
CREATE TABLE candidates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  VARCHAR(50)  NOT NULL,
  full_name   VARCHAR(255) NOT NULL,
  class       VARCHAR(50)  NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  manifesto   TEXT,
  photo_url   TEXT,
  vote_count  INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Votes ────────────────────────────────────────────────────
CREATE TABLE votes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES users(id)      ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id  UUID REFERENCES positions(id)  ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, position_id)
);

-- ── Election Settings ────────────────────────────────────────
CREATE TABLE election_settings (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_name          VARCHAR(255) DEFAULT '2025 Prefectorial Elections',
  start_date             DATE,
  end_date               DATE,
  is_active              BOOLEAN DEFAULT TRUE,
  allow_face_recognition BOOLEAN DEFAULT FALSE,
  require_biometric      BOOLEAN DEFAULT FALSE,
  max_votes_per_user     INTEGER DEFAULT 1,
  show_results_live      BOOLEAN DEFAULT FALSE,
  enable_tutorial        BOOLEAN DEFAULT TRUE,
  seasonal_theme         VARCHAR(50) DEFAULT 'default',
  custom_greeting        TEXT,
  holiday_popups_enabled BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_users_student_id   ON users(student_id);
CREATE INDEX idx_users_voting_code  ON users(voting_code);
CREATE INDEX idx_users_has_voted    ON users(has_voted);
CREATE INDEX idx_candidates_pos     ON candidates(position_id);
CREATE INDEX idx_votes_user         ON votes(user_id);
CREATE INDEX idx_votes_candidate    ON votes(candidate_id);
CREATE INDEX idx_votes_position     ON votes(position_id);
CREATE INDEX idx_votes_created      ON votes(created_at);

-- ── increment_vote_count RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION increment_vote_count(candidate_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE candidates SET vote_count = vote_count + 1 WHERE id = candidate_id;
END;
$$;

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON election_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (school intranet – no public internet exposure)
CREATE POLICY "anon_all_users"      ON users             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_positions"  ON positions         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_candidates" ON candidates        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_votes"      ON votes             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_settings"   ON election_settings FOR ALL USING (true) WITH CHECK (true);

-- ── Default election settings row ────────────────────────────
INSERT INTO election_settings (
  election_name, start_date, end_date, is_active,
  allow_face_recognition, require_biometric, max_votes_per_user,
  show_results_live, enable_tutorial, seasonal_theme, holiday_popups_enabled
) VALUES (
  '2025 Lubiri Prefectorial Elections',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  true, false, false, 1, false, true, 'default', true
);

-- ── Sample positions (edit as needed) ────────────────────────
INSERT INTO positions (name, category, description, display_order, is_active) VALUES
('Head Boy',           'Senior Prefects', 'Overall male student leader',              1, true),
('Head Girl',          'Senior Prefects', 'Overall female student leader',            2, true),
('Deputy Head Boy',    'Senior Prefects', 'Deputy male student leader',              3, true),
('Deputy Head Girl',   'Senior Prefects', 'Deputy female student leader',            4, true),
('Games Captain Boy',  'Games & Sports',  'Male sports captain',                     5, true),
('Games Captain Girl', 'Games & Sports',  'Female sports captain',                   6, true),
('Entertainment Prefect', 'Entertainment','Organises school entertainment events',   7, true);
