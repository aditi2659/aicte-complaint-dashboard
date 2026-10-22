-- Seed: 001_seed_synthetic_data.sql
-- Description: Non-destructive, collision-checked synthetic baseline data
--              matching backend/src/data/complaints.js and sample_institutions.sql.

BEGIN;

-- 1. Collision Safeguards (Detects inconsistent UUID vs aicte_permanent_id mappings)
DO $$
DECLARE
  v_conflict_id UUID;
  v_conflict_perm TEXT;
BEGIN
  -- INST-204 checks
  SELECT id INTO v_conflict_id FROM institutions
  WHERE aicte_permanent_id = 'INST-204' AND id <> 'a0000000-0000-0000-0000-000000000204';
  IF FOUND THEN
    RAISE EXCEPTION 'Seed Conflict: aicte_permanent_id INST-204 exists under different UUID: %', v_conflict_id;
  END IF;

  SELECT aicte_permanent_id INTO v_conflict_perm FROM institutions
  WHERE id = 'a0000000-0000-0000-0000-000000000204' AND aicte_permanent_id IS DISTINCT FROM 'INST-204';
  IF FOUND THEN
    RAISE EXCEPTION 'Seed Conflict: UUID a0000000-0000-0000-0000-000000000204 exists under different aicte_permanent_id: %', v_conflict_perm;
  END IF;

  -- INST-771 checks
  SELECT id INTO v_conflict_id FROM institutions
  WHERE aicte_permanent_id = 'INST-771' AND id <> 'a0000000-0000-0000-0000-000000000771';
  IF FOUND THEN
    RAISE EXCEPTION 'Seed Conflict: aicte_permanent_id INST-771 exists under different UUID: %', v_conflict_id;
  END IF;

  SELECT aicte_permanent_id INTO v_conflict_perm FROM institutions
  WHERE id = 'a0000000-0000-0000-0000-000000000771' AND aicte_permanent_id IS DISTINCT FROM 'INST-771';
  IF FOUND THEN
    RAISE EXCEPTION 'Seed Conflict: UUID a0000000-0000-0000-0000-000000000771 exists under different aicte_permanent_id: %', v_conflict_perm;
  END IF;
END $$;

-- 2. Seed Shared Institutions (Non-destructive: preserves existing records)
INSERT INTO institutions (id, aicte_permanent_id, institution_name, institution_type, state, approval_status)
VALUES
  ('a0000000-0000-0000-0000-000000000204', 'INST-204', 'North Valley Institute of Technology', 'Engineering College', 'Maharashtra', 'Approved'),
  ('a0000000-0000-0000-0000-000000000771', 'INST-771', 'Western Lakes College', 'Engineering College', 'Karnataka', 'Approved')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Baseline Complaints (Faithful to backend/src/data/complaints.js)
-- ON CONFLICT DO NOTHING: Operational updates made by officials are never overwritten.
INSERT INTO complaints (
  complaint_id, institution_id, title, category, description,
  bureau, originating_bureau, priority, status, due_date,
  is_escalated, created_at, created_by
)
VALUES
  (
    'CMP-1001',
    'a0000000-0000-0000-0000-000000000204',
    'Scholarship Delay',
    'Scholarship Delay',
    'Students report that approved scholarships have not been credited for the current semester.',
    'Student Development Cell',
    'Student Development Cell',
    'High',
    'Under Review',
    '2026-10-12T00:00:00Z',
    FALSE,
    '2026-09-12T00:00:00Z',
    'synthetic_seed'
  ),
  (
    'CMP-1002',
    'a0000000-0000-0000-0000-000000000204',
    'Scholarship Delay',
    'Scholarship Delay',
    'Several students from the institute say their semester scholarship payments are still pending.',
    'Grievance Redressal Cell',
    'Grievance Redressal Cell',
    'High',
    'Open',
    '2026-10-15T00:00:00Z',
    FALSE,
    '2026-09-15T00:00:00Z',
    'synthetic_seed'
  ),
  (
    'CMP-1003',
    'a0000000-0000-0000-0000-000000000771',
    'Hostel Facilities',
    'Hostel Facilities',
    'Students have complained about poor hostel sanitation and repeated water supply interruptions.',
    'Student Development Cell',
    'Student Development Cell',
    'Medium',
    'Open',
    '2026-10-18T00:00:00Z',
    FALSE,
    '2026-09-18T00:00:00Z',
    'synthetic_seed'
  ),
  (
    'CMP-1004',
    'a0000000-0000-0000-0000-000000000204',
    'Infrastructure',
    'Infrastructure',
    'A report raises concerns about unsafe laboratory equipment and maintenance delays.',
    'Quality Assurance Cell',
    'Quality Assurance Cell',
    'Critical',
    'Assigned',
    '2026-10-20T00:00:00Z',
    FALSE,
    '2026-09-20T00:00:00Z',
    'synthetic_seed'
  ),
  (
    'CMP-1005',
    'a0000000-0000-0000-0000-000000000771',
    'Hostel Facilities',
    'Hostel Facilities',
    'The hostel has recurring hygiene problems and students say the water supply frequently stops.',
    'Grievance Redressal Cell',
    'Grievance Redressal Cell',
    'Medium',
    'Under Review',
    '2026-10-22T00:00:00Z',
    FALSE,
    '2026-09-22T00:00:00Z',
    'synthetic_seed'
  )
