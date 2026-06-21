/**
 * seed-admin.js — Creates the admin account if it doesn't exist.
 * Reads credentials from .env (ADMIN_USERNAME, ADMIN_PASSWORD).
 * Usage: npm run seed:admin
 *
 * ⚠️  Run ONCE after first database init.
 * ⚠️  Credentials are stored in your Obsidian vault — do not hardcode here.
 */
require('dotenv').config()
const bcrypt    = require('bcrypt')
const { pool }  = require('../src/db')

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('❌ ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env')
  process.exit(1)
}

async function seedAdmin() {
  console.log(`\n⚙️  Seeding admin account: ${ADMIN_USERNAME}`)

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR is_admin = true LIMIT 1',
      [ADMIN_USERNAME]
    )

    if (existing.rows.length > 0) {
      console.log('ℹ️  Admin account already exists. Skipping.')
      return
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

    await pool.query(
      `INSERT INTO users
         (username, email, first_name, last_name,
          password_hash, supporter_tier, is_admin)
       VALUES ($1,$2,$3,$4,$5,'black',true)`,
      [
        ADMIN_USERNAME,
        'admin@campaigncodex.internal',
        'Admin',
        'User',
        passwordHash,
      ]
    )

    console.log(`✅ Admin account created: ${ADMIN_USERNAME}`)
    console.log('   Tier: Platinum (full access)')
    console.log('   ⚠️  Store these credentials only in your Obsidian vault.\n')
  } catch (err) {
    console.error('❌ Failed to seed admin:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedAdmin()
