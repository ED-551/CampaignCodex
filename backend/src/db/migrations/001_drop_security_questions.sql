-- Migration 001: Drop deprecated security question columns
-- Created: 2026-06-20
-- Reason: Security question flow was removed from signup/login UI. These columns
--         are no longer referenced by any application code. Bcrypt hashes of old
--         answers remain as data-at-rest risk if the DB is ever breached.
--
-- PRE-FLIGHT CHECK (run this first to confirm no rows have non-null values):
--   SELECT COUNT(*) FROM users
--   WHERE security_a1_hash IS NOT NULL OR security_a2_hash IS NOT NULL;
--
-- If the count is 0, proceed. If non-zero, the old answers are orphaned but
-- still in the DB — safe to drop regardless (no UI to retrieve them).
--
-- APPLY:
--   psql -U campaigncodex -d campaigncodex -f 001_drop_security_questions.sql

BEGIN;

ALTER TABLE users
  DROP COLUMN IF EXISTS security_q1,
  DROP COLUMN IF EXISTS security_a1_hash,
  DROP COLUMN IF EXISTS security_q2,
  DROP COLUMN IF EXISTS security_a2_hash;

COMMIT;
