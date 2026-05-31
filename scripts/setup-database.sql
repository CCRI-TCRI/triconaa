-- Enable RLS
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create tables
CREATE TABLE IF NOT EXISTS election_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES election_categories(id),
  max_candidates INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  class VARCHAR(10) NOT NULL,
  voting_code VARCHAR(6) NOT NULL,
  face_encoding TEXT,
  has_voted BOOLEAN DEFAULT false,
  voted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  class VARCHAR(10) NOT NULL,
  position_id UUID REFERENCES positions(id),
  manifesto TEXT,
  photo_url TEXT,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  candidate_id UUID REFERENCES candidates(id),
  position_id UUID REFERENCES positions(id),
  category_id UUID REFERENCES election_categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  profile_picture TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO election_categories (name, description) VALUES
('Senior Leadership', 'Top leadership positions in the school'),
('Games and Sports', 'Sports and physical activities leadership'),
('Entertainment', 'Cultural and entertainment activities'),
('Academic Affairs', 'Academic leadership and support'),
('Information', 'Information and communication'),
('Uniform', 'Uniform and dress code management'),
('Mess', 'Dining and food services');

INSERT INTO positions (title, description, category_id) VALUES
('Head Prefect', 'Overall student leader', (SELECT id FROM election_categories WHERE name = 'Senior Leadership')),
('Deputy Head Prefect', 'Assistant to Head Prefect', (SELECT id FROM election_categories WHERE name = 'Senior Leadership')),
('Sports Prefect', 'Sports activities coordinator', (SELECT id FROM election_categories WHERE name = 'Games and Sports')),
('Entertainment Prefect', 'Entertainment events coordinator', (SELECT id FROM election_categories WHERE name = 'Entertainment')),
('Academic Prefect', 'Academic affairs coordinator', (SELECT id FROM election_categories WHERE name = 'Academic Affairs')),
('Information Prefect', 'Information management', (SELECT id FROM election_categories WHERE name = 'Information')),
('Uniform Prefect', 'Uniform compliance', (SELECT id FROM election_categories WHERE name = 'Uniform')),
('Mess Prefect', 'Dining services management', (SELECT id FROM election_categories WHERE name = 'Mess'));

-- Insert sample users
INSERT INTO users (student_id, full_name, class, voting_code) VALUES
('LUB2024001', 'John Doe', 'S6A', '123456'),
('LUB2024002', 'Jane Smith', 'S6B', '234567'),
('LUB2024003', 'Mike Johnson', 'S5A', '345678'),
('LUB2024004', 'Sarah Wilson', 'S5B', '456789'),
('LUB2024005', 'David Brown', 'S4A', '567890');

-- Insert sample candidates
INSERT INTO candidates (student_id, full_name, class, position_id, manifesto) VALUES
('LUB2024010', 'Sarah Nakato', 'S6A', (SELECT id FROM positions WHERE title = 'Head Prefect'), 'I will lead with integrity and serve all students equally.'),
('LUB2024011', 'John Mukasa', 'S6B', (SELECT id FROM positions WHERE title = 'Head Prefect'), 'Together we can make our school better for everyone.'),
('LUB2024012', 'Grace Nambi', 'S6A', (SELECT id FROM positions WHERE title = 'Head Prefect'), 'Leadership through service and dedication.'),
('LUB2024013', 'David Ssali', 'S5A', (SELECT id FROM positions WHERE title = 'Sports Prefect'), 'Promoting sports excellence and healthy competition.'),
('LUB2024014', 'Mary Nakirya', 'S5B', (SELECT id FROM positions WHERE title = 'Sports Prefect'), 'Sports for all, excellence for everyone.');

-- Insert admin user
INSERT INTO admin_users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@lubiri.edu.ug', '$2b$10$example_hash', 'System Administrator', 'manager');

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_categories ENABLE ROW LEVEL SECURITY;

-- Allow read access to election data
CREATE POLICY "Allow read access to categories" ON election_categories FOR SELECT USING (true);
CREATE POLICY "Allow read access to positions" ON positions FOR SELECT USING (true);
CREATE POLICY "Allow read access to candidates" ON candidates FOR SELECT USING (true);

-- Allow users to read their own data
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (true);

-- Allow voting
CREATE POLICY "Allow voting" ON votes FOR INSERT WITH CHECK (true);

-- Create function to increment vote count
CREATE OR REPLACE FUNCTION increment_vote_count(candidate_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE candidates 
  SET vote_count = vote_count + 1 
  WHERE id = candidate_id;
END;
$$ LANGUAGE plpgsql;
