-- Supabase schema for IELTS Vocabulary App cloud sync
-- Run this in your Supabase project's SQL Editor

-- Enable UUID extension (for auth.user_id references)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User data table (stores favorites, error notebook, settings, custom data)
CREATE TABLE IF NOT EXISTS user_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Row Level Security: users can only access their own data
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own data"
  ON user_data
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_user_data_user_id ON user_data(user_id);
