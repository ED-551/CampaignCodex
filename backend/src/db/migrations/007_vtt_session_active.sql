-- Migration 007: Add session_active flag to vtt_scenes
-- Safe to re-run (IF NOT EXISTS / idempotent UPDATE).
ALTER TABLE vtt_scenes ADD COLUMN IF NOT EXISTS session_active BOOLEAN NOT NULL DEFAULT false;
