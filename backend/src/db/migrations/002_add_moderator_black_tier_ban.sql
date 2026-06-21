-- Migration 002: Add moderator role, black admin tier, and ban system
-- Created: 2026-06-20
--
-- PRE-FLIGHT: run against a dev DB first, then production.
-- APPLY: psql -U campaigncodex -d campaigncodex -f 002_add_moderator_black_tier_ban.sql

BEGIN;

-- 1. Extend supporter_tier to include 'black' (reserved for admin accounts)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_supporter_tier_check;
ALTER TABLE users ADD CONSTRAINT users_supporter_tier_check
  CHECK (supporter_tier IN ('free','bronze','silver','gold','platinum','black'));

-- 2. Moderator role: secondary admins who can only ban users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT false;

-- 3. Ban system
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at    TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason   VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
