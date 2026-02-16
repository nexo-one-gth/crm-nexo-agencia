-- Add rejection_reason column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create lead_comments table
CREATE TABLE IF NOT EXISTS lead_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on lead_comments
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- Create policy for reading comments (viewable by assigned advisor or admin)
-- Note: Assuming there's a profiles table linking users to roles or similar logic as in leads
-- For MVP/Simplicity based on existing rules:
CREATE POLICY "Enable read access for authenticated users" 
ON lead_comments FOR SELECT 
TO authenticated 
USING (true); -- Refine this based on actual requirements later

-- Create policy for inserting comments
CREATE POLICY "Enable insert access for authenticated users" 
ON lead_comments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create policy for updating own comments
CREATE POLICY "Enable update access for users based on user_id" 
ON lead_comments FOR UPDATE
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for deleting own comments
CREATE POLICY "Enable delete access for users based on user_id" 
ON lead_comments FOR DELETE
TO authenticated 
USING (auth.uid() = user_id);
