const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'campaigncodex',
  user:     process.env.DB_USER     || 'campaigncodex',
  password: process.env.DB_PASSWORD || '',
  max:      20,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

/**
 * Run a single query against the pool.
 * @param {string} text   - SQL query
 * @param {Array}  params - Parameterized values
 */
async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB]', { text: text.slice(0, 80), duration, rows: res.rowCount })
  }
  return res
}

/**
 * Get a client from the pool for transactions.
 * Always call client.release() in a finally block.
 */
async function getClient() {
  return pool.connect()
}

module.exports = { query, getClient, pool }
