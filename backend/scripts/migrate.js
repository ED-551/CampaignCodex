/**
 * migrate.js — apply all SQL migration files in order.
 *
 * Applied files are recorded in the schema_migrations table and skipped on later runs.
 * Existing databases that predate tracking re-run every file once (all are idempotent),
 * after which they are recorded. New migrations need not be idempotent.
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const { rows: appliedRows } = await pool.query('SELECT filename FROM schema_migrations')
  const applied = new Set(appliedRows.map(r => r.filename))

  const migrationsDir = path.join(__dirname, '../src/db/migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('[migrate] No migration files found.')
    await pool.end()
    return
  }

  console.log(`[migrate] Checking ${files.length} migration(s), ${applied.size} already applied…`)

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file])
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
