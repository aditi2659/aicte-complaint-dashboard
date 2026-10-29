-- Migration: 002_user_password_setup.sql
-- Description: Adds user_setup_tokens table for secure tokenized account activation,
--              first-time password creation, and password reset flows.
--              Preserves all existing users, roles, and password hashes.

CREATE TABLE IF NOT EXISTS user_setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'ACCOUNT_SETUP',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_setup_tokens_type 
    CHECK (token_type IN ('ACCOUNT_SETUP', 'PASSWORD_RESET'))
);

CREATE INDEX IF NOT EXISTS idx_setup_tokens_user_id ON user_setup_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_setup_tokens_hash ON user_setup_tokens(token_hash);
