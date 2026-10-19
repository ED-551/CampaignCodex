/**
 * migrate.js — bring the database schema up to date.
 *
 *   1. Waits for PostgreSQL to accept connections (containers start together).
 *   2. On a brand-new database (no `users` table), runs schema.sql.
 *   3. Applies every file in src/db/migrations/ that is not yet recorded in
 *      the `schema_migrations` table, in filename order.
 *
 * Databases created before `schema_migrations` existed simply re-run every
 * migration once — they all use IF NOT EXISTS / IF EXISTS guards, so that is
 * safe — and are tracked from then on. New migrations no longer need to be
 * idempotent, but keeping them so is still good practice.
 *
 * Usage:
 *   node scripts/migrate.js
 *
 * Runs automatically on container start (see scripts/docker-entrypoint.sh).
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

const SCHEMA_PATH    = path.join(__dirname, '../src/db/schema.sql')
const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations')

// Arbitrary constant — makes concurrent starts (e.g. two API replicas) take
// turns instead of racing each other through the same migrations.
const ADVISORY_LOCK_KEY = 4815162342

async function connectWithRetry(attempts = 30, delayMs = 2000) {
  for (let i = 1; ; i++) {
    try {
      return await pool.connect()
    } catch (err) {
      if (i >= attempts) throw err
      console.log(`[migrate] Waiting for database (${err.message}) — retry ${i}/${attempts}`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

async function migrate() {
  const client = await connectWithRetry()

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])

    const { rows: [{ fresh }] } = await client.query(
      `SELECT to_regclass('public.users') IS NULL AS fresh`
    )
    if (fresh) {
      console.log('[migrate] Empty database — applying schema.sql…')
      await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'))
      console.log('[migrate] ✓ schema.sql')
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)
    const { rows } = await client.query('SELECT filename FROM schema_migrations')
    const applied  = new Set(rows.map(r => r.filename))

    const pending = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !applied.has(f))
      .sort()

    if (pending.length === 0) {
      console.log('[migrate] Database is up to date.')
      return
    }

    console.log(`[migrate] Applying ${pending.length} migration(s)…`)
    for (const file of pending) {
      // Some migrations manage their own BEGIN/COMMIT, so each file runs as-is
      // rather than inside a wrapping transaction.
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
      } catch (err) {
        err.message = `${file}: ${err.message}`
        throw err
      }
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      console.log(`[migrate] ✓ ${file}`)
    }
    console.log('[migrate] All migrations applied.')
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {})
    client.release()
    await pool.end()
  }
}

migrate().catch(err => {
  console.error('[migrate] ✗', err.message)
  process.exit(1)
})
