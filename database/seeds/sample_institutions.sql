INSERT INTO institutions (institution_id, institution_name, institution_type, state)
VALUES
  ('INST-204', 'North Valley Institute of Technology', 'Engineering College', 'Maharashtra'),
  ('INST-771', 'Western Lakes College', 'Engineering College', 'Karnataka')
ON CONFLICT (institution_id) DO NOTHING;
