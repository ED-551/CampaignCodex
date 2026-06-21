-- Migration 003: Add timed ban support
-- Created: 2026-06-20
--
-- Adds banned_until TIMESTAMPTZ (NULL = permanent ban, future timestamp = timed ban).
-- Note: banned_at (from migration 002) is TIMESTAMP (timezone-naive). banned_until is
-- TIMESTAMPTZ (timezone-aware) to match JavaScript Date comparisons in auth.js.
-- Both columns should be interpreted as UTC in application code.
--
-- PRE-FLIGHT: run against a dev DB first, then production.
-- APPLY: psql -U campaigncodex -d campaigncodex -f 003_add_banned_until.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

COMMIT;
