-- Migration 003: Add timed ban support
-- banned_until = NULL means permanent ban; future timestamp = ban expires at that time
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
