-- ─── 005_uploads.sql ─────────────────────────────────────────────────────────
-- App-wide key-value settings and per-user file upload tracking.

-- Key-value store for admin-controlled feature flags
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Seed defaults (idempotent)
INSERT INTO app_settings (key, value)
VALUES ('uploads_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Track uploaded files and enforce per-user quota
CREATE TABLE IF NOT EXISTS user_uploads (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,   -- stored filename on disk (uuid.ext)
  original_name VARCHAR(255) NOT NULL,   -- original filename from the user
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    BIGINT       NOT NULL,
  purpose       VARCHAR(50)  NOT NULL DEFAULT 'general',
  -- purpose values: 'profile', 'portrait', 'vtt_map', 'vtt_token', 'general'
  url_path      VARCHAR(500) NOT NULL,   -- public path: /uploads/{userId}/{uuid}.ext
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_uploads_user_id_idx ON user_uploads(user_id);
CREATE INDEX IF NOT EXISTS user_uploads_purpose_idx  ON user_uploads(purpose);
