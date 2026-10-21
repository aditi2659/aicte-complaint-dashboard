-- Prototype schema for PostgreSQL. Synthetic/demo data only.
CREATE TABLE IF NOT EXISTS institutions (
  institution_id TEXT PRIMARY KEY,
  institution_name TEXT NOT NULL,
  institution_type TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(institution_id),
  bureau TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS complaint_links (
  id BIGSERIAL PRIMARY KEY,
  complaint_id_a TEXT NOT NULL REFERENCES complaints(complaint_id),
  complaint_id_b TEXT NOT NULL REFERENCES complaints(complaint_id),
  similarity_score NUMERIC(5,4) NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'Suggested',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  CHECK (complaint_id_a <> complaint_id_b),
  UNIQUE (complaint_id_a, complaint_id_b)
);

CREATE TABLE IF NOT EXISTS complaint_actions (
  id BIGSERIAL PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES complaints(complaint_id),
  action TEXT NOT NULL,
  notes TEXT,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
