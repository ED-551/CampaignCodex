/**
 * Shared application constants.
 *
 * Values are read from environment variables at startup. Defaults are provided
 * so the app works out-of-the-box in development without a .env file, but
 * PRIMARY_ADMIN_USERNAME MUST be set in production to avoid embedding the
 * privileged account name in version control.
 *
 * Why a shared module?
 *   PRIMARY_ADMIN_USERNAME is referenced in both admin.js (to guard role
 *   assignment) and auth.js (to compute the `isPrimaryAdmin` flag returned
 *   to the frontend). Duplicating the string would create a maintenance hazard
 *   and — more importantly — the original hardcoded value appeared in
 *   AdminDashboard.jsx, which ships in the public JavaScript bundle. Moving it
 *   here keeps it server-side only.
 */

const PRIMARY_ADMIN_USERNAME = process.env.PRIMARY_ADMIN_USERNAME ?? 'adm_Ffz6NttVTaY'

module.exports = { PRIMARY_ADMIN_USERNAME }
