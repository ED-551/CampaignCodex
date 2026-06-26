-- ─── 006_vtt_scenes.sql ──────────────────────────────────────────────────────
-- Per-campaign VTT scenes. scene_data is the full transient scene state (tokens,
-- walls, lights, drawings, fog) as JSONB. Only one scene per campaign is active
-- at a time; the active scene is the one broadcast to joining players.

CREATE TABLE IF NOT EXISTS vtt_scenes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'Untitled Scene',
  is_active    BOOLEAN     NOT NULL DEFAULT false,
  scene_data   JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vtt_scenes_campaign ON vtt_scenes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vtt_scenes_active   ON vtt_scenes(campaign_id) WHERE is_active = true;
