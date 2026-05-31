-- Create election_categories table
CREATE TABLE IF NOT EXISTS election_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES election_categories(id) ON DELETE CASCADE,
  max_candidates INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class VARCHAR(50) NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  manifesto TEXT,
  photo_url TEXT,
  vote_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class VARCHAR(50) NOT NULL,
  voting_code VARCHAR(50) UNIQUE NOT NULL,
  face_encoding TEXT,
  has_voted BOOLEAN DEFAULT false,
  voted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES election_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create election_settings table
CREATE TABLE IF NOT EXISTS election_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO election_categories (name, description, is_active) VALUES
('Senior Leadership', 'Leadership positions for senior students', true),
('Games and Sports', 'Sports leadership positions', true),
('Entertainment', 'Entertainment and cultural leadership', true)
ON CONFLICT DO NOTHING;

-- Insert default positions
WITH category_ids AS (
  SELECT id, name FROM election_categories
)
INSERT INTO positions (title, description, category_id, is_active) 
SELECT 
  'Head Boy', 
  'Lead the student body and represent the school',
  (SELECT id FROM category_ids WHERE name = 'Senior Leadership'),
  true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Head Boy')
UNION ALL
SELECT 
  'Head Girl', 
  'Lead the female student body and promote gender equality',
  (SELECT id FROM category_ids WHERE name = 'Senior Leadership'),
  true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Head Girl')
UNION ALL
SELECT 
  'Sports Captain', 
  'Lead all sports activities and competitions',
  (SELECT id FROM category_ids WHERE name = 'Games and Sports'),
  true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Sports Captain')
UNION ALL
SELECT 
  'Entertainment Prefect', 
  'Organize school entertainment and cultural events',
  (SELECT id FROM category_ids WHERE name = 'Entertainment'),
  true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Entertainment Prefect');

-- Insert default election settings
INSERT INTO election_settings (setting_key, setting_value, description) VALUES
('election_start_date', '2024-01-15', 'Election start date'),
('election_end_date', '2024-01-20', 'Election end date'),
('voting_enabled', 'true', 'Whether voting is currently enabled'),
('results_published', 'false', 'Whether results are published'),
('max_voting_time', '300', 'Maximum voting time in seconds'),
('require_face_auth', 'false', 'Whether face authentication is required'),
('school_name', 'Lubiri Secondary School', 'School name'),
('election_title', '2024 Prefectorial Elections', 'Election title')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert demo users for testing
INSERT INTO users (student_id, full_name, class, voting_code, has_voted) VALUES
('LSS001', 'John Doe', 'S6A', 'VT001A', false),
('LSS002', 'Jane Smith', 'S6B', 'VT002B', false),
('DEMO123', 'Demo Student', 'S6C', 'DEMO456', false),
('LSS003', 'Michael Johnson', 'S6A', 'VT003C', false),
('LSS004', 'Sarah Wilson', 'S6C', 'VT004D', false)
ON CONFLICT (student_id) DO NOTHING;

-- Create function to increment vote count
CREATE OR REPLACE FUNCTION increment_vote_count(candidate_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE candidates 
  SET vote_count = vote_count + 1 
  WHERE id = candidate_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_voting_code ON users(voting_code);
CREATE INDEX IF NOT EXISTS idx_candidates_position_id ON candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes(candidate_id);
