/**
 * init-db.js — Run schema.sql against the configured database.
 * Usage: npm run db:init
 */
require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const { pool } = require('../src/db')

async function initDb() {
  const schemaPath = path.join(__dirname, '../src/db/schema.sql')
  const sql        = fs.readFileSync(schemaPath, 'utf8')

  console.log('⚙️  Running schema.sql...')
  try {
    await pool.query(sql)
    console.log('✅ Database schema initialized successfully.')
  } catch (err) {
    console.error('❌ Failed to initialize schema:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

initDb()
