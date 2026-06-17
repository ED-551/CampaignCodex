-- CampaignCodex — PostgreSQL Schema
-- Run once on a fresh database: psql -d campaigncodex -f schema.sql

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username         VARCHAR(20) UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  first_name       VARCHAR(50) NOT NULL,
  last_name        VARCHAR(50) NOT NULL,
  middle_initial   CHAR(1),
  password_hash    VARCHAR(255) NOT NULL,
  security_q1      VARCHAR(255) NOT NULL,
  security_a1_hash VARCHAR(255) NOT NULL,
  security_q2      VARCHAR(255) NOT NULL,
  security_a2_hash VARCHAR(255) NOT NULL,
  supporter_tier    VARCHAR(20) NOT NULL DEFAULT 'free'
                    CHECK (supporter_tier IN ('free','bronze','silver','gold','platinum')),
  supporter_since   TIMESTAMP,
  is_admin          BOOLEAN   NOT NULL DEFAULT false,
  newsletter_opt_in BOOLEAN   NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Safe migration for existing installations (no-op on fresh schema)
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;

-- ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMP   NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  game_system VARCHAR(20) NOT NULL
              CHECK (game_system IN ('shadowdark','morkborg','nimble')),
  gm_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  join_code   VARCHAR(10) UNIQUE NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── CAMPAIGN MEMBERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_members (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID,     -- populated after character is linked
  joined_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

-- ─── CHARACTERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS characters (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id    UUID        REFERENCES campaigns(id) ON DELETE SET NULL,
  game_system    VARCHAR(20) NOT NULL
                 CHECK (game_system IN ('shadowdark','morkborg','nimble')),
  character_name VARCHAR(100) NOT NULL,
  portrait_url   VARCHAR(500),
  sheet_data     JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── COMBAT SESSIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS combat_sessions (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  round_number INTEGER   NOT NULL DEFAULT 1,
  is_active    BOOLEAN   NOT NULL DEFAULT true,
  combatants   JSONB     NOT NULL DEFAULT '[]',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_characters_user_id    ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign   ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_camp ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_gm          ON campaigns(gm_user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_join_code   ON campaigns(join_code);
CREATE INDEX IF NOT EXISTS idx_prt_user              ON password_reset_tokens(user_id);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SAFE MIGRATIONS FOR EXISTING INSTALLS ────────────────────────────────────
-- Soft-delete support: GM soft-deletes; players see the tombstone then dismiss it
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
-- Player leave support: soft-leave keeps the record for GM awareness
ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;

CREATE OR REPLACE TRIGGER trg_characters_updated
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_combat_updated
  BEFORE UPDATE ON combat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RAVEN MESSAGES (internal mail system) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS raven_messages (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject              VARCHAR(120) NOT NULL,
  body                 TEXT         NOT NULL,
  character_id         UUID         REFERENCES characters(id) ON DELETE SET NULL,
  read_at              TIMESTAMP,
  deleted_by_sender    BOOLEAN      NOT NULL DEFAULT false,
  deleted_by_recipient BOOLEAN      NOT NULL DEFAULT false,
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Fast inbox lookups (recipient + recency)
CREATE INDEX IF NOT EXISTS idx_ravens_recipient
  ON raven_messages(recipient_id, created_at DESC);

-- Fast sent-box lookups (sender + recency)
CREATE INDEX IF NOT EXISTS idx_ravens_sender
  ON raven_messages(sender_id, created_at DESC);

-- Lightweight unread-count query (partial index — only unread, non-deleted rows)
CREATE INDEX IF NOT EXISTS idx_ravens_unread
  ON raven_messages(recipient_id)
  WHERE read_at IS NULL AND deleted_by_recipient = false;

-- ─── CAMPAIGN MESSAGES (real-time campaign chat) ──────────────────────────────
-- username is denormalized: stores the username at time of send (avoids JOIN on
-- every history load and correctly reflects username if user later changes it).
CREATE TABLE IF NOT EXISTS campaign_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username     VARCHAR(20) NOT NULL,
  body         TEXT        NOT NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Scoped to campaign + time-ordered for history loads
CREATE INDEX IF NOT EXISTS idx_campaign_messages_room
  ON campaign_messages(campaign_id, created_at DESC);

-- ─── DIRECT MESSAGES (DM Widget — real-time 1:1 chat) ────────────────────────
-- Both sender_username and recipient_username are denormalized so the
-- conversation widget can display names without a JOIN on every history load.
CREATE TABLE IF NOT EXISTS dm_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username    VARCHAR(20) NOT NULL,
  recipient_username VARCHAR(20) NOT NULL,
  body               TEXT        NOT NULL,
  created_at         TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Separate indexes on each side; PostgreSQL uses BitmapOr to serve
-- the (sender OR recipient) query pattern efficiently.
CREATE INDEX IF NOT EXISTS idx_dm_sender
  ON dm_messages(sender_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient
  ON dm_messages(recipient_id, created_at DESC);
