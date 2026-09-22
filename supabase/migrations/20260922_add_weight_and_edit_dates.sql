-- ─────────────────────────────────────────
-- WEIGHT + LAST-EDITED DATES FOR HEIGHT/WEIGHT
-- Adds a weight_value/weight_unit pair alongside the existing
-- height_value/height_unit on both profile tables, plus per-field
-- last-edited timestamps for height and weight (neither table tracked
-- per-field edits before — family_profiles had no updated_at at all,
-- and user_profiles only a whole-row one).
-- ─────────────────────────────────────────
alter table user_profiles
  add column if not exists weight_value numeric(6,2),
  add column if not exists weight_unit text,
  add column if not exists height_updated_at timestamptz,
  add column if not exists weight_updated_at timestamptz;

alter table family_profiles
  add column if not exists weight_value numeric(6,2),
  add column if not exists weight_unit text,
  add column if not exists height_updated_at timestamptz,
  add column if not exists weight_updated_at timestamptz;