ON CONFLICT (complaint_id) DO NOTHING;

-- 4. Seed Explainable Overlap Suggestions (Derived from matcher.js output)
-- Canonical ordering: CMP-1001 < CMP-1002, CMP-1003 < CMP-1005
-- ON CONFLICT DO NOTHING: Official reviews/notes/decisions are never overwritten.
INSERT INTO complaint_links (complaint_id_a, complaint_id_b, similarity_score, match_reasons, review_status)
VALUES
  (
    'CMP-1001',
    'CMP-1002',
    0.6923,
    '["same institution ID", "same complaint category", "similar description wording", "reported to different Bureaus/Cells"]'::JSONB,
    'Suggested'
  ),
  (
    'CMP-1003',
    'CMP-1005',
    0.6667,
    '["same institution ID", "same complaint category", "similar description wording", "reported to different Bureaus/Cells"]'::JSONB,
    'Suggested'
  )
ON CONFLICT (complaint_id_a, complaint_id_b) DO NOTHING;

-- 5. Concurrency-Safe Initial Audit Actions (Database-enforced via uq_actions_idempotency_key)
INSERT INTO complaint_actions (complaint_id, action_type, action, actor_name, details, idempotency_key, created_at)
VALUES
  (
    'CMP-1001',
    'CREATED',
    'Complaint registered via student portal',
    'System Portal',
    '{"bureau": "Student Development Cell"}'::JSONB,
    'seed-action-CMP-1001-created',
    '2026-09-12T00:00:00Z'::TIMESTAMPTZ
  ),
  (
    'CMP-1002',
    'CREATED',
    'Complaint registered via grievance cell intake',
    'System Portal',
    '{"bureau": "Grievance Redressal Cell"}'::JSONB,
    'seed-action-CMP-1002-created',
    '2026-09-15T00:00:00Z'::TIMESTAMPTZ
  ),
  (
    'CMP-1003',
    'CREATED',
    'Complaint registered via student portal',
    'System Portal',
    '{"bureau": "Student Development Cell"}'::JSONB,
    'seed-action-CMP-1003-created',
    '2026-09-18T00:00:00Z'::TIMESTAMPTZ
  ),
  (
    'CMP-1004',
    'CREATED',
    'Complaint registered via quality inspection report',
    'System Portal',
    '{"bureau": "Quality Assurance Cell"}'::JSONB,
    'seed-action-CMP-1004-created',
    '2026-09-20T00:00:00Z'::TIMESTAMPTZ
  ),
  (
    'CMP-1005',
    'CREATED',
    'Complaint registered via grievance cell intake',
    'System Portal',
    '{"bureau": "Grievance Redressal Cell"}'::JSONB,
    'seed-action-CMP-1005-created',
    '2026-09-22T00:00:00Z'::TIMESTAMPTZ
  )
ON CONFLICT (idempotency_key) DO NOTHING;

COMMIT;
