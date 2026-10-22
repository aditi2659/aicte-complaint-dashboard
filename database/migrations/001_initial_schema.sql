-- Migration: 001_initial_schema.sql
-- Description: Core schema, UUID primary keys, is_escalated flag, complaint_analytics_view,
--              explicit named constraints, and Supabase RLS / Data API sequence lockdown.
-- Note: Transaction boundaries (BEGIN/COMMIT) are managed by the migration runner.

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Schema Migration Tracking Table (created here if not already initialized by runner)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER NOT NULL
);

-- 3. Institution Directory Table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aicte_permanent_id TEXT UNIQUE NULL,
  institution_name TEXT NOT NULL,
  institution_type TEXT NOT NULL DEFAULT 'Engineering College',
  state TEXT NOT NULL,
  district TEXT,
  pincode VARCHAR(10),
  contact_email TEXT,
  contact_phone VARCHAR(20),
  approval_status TEXT NOT NULL DEFAULT 'Approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_institutions_approval_status 
    CHECK (approval_status IN ('Approved', 'Under Review', 'Suspended', 'Withdrawn', 'Unverified'))
);

-- 4. Users and RBAC Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  bureau TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_users_role 
    CHECK (role IN ('SUPER_ADMIN', 'BUREAU_HEAD', 'BUREAU_OFFICER', 'GRIEVANCE_OFFICER', 'AUDITOR'))
);

-- 5. Central Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  complaint_id TEXT PRIMARY KEY,
  institution_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  bureau TEXT NOT NULL,
  originating_bureau TEXT NOT NULL,
  assigned_to UUID NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Open',
  due_date TIMESTAMPTZ NOT NULL,
  is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT fk_complaints_institution 
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_complaints_assigned_to 
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_complaints_priority 
    CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  CONSTRAINT chk_complaints_status 
    CHECK (status IN ('Open', 'Assigned', 'In Progress', 'Under Review', 'Pending Institution Response', 'Resolved', 'Closed', 'Transferred'))
);

-- 6. Cross-Bureau Overlap Suggestions & Links
CREATE TABLE IF NOT EXISTS complaint_links (
  id BIGSERIAL PRIMARY KEY,
  complaint_id_a TEXT NOT NULL,
  complaint_id_b TEXT NOT NULL,
  similarity_score NUMERIC(5,4) NOT NULL,
  match_reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
  review_status TEXT NOT NULL DEFAULT 'Suggested',
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_complaint_links_case_a 
    FOREIGN KEY (complaint_id_a) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  CONSTRAINT fk_complaint_links_case_b 
    FOREIGN KEY (complaint_id_b) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  CONSTRAINT fk_complaint_links_reviewer 
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_complaint_links_canonical_pair 
    CHECK (complaint_id_a < complaint_id_b),
  CONSTRAINT uq_complaint_links_pair 
    UNIQUE (complaint_id_a, complaint_id_b),
  CONSTRAINT chk_complaint_links_similarity 
    CHECK (similarity_score >= 0.0 AND similarity_score <= 1.0),
  CONSTRAINT chk_complaint_links_review_status 
    CHECK (review_status IN ('Suggested', 'Confirmed', 'Dismissed'))
);

-- 7. Bureau Transfers Table
CREATE TABLE IF NOT EXISTS complaint_transfers (
  id BIGSERIAL PRIMARY KEY,
  complaint_id TEXT NOT NULL,
  from_bureau TEXT NOT NULL,
  to_bureau TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  requested_by UUID NOT NULL,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_transfers_complaint 
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  CONSTRAINT fk_transfers_requester 
    FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_transfers_reviewer 
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT chk_transfers_status 
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed'))
);

-- 8. Action History & Audit Log Table
CREATE TABLE IF NOT EXISTS complaint_actions (
  id BIGSERIAL PRIMARY KEY,
  complaint_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  actor_id UUID NULL,
  actor_name TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  idempotency_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_actions_complaint 
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  CONSTRAINT fk_actions_actor 
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_actions_type 
    CHECK (action_type IN ('CREATED', 'STATUS_CHANGE', 'ASSIGNMENT', 'TRANSFER_REQUEST', 'TRANSFER_RESOLVED', 'NOTE_ADDED', 'OVERLAP_REVIEWED', 'OVERLAP_LINKED')),
  CONSTRAINT uq_actions_idempotency_key 
    UNIQUE (idempotency_key)
);

-- 9. Analytics View (Isolated aggregates prevent row multiplication)
CREATE OR REPLACE VIEW complaint_analytics_view AS
SELECT 
  c.complaint_id,
  c.institution_id,
  COALESCE(i.state, 'Unknown') AS region,
  c.category,
  c.created_at,
  c.due_date,
  COALESCE(act.latest_action_at, c.created_at) AS last_action_date,
  c.status,
  c.bureau,
  COALESCE(tr.transfers, 0)::INTEGER AS transfer_count,
  c.is_escalated
FROM complaints c
JOIN institutions i ON c.institution_id = i.id
LEFT JOIN (
  SELECT complaint_id, MAX(created_at) AS latest_action_at
  FROM complaint_actions
  GROUP BY complaint_id
) act ON c.complaint_id = act.complaint_id
LEFT JOIN (
  SELECT complaint_id, COUNT(*) AS transfers
  FROM complaint_transfers
  GROUP BY complaint_id
) tr ON c.complaint_id = tr.complaint_id;

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_institutions_perm_id ON institutions(aicte_permanent_id);
CREATE INDEX IF NOT EXISTS idx_complaints_institution_id ON complaints(institution_id);
CREATE INDEX IF NOT EXISTS idx_complaints_bureau ON complaints(bureau);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_due_date ON complaints(due_date);
CREATE INDEX IF NOT EXISTS idx_complaints_is_escalated ON complaints(is_escalated);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_links_status ON complaint_links(review_status);
CREATE INDEX IF NOT EXISTS idx_complaint_actions_complaint ON complaint_actions(complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_transfers_complaint ON complaint_transfers(complaint_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 11. Security Lockdown: RLS and Revocation of Table, View & Sequence Grants from Browser Roles
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON complaint_analytics_view FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
