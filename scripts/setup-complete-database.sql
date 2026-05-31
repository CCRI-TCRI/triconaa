-- Create comprehensive database schema for election system

-- Users table (voters)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class VARCHAR(10) NOT NULL,
  voting_code VARCHAR(10) UNIQUE NOT NULL,
  has_voted BOOLEAN DEFAULT FALSE,
  voted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Election categories
CREATE TABLE IF NOT EXISTS election_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  max_candidates INTEGER DEFAULT 10,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class VARCHAR(10) NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  manifesto TEXT,
  photo_url TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, position_id) -- Prevent multiple votes for same position
);

-- Election settings table
CREATE TABLE IF NOT EXISTS election_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_name VARCHAR(255) DEFAULT '2024 Prefectorial Elections',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  allow_face_recognition BOOLEAN DEFAULT TRUE,
  require_biometric BOOLEAN DEFAULT FALSE,
  max_votes_per_user INTEGER DEFAULT 1,
  show_results_live BOOLEAN DEFAULT FALSE,
  enable_tutorial BOOLEAN DEFAULT TRUE,
  seasonal_theme VARCHAR(50) DEFAULT 'default',
  custom_greeting TEXT,
  holiday_popups_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default election categories
INSERT INTO election_categories (name, description, display_order) VALUES
('Senior Prefects', 'Senior leadership positions', 1),
('Junior Prefects', 'Junior leadership positions', 2),
('House Captains', 'House leadership positions', 3),
('Club Leaders', 'Club and society leadership', 4)
ON CONFLICT DO NOTHING;

-- Insert default positions
INSERT INTO positions (name, category, description, display_order) VALUES
('Head Boy', 'Senior Prefects', 'Overall male student leader', 1),
('Head Girl', 'Senior Prefects', 'Overall female student leader', 2),
('Deputy Head Boy', 'Senior Prefects', 'Deputy male student leader', 3),
('Deputy Head Girl', 'Senior Prefects', 'Deputy female student leader', 4),
('Senior Prefect', 'Senior Prefects', 'Senior student representative', 5),
('Junior Prefect', 'Junior Prefects', 'Junior student representative', 6),
('Red House Captain', 'House Captains', 'Captain of Red House', 7),
('Blue House Captain', 'House Captains', 'Captain of Blue House', 8),
('Green House Captain', 'House Captains', 'Captain of Green House', 9),
('Yellow House Captain', 'House Captains', 'Captain of Yellow House', 10)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_voting_code ON users(voting_code);
CREATE INDEX IF NOT EXISTS idx_users_has_voted ON users(has_voted);
CREATE INDEX IF NOT EXISTS idx_candidates_position_id ON candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_position_id ON votes(position_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on users" ON users FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on candidates" ON candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on candidates" ON candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on candidates" ON candidates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on candidates" ON candidates FOR DELETE USING (true);

CREATE POLICY "Allow public read access on positions" ON positions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on positions" ON positions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on votes" ON votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on election_settings" ON election_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update access on election_settings" ON election_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public insert access on election_settings" ON election_settings FOR INSERT WITH CHECK (true);

-- Insert default election settings
INSERT INTO election_settings (
  election_name,
  start_date,
  end_date,
  is_active,
  allow_face_recognition,
  require_biometric,
  max_votes_per_user,
  show_results_live,
  enable_tutorial,
  seasonal_theme,
  holiday_popups_enabled
) VALUES (
  '2024 Prefectorial Elections',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  true,
  true,
  false,
  1,
  false,
  true,
  'default',
  true
) ON CONFLICT DO NOTHING;
