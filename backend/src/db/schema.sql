-- CampaignCodex — PostgreSQL Schema
-- Run once on a fresh database: psql -d campaigncodex -f schema.sql
--
-- Key design decisions:
--   - UUIDs for all PKs (gen_random_uuid via pgcrypto) — safe for client exposure
--   - JSONB for flexible per-system data: sheet_data (characters), stat_data
--     (monsters), combatants (combat_sessions). See per-table annotations below.
--   - Denormalized username columns in campaign_messages and dm_messages — avoids
--     a JOIN on every history load and correctly captures the name at send-time.
--   - token_version on users: incrementing it immediately invalidates all JWTs for
--     that user without needing a token blocklist.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Primary identity table. Authentication uses bcrypt (12 rounds) on password_hash.
-- token_version is checked on every authenticated request (see middleware/auth.js);
-- incrementing it on password change/reset is what makes stolen JWTs expire
-- immediately rather than waiting out the full 24-hour token lifetime.
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username         VARCHAR(20) UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  first_name       VARCHAR(50) NOT NULL,
  last_name        VARCHAR(50) NOT NULL,
  middle_initial   CHAR(1),
  password_hash    VARCHAR(255) NOT NULL,
  security_q1      VARCHAR(255) NOT NULL,   -- DEPRECATED: see ALTER below
  security_a1_hash VARCHAR(255) NOT NULL,   -- DEPRECATED: see ALTER below
  security_q2      VARCHAR(255) NOT NULL,   -- DEPRECATED: see ALTER below
  security_a2_hash VARCHAR(255) NOT NULL,   -- DEPRECATED: see ALTER below
  supporter_tier    VARCHAR(20) NOT NULL DEFAULT 'free'
                    CHECK (supporter_tier IN ('free','bronze','silver','gold','platinum')),
  supporter_since   TIMESTAMP,              -- when tier was last upgraded
  is_admin          BOOLEAN   NOT NULL DEFAULT false,
  newsletter_opt_in BOOLEAN   NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMP,             -- null = user hasn't accepted current ToS
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Safe migrations for existing installations (no-op on fresh schema)
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;
-- token_version: incrementing invalidates all existing JWTs for the user.
-- Checked on every request in requireAuth; JWTs embed this as the 'tv' claim.
-- See: backend/src/db/migrations/001_drop_security_questions.sql for the column
-- removal plan — these columns are now nullable, no code reads them.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
-- Security questions removed from signup (email-only recovery going forward).
-- Columns kept for existing users; new rows may leave them NULL.
ALTER TABLE users ALTER COLUMN security_q1      DROP NOT NULL;
ALTER TABLE users ALTER COLUMN security_a1_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN security_q2      DROP NOT NULL;
ALTER TABLE users ALTER COLUMN security_a2_hash DROP NOT NULL;

-- ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────────
-- Single-use tokens for the forgot-password flow. token_hash is a bcrypt hash
-- of the raw token sent in the reset link — the raw value is never stored.
-- used=true is set atomically when the token is redeemed; expired tokens are
-- filtered by expires_at (1-hour window set in email.js).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMP   NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
-- A campaign is the top-level container for a GM's game. join_code is a 7-char
-- hyphenated code (e.g. "XKF-9TRA") generated with crypto.randomInt — players
-- use it to join. is_deleted is a soft-delete flag; deleted campaigns remain in
-- the DB so players see a tombstone instead of a 404 on their dashboard.
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
-- Junction table linking users to campaigns. character_id is populated once the
-- player creates and links their character sheet. left_at is a soft-leave
-- timestamp — left players remain visible to the GM but are excluded from active
-- member counts and combat.
CREATE TABLE IF NOT EXISTS campaign_members (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID,     -- populated after character is linked
  joined_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

-- ─── CHARACTERS ───────────────────────────────────────────────────────────────
-- One character per player per campaign (enforced at the app layer, not by a
-- DB constraint — a player may own multiple characters outside of any campaign).
--
-- sheet_data JSONB: per-system character sheet. Shape varies by game_system:
--
--   Shadowdark:
--     { hp_current, hp_max, ac, className, ancestry, level,
--       stats: { str, dex, con, int, wis, cha },   ← raw scores, not modifiers
--       spells: [...], talents: [...], gear: [...],
--       xp, gold, notes }
--
--   Mörk Borg:
--     { hp_current, hp_max, ac, omens, powers, abilities, equipment, notes,
--       stats: { agility, presence, strength, toughness } }
--
--   Nimble:
--     { hp_current, hp_max, armor, shield, className, dex_mod, str_mod,
--       stats: { str, dex, con, int, wis, cha },
--       skills: [...], gear: [...], notes }
--       (ac is computed from armor + shield + dex_mod, not stored directly)
--
-- All systems include at minimum: hp_current, hp_max so the combat tracker can
-- read HP without system-specific branching on every spawn.
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
-- One active session per campaign at a time (enforced by is_active flag).
-- active_combatant_index tracks whose turn it is. encounter_id links back to
-- the encounter template used to start this fight (nullable — session may be
-- started without a template).
--
-- combatants JSONB array: one entry per participant. Allowlisted fields:
--   { id,               — UUID (randomUUID at session start, not a DB FK)
--     type,             — 'pc' | 'monster' | 'gm' (pc = player char, gm = GM char)
--     seatIndex,        — Nimble-specific seat (0–3); null for other systems
--     joinOrder,        — insertion order used for non-initiative sorted display
--     name,             — display name (character_name or monster name)
--     username,         — owning user's login name (for PC rows)
--     characterId,      — UUID ref to characters table (PC/GM rows only)
--     isGMCharacter,    — true when this PC row is the GM's own character
--     hp_current,       — current hit points (null for monsters in sanitized view)
--     hp_max,           — maximum hit points (null for monsters in sanitized view)
--     hp_label,         — human label shown to players for monster HP ("Healthy" / "Bloodied" / "Dead")
--     ac,               — armor class
--     dex_mod,          — DEX modifier for initiative rolls
--     agility,          — Mörk Borg stat used for side-initiative variant
--     initiative,       — null = no initiative set (Shadowdark side-initiative mode)
--     conditions,       — array of active condition strings (e.g. ["Poisoned","Prone"])
--     is_active_turn,   — true while it is this combatant's turn
--     is_dead,          — true when HP reaches 0; dead combatants sink to bottom
--     has_gone,         — true after the combatant's turn completes in a round
--     notes,            — GM per-combatant freetext notes
--     monsterId,        — UUID ref to monsters table (monster rows only)
--     morale,           — Shadowdark morale score (used by morale-check logic)
--     statData }        — inline stat block snapshot (Nimble monsters only)
--
-- IMPORTANT: monsters always have hp_current/hp_max stripped before being sent
-- to non-GM sockets (see sanitizeCombatants in routes/combat.js). Players only
-- see hp_label (Healthy / Bloodied / Near Death / Dead).
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
-- Partial index: only rows where newsletter is opted in (used by admin broadcast query)
CREATE INDEX IF NOT EXISTS idx_users_newsletter_optin
  ON users(created_at ASC)
  WHERE newsletter_opt_in = true AND is_admin = false;

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
-- Single trigger function shared by all tables that have an updated_at column.
-- Applied via per-table BEFORE UPDATE triggers below.
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
-- GM character: the GM can optionally play a character in their own campaign
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS gm_character_id UUID REFERENCES characters(id) ON DELETE SET NULL;

CREATE OR REPLACE TRIGGER trg_characters_updated
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_combat_updated
  BEFORE UPDATE ON combat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RAVEN MESSAGES (internal mail system) ────────────────────────────────────
-- In-app async messaging between users. Modeled after email: soft-delete on each
-- side (deleted_by_sender / deleted_by_recipient) so deleting from your sent box
-- doesn't remove it from the recipient's inbox. character_id optionally attaches
-- a character card to the message (e.g. "Here's my Shadowdark fighter sheet").
CREATE TABLE IF NOT EXISTS raven_messages (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject              VARCHAR(120) NOT NULL,
  body                 TEXT         NOT NULL,
  character_id         UUID         REFERENCES characters(id) ON DELETE SET NULL,
  read_at              TIMESTAMP,                -- null = unread
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
--
-- metadata JSONB: null for plain text messages. For dice roll results, shape is:
--   { type: 'dice',
--     notation: string,   — e.g. "2d6+3" (max 20 chars)
--     count:    number,   — number of dice (1–100)
--     sides:    number,   — die faces (2–1000)
--     rolls:    number[], — individual roll results, clamped [-9999,9999], max 100 elements
--     total:    number,   — sum of rolls
--     variant:  'standard' | 'advantage' | 'disadvantage' }
-- All metadata fields are server-sanitized in socket.js before storage.
CREATE TABLE IF NOT EXISTS campaign_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username     VARCHAR(20) NOT NULL,
  body         TEXT        NOT NULL,
  metadata     JSONB,                   -- optional: dice rolls, embeds, etc.
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Scoped to campaign + time-ordered for history loads
CREATE INDEX IF NOT EXISTS idx_campaign_messages_room
  ON campaign_messages(campaign_id, created_at DESC);

-- ─── DIRECT MESSAGES (DM Widget — real-time 1:1 chat) ────────────────────────
-- Both sender_username and recipient_username are denormalized so the
-- conversation widget can display names without a JOIN on every history load.
-- metadata shape is identical to campaign_messages.metadata (dice roll results).
CREATE TABLE IF NOT EXISTS dm_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username    VARCHAR(20) NOT NULL,
  recipient_username VARCHAR(20) NOT NULL,
  body               TEXT        NOT NULL,
  metadata           JSONB,               -- optional: dice rolls, embeds, etc.
  created_at         TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Separate indexes on each side; PostgreSQL uses BitmapOr to serve
-- the (sender OR recipient) query pattern efficiently.
CREATE INDEX IF NOT EXISTS idx_dm_sender
  ON dm_messages(sender_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient
  ON dm_messages(recipient_id, created_at DESC);

-- ─── BESTIARY (user-created monster stat blocks) ──────────────────────────────
-- Each monster belongs to one user and one game system. The stat_data JSONB
-- field holds the full system-specific stat block (filled in once the user
-- researches each system's format). The challenge + tags columns are denormalized
-- card-display fields so the list page never has to parse JSONB.
--
-- challenge : free-text difficulty label — "3" (Shadowdark level), "2d8" (Mörk Borg HD),
--             "Tier 2" (Nimble), etc.
-- tags      : comma-delimited type labels — "Undead, Humanoid, Boss"
--
-- stat_data JSONB: per-system monster stat block. Shape is user-defined (free-form
-- within the 64KB server-enforced limit), but conventional fields by system:
--   Shadowdark: { hp, ac, atk, dmg, mv, al, lvl, special }
--   Mörk Borg:  { hp, ac, morale, attacks, special, notes }
--   Nimble:     { hp, ac, tier, attacks, traits }
-- When a monster is loaded into combat, its stat_data is snapshotted into the
-- combatant row as `statData` (Nimble only) or fetched on-demand via the bestiary
-- API by the combat tracker stat panel.
CREATE TABLE IF NOT EXISTS monsters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_system VARCHAR(20) NOT NULL
              CHECK (game_system IN ('shadowdark','morkborg','nimble')),
  name        VARCHAR(100) NOT NULL,
  challenge   VARCHAR(50),
  tags        VARCHAR(200),
  stat_data   JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Fast listing: all monsters for a user, scoped to a system, newest first
CREATE INDEX IF NOT EXISTS idx_monsters_user
  ON monsters(user_id, game_system, created_at DESC);

CREATE OR REPLACE TRIGGER trg_monsters_updated
  BEFORE UPDATE ON monsters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ENCOUNTERS ───────────────────────────────────────────────────────────────
-- Saved reusable encounter templates, scoped by game system (NOT by campaign).
-- A GM with 3 Shadowdark campaigns can reuse any encounter across all of them.
-- times_used is incremented each time the encounter is launched into combat.
--
-- monsters JSONB array — each entry:
--   { monsterId,  — UUID ref to monsters table, or null for inline custom entries
--     name,       — monster display name (snapshotted at save time)
--     count,      — number of this creature type (expands to N combatant rows when loaded)
--     hp,         — starting HP per creature
--     maxHp,      — max HP per creature (may differ from hp for reduced-HP variants)
--     ac,         — armor class
--     dexMod,     — pre-computed DEX modifier for initiative (floor((dex-10)/2))
--     hitDie,     — 'd6' | 'd8' | etc. (Mörk Borg / Nimble)
--     notes }     — GM per-monster notes shown in encounter builder
CREATE TABLE IF NOT EXISTS encounters (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_system  VARCHAR(20) NOT NULL
               CHECK (game_system IN ('shadowdark','morkborg','nimble')),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  monsters     JSONB       NOT NULL DEFAULT '[]',
  tags         VARCHAR(200),
  times_used   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounters_user
  ON encounters(user_id, game_system, created_at DESC);

CREATE OR REPLACE TRIGGER trg_encounters_updated
  BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SAFE MIGRATIONS: combat_sessions v2 ─────────────────────────────────────
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS encounter_name VARCHAR(100);
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS active_combatant_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

-- ─── SAFE MIGRATIONS: combat_sessions v3 (persistent light timer — DEPRECATED) ──
-- These columns are retained for data safety but the timer now lives on campaigns.
-- No application code reads or writes these columns. See campaigns v2 below.
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS light_timer_expires_at TIMESTAMPTZ;
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS light_timer_remaining_secs INTEGER NOT NULL DEFAULT 3600;

-- ─── SAFE MIGRATIONS: combat_sessions v4 (Nimble combat mode) ────────────────
-- combat_mode: 'standard' (default) | 'seat' — Nimble uses seat-based positioning
-- rather than free-form combatant ordering. Stored here so the client can restore
-- the correct view on reconnect.
ALTER TABLE combat_sessions ADD COLUMN IF NOT EXISTS combat_mode VARCHAR(20) NOT NULL DEFAULT 'standard';

-- ─── SAFE MIGRATIONS: campaigns v2 (campaign-scoped persistent torch timer) ────
-- Decoupled from combat: torch burns independently of whether a fight is active.
-- Controlled exclusively via the push_light_timer socket event (socket.js).
-- light_timer_expires_at: UTC timestamp when torch burns out (null = paused/reset)
-- light_timer_remaining_secs: seconds remaining at last pause or the set duration;
--   updated at pause/reset so the client can restore the correct countdown on reconnect.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS light_timer_expires_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS light_timer_remaining_secs INTEGER NOT NULL DEFAULT 3600;

-- ─── BESTIARY SHARES (monster gifting between users) ─────────────────────────
-- Stores a snapshot of the shared monsters at the time of sending so recipients
-- can accept even if the sender later edits or deletes the originals.
-- This is an inbox model (not a public link): only the named recipient can see
-- or accept the share.
--
-- monsters_data: JSONB array of full monster records at time of share:
--   [{ id, name, challenge, tags, stat_data, game_system }, ...]
-- status: 'pending'   → recipient hasn't acted yet
--         'accepted'  → recipient added some or all monsters to their bestiary
--         'dismissed' → recipient declined without adding
CREATE TABLE IF NOT EXISTS bestiary_shares (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_system   VARCHAR(20) NOT NULL
                CHECK (game_system IN ('shadowdark','morkborg','nimble')),
  monsters_data JSONB       NOT NULL DEFAULT '[]',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','dismissed')),
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Inbox lookup: all pending shares for a recipient, newest first
CREATE INDEX IF NOT EXISTS idx_bestiary_shares_to
  ON bestiary_shares(to_user_id, status, created_at DESC);

-- Sent-shares lookup: all shares a user has sent
CREATE INDEX IF NOT EXISTS idx_bestiary_shares_from
  ON bestiary_shares(from_user_id, created_at DESC);

CREATE OR REPLACE TRIGGER trg_bestiary_shares_updated
  BEFORE UPDATE ON bestiary_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SAFE MIGRATIONS: user profiles ─────────────────────────────────────────
-- display_name_pref : whether to show first name alongside username on profile
-- about_text        : user-authored bio, ~200 words / 1200 chars
-- role_pref         : how the user wants to play (player / dm / both)
-- game_interests    : which game systems they're interested in (TEXT array)
-- profile_theme     : visual skin for their profile card
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name_pref VARCHAR(20) NOT NULL DEFAULT 'username';
ALTER TABLE users ADD COLUMN IF NOT EXISTS about_text        VARCHAR(1200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_pref         VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_interests    TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme     VARCHAR(20) NOT NULL DEFAULT 'default';

-- ─── FRIEND REQUESTS ──────────────────────────────────────────────────────────
-- Directed: sender_id initiates; receiver_id accepts or denies.
-- The UNIQUE constraint means A can only ever have one request row with B
-- (prevents re-sending after a deny without the deny being cleared first).
-- Once accepted the row status flips to 'accepted' — the row IS the friendship.
-- Querying friends: SELECT the other user_id from rows where status = 'accepted'
-- and either side matches the current user.
CREATE TABLE IF NOT EXISTS friend_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','denied')),
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  CONSTRAINT  no_self_friend CHECK (sender_id != receiver_id),
  UNIQUE(sender_id, receiver_id)
);

-- Fast lookup for incoming request tab + friends list
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver
  ON friend_requests(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
  ON friend_requests(sender_id, status, created_at DESC);

CREATE OR REPLACE TRIGGER trg_friend_requests_updated
  BEFORE UPDATE ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── USER BLOCKS ──────────────────────────────────────────────────────────────
-- One-directional: blocker_id has blocked blocked_id.
-- Enforced server-side in every query that returns user data or accepts messages.
-- Primary key is composite (no separate id needed — the pair is unique by definition).
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Fast lookup in both directions (needed for symmetric block checks in DM/search)
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
  ON user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON user_blocks(blocked_id, blocker_id);
