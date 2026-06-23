-- Migration 004: Performance indexes + raven parent_id backfill
-- Run: psql $DATABASE_URL -f migrations/004_perf_indexes.sql
-- Safe to re-run: all statements use IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. password_reset_tokens — token_hash lookup
--    auth.js line ~498: WHERE prt.token_hash = $1
--    Without this index every reset attempt performs a full table scan.
--    NOT UNIQUE because the bcrypt comparison is done in application code after
--    fetching the row (bcrypt.compare requires the stored hash, not raw equality).
CREATE INDEX IF NOT EXISTS idx_prt_token_hash
  ON password_reset_tokens(token_hash);

-- 2. campaign_members — active-only partial index
--    Used by: active member count subquery in campaigns.js /join and /invite
--    (campaign_id WHERE left_at IS NULL)
--    Also used by campaigns/[id] GET to count active roster size.
--    Partial index covers only the ~active rows so it stays small even as
--    campaigns accumulate departed members over time.
CREATE INDEX IF NOT EXISTS idx_campaign_members_active
  ON campaign_members(campaign_id)
  WHERE left_at IS NULL;

-- 3. raven_messages — parent_id column + thread-chain index
--    parent_id enables threaded replies: a reply raven stores its parent's id.
--    The recursive CTE in ravens.js (GET /:id) walks the chain via:
--      JOIN chain c ON rm.id = c.parent_id
--    Without an index that join requires a seq-scan of raven_messages for every
--    step in the recursion.  Partial WHERE filters the ~90% of rows that are
--    top-level messages (parent_id IS NULL) so the index stays lean.
ALTER TABLE raven_messages
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES raven_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ravens_parent_id
  ON raven_messages(parent_id)
  WHERE parent_id IS NOT NULL;
