/**
 * migrate.js — apply all SQL migration files in order.
 *
 * All migrations use CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
 * so running them against an already-migrated database is safe and idempotent.
 *
 * Usage:
 *   node scripts/migrate.js
 *
 * Run automatically on startup via the Docker CMD (see Dockerfile).
 */

require('dotenv').config()

const fs   = require('fs')
const path = require('path')
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'campaigncodex',
  user:     process.env.DB_USER     || 'campaigncodex',
  password: process.env.DB_PASSWORD,
})

async function migrate() {
  const migrationsDir = path.join(__dirname, '../src/db/migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('[migrate] No migration files found.')
    await pool.end()
    return
  }

  console.log(`[migrate] Applying ${files.length} migration(s)…`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await pool.query(sql)
      console.log(`[migrate] ✓ ${file}`)
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`)
      await pool.end()
      process.exit(1)
    }
  }

  console.log('[migrate] All migrations applied.')
  await pool.end()
}

migrate().catch(err => {
  console.error('[migrate] Fatal:', err)
  process.exit(1)
})
