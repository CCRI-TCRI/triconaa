-- Create election_settings table
CREATE TABLE IF NOT EXISTS election_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    max_candidates INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default positions
INSERT INTO positions (title, description, display_order) VALUES
('Head Prefect', 'Overall leader of the student body', 1),
('Deputy Head Prefect', 'Assistant to the Head Prefect', 2),
('Academic Prefect', 'Oversees academic activities and study groups', 3),
('Sports Prefect', 'Manages sports activities and competitions', 4),
('Social Prefect', 'Organizes social events and activities', 5),
('Discipline Prefect', 'Maintains order and discipline', 6)
ON CONFLICT DO NOTHING;

-- Insert default election settings
INSERT INTO election_settings (setting_key, setting_value, description) VALUES
('election_title', 'Lubiri Secondary School Prefectorial Elections 2024', 'Main title for the election'),
('election_start_date', '2024-01-15T08:00:00Z', 'When voting begins'),
('election_end_date', '2024-01-16T17:00:00Z', 'When voting ends'),
('voting_enabled', 'true', 'Whether voting is currently enabled'),
('results_public', 'false', 'Whether results are visible to public'),
('max_votes_per_position', '1', 'Maximum votes allowed per position'),
('require_biometric', 'false', 'Whether biometric authentication is required'),
('allow_face_recognition', 'true', 'Whether face recognition is enabled'),
('theme_color', 'blue', 'Primary theme color'),
('school_logo_url', '/logo.png', 'URL to school logo'),
('welcome_message', 'Welcome to the Lubiri Secondary School Digital Voting Platform', 'Welcome message for voters'),
('admin_email', 'admin@lubiri.edu.ug', 'Administrator email address'),
('backup_enabled', 'true', 'Whether automatic backups are enabled'),
('audit_logging', 'true', 'Whether to log all voting activities')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_election_settings_updated_at BEFORE UPDATE ON election_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON election_settings TO authenticated;
-- GRANT ALL PRIVILEGES ON positions TO authenticated;
